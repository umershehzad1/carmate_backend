"use strict";

const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET);

const subscriptionCtrl = require("../app/Http/Controllers/v1/SubscriptionController");
const authCtrl = require("../app/Http/Controllers/v1/AuthController");

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
module.exports = router;
