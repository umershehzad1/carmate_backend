"use strict";

const path = require("path");
const fs = require("fs");
const slugify = require("slugify");
const json = require("../../../Traits/ApiResponser"); // Your custom response helper
const db = require("../../../Models/index");
const { Op, where } = require("sequelize");
const Repair = db.Repair;
const Vehicle = db.Vehicle;
const User = db.User;
// Sequential field validation function
function validateRequiredFieldsSequentially(body, requiredFields) {
  for (const field of requiredFields) {
    const value = body[field];
    if (!value || (typeof value === "string" && value.trim() === "")) {
      throw new Error(`Field "${field}" is required`);
    }
  }
}

const o = {};

o.getAllRepairs = async function (req, res, next) {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const offset = (page - 1) * limit;
    const where = {};

    // Search dealers by city (case-insensitive, partial match)
    if (search) {
      where.location = { [Op.iLike]: `%${search}%` };
    }

    // Fetch dealers with pagination
    const { rows: repairs, count: total } = await Repair.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "user",
          attributes: { exclude: ["password"] },
        },
      ],
      limit: parseInt(limit),
      offset,
      order: [["createdAt", "DESC"]],
    });

    const totalPages = Math.ceil(total / limit);

    if (!repairs || repairs.length === 0) {
      return json.errorResponse(res, "No insurances found", 404);
    }

    return json.successResponse(res, {
      currentPage: parseInt(page),
      totalPages,
      totalRecords: total,
      repairs,
    });
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

o.getRepairDetails = async function (req, res, next) {
  try {
    const { slug } = req.params;
    const repair = await Repair.findOne({
      where: { slug },
      include: [
        { model: User, as: "user", attributes: { exclude: ["password"] } },
      ],
    });

    if (!repair) {
      return json.errorResponse(res, "Repair not found", 404);
    }
    return json.showOne(res, repair, 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

o.updateRepairProfile = async function (req, res, next) {
  try {
    const userId = req.decoded.id;

    // Step 1: Find dealer by userId (the logged-in dealer)
    const repair = await Repair.findOne({
      where: { userId },
    });

    if (!repair) {
      return json.errorResponse(res, "Dealer not found", 404);
    }

    // Step 2: Prepare update data
    const updateData = { ...req.body };

    // Step 3: Handle uploaded files from req.files
    if (req.files && req.files.length > 0) {
      // Construct full URLs with server address
      const serverAddress = process.env.APP_URL;
      const finalImages = [];

      req.files.forEach((file) => {
        finalImages.push(`${serverAddress}/uploads/gallery/${file.filename}`);
      });

      // Append new images to existing gallery array instead of replacing
      const existingGallery = Array.isArray(repair.gallery)
        ? repair.gallery
        : [];
      updateData.gallery = existingGallery.concat(finalImages);
    }

    // Step 4: Update the repair record with provided fields
    const updatedRepair = await repair.update(updateData);

    // Step 5: Return response with the updated record
    return json.successResponse(
      res,
      "Repair profile updated successfully",
      200
    );
  } catch (error) {
    console.error("updateRepairProfile Error:", error);
    return json.errorResponse(res, error.message || error, 400);
  }
};

o.deleteRepairProfile = async function (req, res, next) {
  try {
    // Ensure only dealers can perform this action
    if (req.decoded.role !== "repair") {
      return json.errorResponse(
        res,
        "You are not authorized to perform this action",
        403
      );
    }

    const userId = req.decoded.id;

    const repair = await Repair.findOne({
      where: { userId: userId },
    });

    if (!repair) {
      return json.errorResponse(res, "Dealer not found", 404);
    }

    // Step 2: Delete dealer record
    await repair.destroy();

    // Step 3: Optionally, update user's role back to 'user' (recommended)
    const user = await User.findByPk(userId);
    if (user) {
      user.role = "user";
      await user.save();
    }
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

module.exports = o;
