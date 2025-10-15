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
    // delegate to a controller or keep inline (example reuse your previous logic)
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

    // handle events (you can call a handler in your controller instead)
    if (event.type === "checkout.session.completed") {
      await subscriptionCtrl.handleCheckoutSessionCompleted(event.data.object);
    } else if (event.type === "customer.subscription.deleted") {
      await subscriptionCtrl.handleSubscriptionDeleted(event.data.object);
    }

    res.status(200).send("Received");
  }
);

module.exports = router;
