// routes/walletRoutes.js

const express = require("express");
const router = express.Router();
const walletController = require("../app/Http/Controllers/v1/WalletController");

// ✅ Create payment intent for adding funds
router.post(
  "/add-funds/create-intent",
  walletController.createAddFundsPaymentIntent
);

// ✅ Confirm payment and add funds
router.post(
  "/add-funds/confirm-payment",
  walletController.confirmAddFundsPayment
);

module.exports = router;
