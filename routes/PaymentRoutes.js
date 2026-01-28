"use strict";

const express = require("express");
const router = express.Router();

const paymentCtrl = require("../app/Http/Controllers/v1/PaymentController");
const authCtrl = require("../app/Http/Controllers/v1/AuthController");
const CheckSubscriptionExpiry = require("../app/Http/Middleware/CheckSubscriptionExpiry");

const checkSubscriptionExpiry = new CheckSubscriptionExpiry();

// Get user's payment information (card details, subscription status, etc.)
router
  .route("/info")
  .get(authCtrl.authenticate, paymentCtrl.getPaymentInfo);

// Legacy route - keeping for backward compatibility
router
  .route("/card-details")
  .get(authCtrl.authenticate, paymentCtrl.getPaymentInfo);

// Update payment method
router
  .route("/update-payment-method")
  .put(authCtrl.authenticate, paymentCtrl.updatePaymentMethod);

// Create setup intent for adding new payment method
router
  .route("/setup-intent")
  .post(authCtrl.authenticate, paymentCtrl.createSetupIntent);

// Retry failed payment
router
  .route("/retry-payment")
  .post(authCtrl.authenticate, paymentCtrl.retryPayment);

// Get user's payment logs
router
  .route("/logs")
  .get(authCtrl.authenticate, paymentCtrl.getPaymentLogs);

// Get all payment logs (admin only)
router
  .route("/logs/all")
  .get(
    authCtrl.authenticate,
    authCtrl.isAdmin,
    paymentCtrl.getAllPaymentLogs
  );

// Create payment intent for subscription renewal
router
  .route("/create-payment-intent")
  .post(authCtrl.authenticate, paymentCtrl.createPaymentIntent);

// Routes that require active subscription (protected by middleware)
router.use(checkSubscriptionExpiry.handle.bind(checkSubscriptionExpiry));

// Example protected route - dashboard data
router
  .route("/dashboard-access-check")
  .get(authCtrl.authenticate, checkSubscriptionExpiry.handleDashboardAccess.bind(checkSubscriptionExpiry), (req, res) => {
    res.json({
      success: true,
      message: "Dashboard access granted",
      subscription: req.subscription
    });
  });

module.exports = router;