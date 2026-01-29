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
    console.log("🔍 [WEBHOOK] Incoming request received");
    console.log("🔍 [WEBHOOK] Headers:", JSON.stringify(req.headers, null, 2));
    console.log("🔍 [WEBHOOK] Body length:", req.body?.length || 0);
    
    const sig = req.headers["stripe-signature"];

    if (!sig) {
      console.error("⚠️ [WEBHOOK] No stripe-signature header");
      console.error("⚠️ [WEBHOOK] Available headers:", Object.keys(req.headers));
      return res.status(400).send("No signature");
    }

    console.log("🔍 [WEBHOOK] Stripe signature found:", sig.substring(0, 20) + "...");

    let event;

    try {
      console.log("🔍 [WEBHOOK] Constructing Stripe event...");
      console.log("🔍 [WEBHOOK] Using webhook secret:", process.env.STRIPE_WEBHOOK_SECRET ? "✅ Set" : "❌ Missing");
      
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      console.log(`✅ [WEBHOOK] Webhook verified: ${event.type}`);
      console.log(`🔍 [WEBHOOK] Event ID: ${event.id}`);
      console.log(`🔍 [WEBHOOK] Event created: ${new Date(event.created * 1000).toISOString()}`);
    } catch (err) {
      console.error("⚠️ [WEBHOOK] Webhook signature verification failed:", err.message);
      console.error("⚠️ [WEBHOOK] Error type:", err.type);
      console.error("⚠️ [WEBHOOK] Error code:", err.code);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      console.log(`🔄 [WEBHOOK] Processing event: ${event.type}`);
      
      switch (event.type) {
        case "checkout.session.completed":
          console.log("🛒 [WEBHOOK] Processing checkout.session.completed");
          await subscriptionCtrl.handleCheckoutSessionCompleted(
            event.data.object
          );
          console.log("✅ [WEBHOOK] checkout.session.completed processed successfully");
          break;

        case "invoice.payment_succeeded":
          console.log("💳 [WEBHOOK] Processing invoice.payment_succeeded");
          await subscriptionCtrl.handleInvoicePaid(event.data.object);
          console.log("✅ [WEBHOOK] invoice.payment_succeeded processed successfully");
          break;

        case "invoice.payment_failed":
          console.log("❌ [WEBHOOK] Processing invoice.payment_failed");
          await subscriptionCtrl.handleInvoiceFailed(event.data.object);
          console.log("✅ [WEBHOOK] invoice.payment_failed processed successfully");
          break;

        case "customer.subscription.deleted":
          console.log("🗑️ [WEBHOOK] Processing customer.subscription.deleted");
          await subscriptionCtrl.handleSubscriptionDeleted(event.data.object);
          console.log("✅ [WEBHOOK] customer.subscription.deleted processed successfully");
          break;

        default:
          console.log(`ℹ️ [WEBHOOK] Ignored event type: ${event.type}`);
      }

      console.log(`✅ [WEBHOOK] Event ${event.id} processed successfully`);
      res.status(200).json({ received: true, eventId: event.id, eventType: event.type });
    } catch (err) {
      console.error("❌ [WEBHOOK] Webhook handling error:", err.message);
      console.error("❌ [WEBHOOK] Error stack:", err.stack);
      console.error("❌ [WEBHOOK] Event data:", JSON.stringify(event.data.object, null, 2));
      res.status(500).json({ error: err.message, eventId: event.id, eventType: event.type });
    }
  }
);

module.exports = router;
