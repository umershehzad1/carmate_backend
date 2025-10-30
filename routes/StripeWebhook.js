// routes/StripeWebhook.js
"use strict";

const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const subscriptionCtrl = require("../app/Http/Controllers/v1/SubscriptionController");

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];

    if (!sig) {
      console.error("⚠️ No stripe-signature header");
      return res.status(400).send("No signature");
    }

    let event;

    try {
      console.log("🔍 Constructing Stripe event...");
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      console.log(`✅ Webhook verified: ${event.type}`);
    } catch (err) {
      console.error("⚠️ Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case "invoice.payment_succeeded":
          console.log("💳 Processing invoice.payment_succeeded");
          await subscriptionCtrl.handleCheckoutSessionCompleted(
            event.data.object
          );
          break;

        case "invoice.payment_failed":
          console.log("❌ Processing invoice.payment_failed");
          await subscriptionCtrl.handleInvoiceFailed(event.data.object);
          break;

        case "customer.subscription.deleted":
          console.log("🗑️ Processing customer.subscription.deleted");
          await subscriptionCtrl.handleSubscriptionDeleted(event.data.object);
          break;

        default:
          console.log(`ℹ️ Ignored event type: ${event.type}`);
      }

      res.status(200).json({ received: true });
    } catch (err) {
      console.error("❌ Webhook handling error:", err.message);
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
