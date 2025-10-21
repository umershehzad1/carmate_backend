"use strict";

const express = require("express");
const router = express.Router();
const ReviewController = require("../app/Http/Controllers/v1/ReviewController");
const AuthCtrl = require("../app/Http/Controllers/v1/AuthController");

// Add or update review
router.post(
  "/:reviewedUserId",
  AuthCtrl.authenticate,
  ReviewController.addReview
);

// Get all reviews for a user
router.get("/:reviewedUserId", ReviewController.getReviewsForUser);

// Delete a specific user's review
router.delete("/", ReviewController.deleteReview);

module.exports = router;
