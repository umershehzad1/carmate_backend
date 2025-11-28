"use strict";

const path = require("path");
const fs = require("fs");
const slugify = require("slugify");
const json = require("../../../Traits/ApiResponser"); // Your custom response helper
const db = require("../../../Models/index");
const { Op, where } = require("sequelize");
const Dealer = db.Dealer;
const Vehicle = db.Vehicle;
const User = db.User;

const o = {};

o.getAllDealers = async function (req, res, next) {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const pageInt = parseInt(page) || 1;
    const limitInt = parseInt(limit) || 10;
    const offset = (pageInt - 1) * limitInt;
    const where = {};

    // Search dealers by city (case-insensitive, partial match)
    if (search) {
      where.location = { [Op.iLike]: `%${search}%` };
    }

    // Fetch dealers with pagination; order verified dealers first, then by createdAt
    const { rows: dealers, count: total } = await Dealer.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "fullname", "email", "phone", "image"],
        },
      ],
      limit: limitInt,
      offset,
      order: [
        [
          db.sequelize.literal("CASE WHEN status = 'verified' THEN 0 ELSE 1 END"),
          "ASC",
        ],
        ["createdAt", "DESC"],
      ],
    });

    const totalPages = Math.ceil(total / limitInt);

    if (!dealers || dealers.length === 0) {
      return json.errorResponse(res, "No dealers found", 404);
    }

    return json.successResponse(res, {
      currentPage: parseInt(page),
      totalPages,
      totalRecords: total,
      dealers,
    });
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};



o.getDealerDetails = async function (req, res, next) {
  try {
    const { slug } = req.params;
    const dealer = await Dealer.findOne({
      where: { slug },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "fullname", "email", "phone", "image"],
        },
      ],
    });

    if (!dealer) {
      return json.errorResponse(res, "Dealer not found", 404);
    }
    return json.showOne(res, dealer, 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

o.updateDealer = async function (req, res, next) {
  try {
    // Ensure only dealers can update their profile
    if (req.decoded.role !== "dealer") {
      return json.errorResponse(
        res,
        "You are not authorized to perform this action",
        403
      );
    }

    const userId = req.decoded.id;
    console.log(userId);

    // Step 1: Find dealer by userId (the logged-in dealer)
    const dealer = await Dealer.findOne({
      where: { userId },
    });

    if (!dealer) {
      return json.errorResponse(res, "Dealer not found", 404);
    }

    // Step 2: Update the dealer record with provided fields
    const updatedDealer = await dealer.update(req.body);

    // Step 3: Return response
    return json.successResponse(
      res,
      "Dealer profile updated successfully.",
      200
    );
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

o.deleteDealer = async function (req, res, next) {
  try {
    // Ensure only dealers can perform this action
    if (req.decoded.role !== "dealer") {
      return json.errorResponse(
        res,
        "You are not authorized to perform this action",
        403
      );
    }

    const userId = req.decoded.id;
    // Step 1: Find dealer by userId
    const dealer = await Dealer.findOne({
      where: { userId },
    });

    if (!dealer) {
      return json.errorResponse(res, "Dealer not found", 404);
    }

    // Step 2: Delete dealer record
    await dealer.destroy();

    // Step 3: Optionally, update user's role back to 'user' (recommended)
    const user = await User.findByPk(userId);
    if (user) {
      user.role = "user";
      await user.save();
    }

    // Step 4: Send response
    return json.successResponse(
      res,
      "Dealer account deleted successfully.",
      200
    );
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

module.exports = o;
