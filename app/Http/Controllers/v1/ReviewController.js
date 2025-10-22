"use strict";

const db = require("../../../Models/index");
const json = require("../../../Traits/ApiResponser");
const { Op } = require("sequelize");
const Review = db.Review;
const User = db.User;

const o = {};

o.addReview = async (req, res, next) => {
  try {
    const { rating, text } = req.body;
    const { reviewedUserId } = req.params;
    const reviewerId = req.decoded.id; // reviewer ID from JWT

    if (!reviewerId || !reviewedUserId || !rating) {
      return json.errorResponse(
        res,
        "reviewerId, reviewedUserId, and rating are required",
        400
      );
    }

    if (rating < 1 || rating > 5) {
      return json.errorResponse(res, "Rating must be between 1 and 5", 400);
    }

    // Check if reviewer has already reviewed this user
    let existingReview = await Review.findOne({
      where: { reviewerId, reviewedUserId },
    });

    if (existingReview) {
      // Update existing review
      existingReview.rating = rating;
      existingReview.text = text;
      await existingReview.save();

      return json.successResponse(res, "Review updated successfully", 200);
    }

    // Create new review
    const newReview = await Review.create({
      reviewerId,
      reviewedUserId,
      rating,
      text,
    });

    return json.successResponse(res, "Review added successfully", 200);
  } catch (error) {
    return json.errorResponse(res, error.message, 400);
  }
};

o.getReviewsForUser = async function (req, res, next) {
  try {
    const { reviewedUserId } = req.params;

    const reviews = await Review.findAll({
      where: { reviewedUserId },
      include: [
        {
          model: User,
          as: "reviewer",
          attributes: ["id", "fullname", "email", "image"],
        },
      ],
    });

    return json.successResponse(res, reviews, 200);
  } catch (error) {
    return json.errorResponse(res, error.message, 400);
  }
};

o.deleteReview = async function (req, res, next) {
  try {
    const { userId, reviewedUserId } = req.body;

    if (!userId || !reviewedUserId) {
      return json.errorResponse(
        res,
        "userId and reviewedUserId are required",
        400
      );
    }

    const reviewRecord = await Review.findOne({ where: { reviewedUserId } });

    if (!reviewRecord) {
      return json.errorResponse(res, "No reviews found for this user", 404);
    }

    const updatedReviews = reviewRecord.userReviews.filter(
      (r) => r.userId !== userId
    );

    if (updatedReviews.length === reviewRecord.userReviews.length) {
      return json.errorResponse(res, "Review not found for this user", 404);
    }

    // Update total reviews and rating
    reviewRecord.userReviews = updatedReviews;
    reviewRecord.totalReviews = updatedReviews.length;
    reviewRecord.totalRating =
      updatedReviews.length > 0
        ? updatedReviews.reduce((sum, r) => sum + r.rating, 0) /
          updatedReviews.length
        : 0;

    await reviewRecord.save();

    return json.successResponse(
      res,
      reviewRecord,
      "Review deleted successfully"
    );
  } catch (error) {
    return json.errorResponse(res, error.message, 400);
  }
};

module.exports = o;
