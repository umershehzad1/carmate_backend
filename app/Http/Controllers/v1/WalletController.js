"use strict";

const path = require("path");
const fs = require("fs");
const slugify = require("slugify");
const json = require("../../../Traits/ApiResponser"); // Your custom response helper
const db = require("../../../Models/index");
const { Op, where } = require("sequelize");
const stripe = require("../../../../config/Stripe");
const TestDriveRequest = db.TestDriveRequest;
const Contact = db.Contact;
const User = db.User;
const Wallet = db.Wallet;

let o = {};

o.createAddFundsPaymentIntent = async function (req, res, next) {
  try {
    const { userId, amount } = req.body;

    console.log(
      `💳 [ADD FUNDS] Creating payment intent for userId: ${userId}, amount: $${amount}`
    );

    // ✅ Validate input
    if (!userId || !amount) {
      console.error("❌ [ADD FUNDS] Missing userId or amount");
      return json.errorResponse(res, "userId and amount are required", 400);
    }

    if (amount <= 0) {
      console.error("❌ [ADD FUNDS] Amount must be positive");
      return json.errorResponse(res, "Amount must be greater than 0", 400);
    }

    // ✅ Verify user exists
    const user = await User.findByPk(userId);
    if (!user) {
      console.error(`❌ [ADD FUNDS] User ${userId} not found`);
      return json.errorResponse(res, "User not found", 404);
    }

    console.log(`✅ [ADD FUNDS] User verified: ${user.email}`);

    // ✅ Check if wallet exists, if not create one
    let wallet = await Wallet.findOne({ where: { userId } });
    if (!wallet) {
      console.log(`📝 [ADD FUNDS] Creating wallet for user ${userId}`);
      wallet = await Wallet.create({
        userId,
        totalBalance: 0,
        spentBalance: 0,
        reserveBalance: 0,
        transactions: [],
      });
      console.log(`✅ [ADD FUNDS] Wallet created for user ${userId}`);
    }

    console.log(`🏦 [ADD FUNDS] Wallet found/created for userId: ${userId}`);

    // ✅ Convert amount to cents for Stripe
    const amountInCents = Math.round(amount * 100);

    // ✅ Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: "usd",
      metadata: {
        userId: String(userId),
        walletId: String(wallet.id),
        transactionType: "add_funds",
        description: `Add funds to wallet for user ${userId}`,
      },
      description: `Wallet top-up for user ${user.email}`,
    });

    console.log(`✅ [ADD FUNDS] Payment intent created:`, {
      id: paymentIntent.id,
      amount: paymentIntent.amount,
      status: paymentIntent.status,
    });

    const responseData = {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount,
      userId,
      walletId: wallet.id,
    };

    return json.showOne(res, responseData, 200);
  } catch (error) {
    console.error(
      "❌ [ADD FUNDS] Error creating payment intent:",
      error.message
    );
    return json.errorResponse(res, error.message || error, 400);
  }
};

// ✅ Confirm payment and add funds to wallet
o.confirmAddFundsPayment = async function (req, res, next) {
  try {
    const { paymentIntentId, userId } = req.body;

    console.log(
      `💳 [CONFIRM PAYMENT] Confirming payment: ${paymentIntentId} for userId: ${userId}`
    );

    // ✅ Validate input
    if (!paymentIntentId || !userId) {
      console.error("❌ [CONFIRM PAYMENT] Missing paymentIntentId or userId");
      return json.errorResponse(
        res,
        "paymentIntentId and userId are required",
        400
      );
    }

    // ✅ Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    console.log(`🔍 [CONFIRM PAYMENT] Payment intent retrieved:`, {
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
    });

    // ✅ Check if payment succeeded
    if (paymentIntent.status !== "succeeded") {
      console.error(
        `❌ [CONFIRM PAYMENT] Payment not succeeded, status: ${paymentIntent.status}`
      );
      return json.errorResponse(
        res,
        `Payment not completed. Status: ${paymentIntent.status}`,
        400
      );
    }

    // ✅ Get amount from payment intent (convert from cents to dollars)
    const amount = paymentIntent.amount / 100;

    // ✅ Verify user exists
    const user = await User.findByPk(userId);
    if (!user) {
      console.error(`❌ [CONFIRM PAYMENT] User ${userId} not found`);
      return json.errorResponse(res, "User not found", 404);
    }

    console.log(`✅ [CONFIRM PAYMENT] User verified: ${user.email}`);

    // ✅ Retrieve wallet
    const wallet = await Wallet.findOne({ where: { userId } });
    if (!wallet) {
      console.error(
        `❌ [CONFIRM PAYMENT] Wallet not found for userId: ${userId}`
      );
      return json.errorResponse(res, "Wallet not found", 404);
    }

    console.log(`🏦 [CONFIRM PAYMENT] Wallet found for userId: ${userId}`);

    // ✅ Update wallet balances
    const previousBalance = parseFloat(wallet.totalBalance);
    const newTotalBalance = previousBalance + amount;

    // ✅ Create transaction record
    const transactionRecord = {
      transactionTime: new Date().toISOString(),
      title: "Added Funds",
      amount: amount,
      type: "credit",
      paymentIntentId: paymentIntentId,
    };

    // ✅ Add to transactions array
    const updatedTransactions = wallet.transactions || [];
    updatedTransactions.push(transactionRecord);

    // ✅ Update wallet in database
    wallet.totalBalance = newTotalBalance;
    wallet.transactions = updatedTransactions;

    // ✅ Mark transactions field as changed (IMPORTANT for JSON fields)
    wallet.changed("transactions", true);

    await wallet.save();

    console.log(`✅ [CONFIRM PAYMENT] Wallet updated:`, {
      walletId: wallet.id,
      previousBalance,
      addedAmount: amount,
      newTotalBalance,
      transactionCount: updatedTransactions.length,
    });

    const responseData = {
      walletId: wallet.id,
      userId,
      previousBalance,
      addedAmount: amount,
      newTotalBalance,
      transactionTime: transactionRecord.transactionTime,
    };

    return json.showOne(res, responseData, 200);
  } catch (error) {
    console.error(
      "❌ [CONFIRM PAYMENT] Error confirming payment:",
      error.message
    );
    return json.errorResponse(res, error.message || error, 400);
  }
};

module.exports = o;
