"use strict";

const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET);

const subscriptionCtrl = require("../app/Http/Controllers/v1/SubscriptionController");
const authCtrl = require("../app/Http/Controllers/v1/AuthController");
const checkSubscriptionExpiry = require("../app/Http/Middleware/CheckSubscriptionExpiry");

router.post(
  "/create/:id",
  authCtrl.authenticate,
  subscriptionCtrl.createCheckoutSession
);

router
  .route("/cancelsubscription")
  .delete(authCtrl.authenticate, subscriptionCtrl.cancelSubscription);

router
  .route("/getusersubscription")
  .get(authCtrl.authenticate, subscriptionCtrl.getUserSubscription);

router
  .route("/getallsubs")
  .get(
    authCtrl.authenticate,
    authCtrl.isAdmin,
    subscriptionCtrl.getAllSubscriptions
  );

router
  .route("/getActiveSubsction")
  .get(authCtrl.authenticate, subscriptionCtrl.checkActiveSubscription);

// Example of protected route that requires active subscription
// You can apply this middleware to any route that requires active subscription
router
  .route("/protected-example")
  .get(
    authCtrl.authenticate,
    checkSubscriptionExpiry,
    (req, res) => {
      res.json({ message: "Access granted - subscription is active" });
    }
  );

module.exports = router;
