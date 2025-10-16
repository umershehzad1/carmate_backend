"use strict";

const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET);

const subscriptionCtrl = require("../app/Http/Controllers/v1/SubscriptionController");
const authCtrl = require("../app/Http/Controllers/v1/AuthController");

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("⚠️ Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case "checkout.session.completed":
          // Subscription created
          await subscriptionCtrl.handleCheckoutSessionCompleted(
            event.data.object
          );
          break;

        case "invoice.payment_succeeded":
          // Invoice successfully paid → extend subscription
          await subscriptionCtrl.handleInvoicePaid(event.data.object);
          break;

        case "invoice.payment_failed":
          // Payment failed → handle accordingly
          await subscriptionCtrl.handleInvoiceFailed(event.data.object);
          break;

        case "customer.subscription.deleted":
          // Subscription canceled
          await subscriptionCtrl.handleSubscriptionDeleted(event.data.object);
          break;

        default:
          console.log(`ℹ️ Ignored event type: ${event.type}`);
      }
    } catch (err) {
      console.error("Webhook handling error:", err.message);
      return res.status(500).send("Internal Error");
    }

    res.status(200).send("Received");
  }
);

module.exports = router;
