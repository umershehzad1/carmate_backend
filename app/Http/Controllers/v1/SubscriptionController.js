"use strict";

const path = require("path");
const fs = require("fs");
const slugify = require("slugify");
const json = require("../../../Traits/ApiResponser"); // Your custom response helper
const db = require("../../../Models/index");
const { Op, where } = require("sequelize");
const stripe = require("../../../../config/Stripe");
const Subscription = db.Subscription;
const Vehicle = db.Vehicle;
const User = db.User;
// Sequential field validation function
function validateRequiredFieldsSequentially(body, requiredFields) {
  for (const field of requiredFields) {
    const value = body[field];
    if (!value || (typeof value === "string" && value.trim() === "")) {
      throw new Error(`Field "${field}" is required`);
    }
  }
}

const o = {};

o.createCheckoutSession = async function (req, res, next) {
  try {
    console.log("body request", req.body);
    const { plan } = req.body; // 'basic' | 'pro' | 'premium'
    const { id: userId, role } = req.decoded;

    // Validate input

    if (!plan) return json.errorResponse(res, "Plan is required", 400);

    const user = await User.findByPk(userId);
    if (!user) return json.errorResponse(res, "User not found", 404);

    // 🔹 Map each role to its available Stripe product IDs
    const planMap = {
      dealer: {
        basic: "prod_TEzBX5cQyRu5hH",
        pro: "prod_TEzBgTSE0Aq19O",
        premium: "prod_TEzCILRwLvmkip",
      },
      repair: {
        pro: "prod_TEzDsucDCJIf4S",
        premium: "prod_TEzD6bmLXzkrCf",
      },
      insurance: {
        pro: "prod_TEzElDwxHBTDnV",
        premium: "prod_TEzFBICI4C017R",
      },
    };

    // Validate role and plan combination
    const productId = planMap[role]?.[plan];
    if (!productId) {
      return json.errorResponse(res, `Invalid plan for role: ${role}`, 400);
    }

    // ✅ Get price from product (optional; for testing, use hardcoded amount)
    const product = await stripe.products.retrieve(productId);
    const priceList = await stripe.prices.list({
      product: productId,
      active: true,
    });
    const priceId = priceList.data[0]?.id;

    if (!priceId)
      return json.errorResponse(res, "No price found for product", 400);

    // ✅ Create Stripe customer if not already created
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.fullname || "Unknown User",
    });

    // ✅ Create Checkout session for subscription
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customer.id,
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: "http://localhost:3000/success",
      cancel_url: "http://localhost:3000/cancel",
      metadata: {
        userId,
        role,
        plan,
      },
    });

    return json.showOne(res, { checkoutUrl: session.url }, 200);
  } catch (error) {
    console.error("Stripe Subscription Error:", error);
    return json.errorResponse(
      res,
      error.message || "Something went wrong",
      400
    );
  }
};

o.handleCheckoutSessionCompleted = async (session) => {
  try {
    const { userId, plan } = session.metadata;

    // Retrieve Stripe subscription details
    const stripeSub = await stripe.subscriptions.retrieve(session.subscription);

    // --- Compute expiry date ---
    let expiryDate;
    if (stripeSub.current_period_end) {
      expiryDate = new Date(stripeSub.current_period_end * 1000);
    } else if (stripeSub.start_date) {
      expiryDate = new Date(stripeSub.start_date * 1000);
      if (stripeSub.plan?.interval === "month")
        expiryDate.setMonth(expiryDate.getMonth() + 1);
      else if (stripeSub.plan?.interval === "year")
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      else expiryDate.setDate(expiryDate.getDate() + 30);
    } else {
      expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 1);
    }

    if (isNaN(expiryDate.getTime())) {
      throw new Error("Invalid expiryDate value");
    }

    const price = stripeSub.items.data[0].price.unit_amount / 100;

    // --- Check if the user already has a subscription ---
    const existingSub = await Subscription.findOne({ where: { userId } });

    if (existingSub) {
      // If same plan: extend expiry date
      // If different plan: upgrade immediately and reset expiry
      if (existingSub.plan === plan) {
        // Extend expiry by adding the new duration
        const currentExpiry = new Date(existingSub.expiryDate || new Date());
        if (currentExpiry > new Date()) {
          // Still active → extend from current expiry
          currentExpiry.setMonth(currentExpiry.getMonth() + 1);
          expiryDate = currentExpiry;
        }
      }

      await existingSub.update({
        plan,
        price: `CA$${price}`,
        expiryDate,
      });

      console.log(`🔁 Subscription updated for user ${userId} → ${plan}`);
    } else {
      // New subscription
      await Subscription.create({
        userId,
        plan,
        price: `$${price}`,
        expiryDate,
      });

      console.log(`✅ New subscription created for user ${userId} (${plan})`);
    }

    // Optional: mark user as active in User model
    await User.update({ subscriptionActive: true }, { where: { id: userId } });
  } catch (error) {
    return json.errorResponse(res, error.message, 400);
  }
};

/**
 * ✅ Handle Stripe customer.subscription.deleted webhook
 */
o.handleSubscriptionDeleted = async (subscription) => {
  try {
    const { userId } = subscription.metadata || {};
    if (!userId) return;
    await Subscription.destroy({ where: { userId } });

    return json.successResponse(res, "Subscription cancelled", 200);
  } catch (error) {
    return json.errorResponse(res, error.message, 400);
  }
};

o.cancelSubscription = async function (req, res, next) {
  try {
    const user = req.decoded;
    const subscription = await Subscription.findOne({ userId: user.id });

    if (!subscription) {
      return json.errorResponse(res, "No subscription found", 404);
    }
    await subscription.destroy();
    return json.successResponse(
      res,
      "Subscription cancelled Successfully",
      200
    );
  } catch (error) {
    return json.errorResponse(res, error.message, 400);
  }
};

module.exports = o;
