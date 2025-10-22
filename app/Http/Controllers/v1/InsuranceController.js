"use strict";

const path = require("path");
const fs = require("fs");
const slugify = require("slugify");
const json = require("../../../Traits/ApiResponser"); // Your custom response helper
const db = require("../../../Models/index");
const { Op, where } = require("sequelize");
const Insurance = db.Insurance;
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

o.getAllInsurance = async function (req, res, next) {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const offset = (page - 1) * limit;
    const where = {};

    // Search dealers by city (case-insensitive, partial match)
    if (search) {
      where.location = { [Op.iLike]: `%${search}%` };
    }

    // Fetch dealers with pagination
    const { rows: insurances, count: total } = await Insurance.findAndCountAll({
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

    return json.successResponse(res, {
      currentPage: parseInt(page),
      totalPages,
      totalRecords: total,
      insurances,
    });
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

o.getInsurnaceProfile = async function (req, res, next) {
  try {
    const { slug } = req.params;
    const insurance = await Insurance.findOne({
      where: { slug },
      include: [
        {
          model: User,
          as: "user",
          attributes: { exclude: ["password"] },
        },
      ],
    });

    if (!insurance) {
      return json.errorResponse(res, "Insurance not found", 404);
    }
    return json.showOne(res, insurance, 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

o.updateInsuranceProfile = async function (req, res, next) {
  try {
    const user = req.decoded;
    if (user.role !== "insurance") {
      return json.errorResponse(
        res,
        "You are not authorized to perform this action",
        403
      );
    }
    const insurance = await Insurance.findOne({
      where: { userId: user.id },
    });

    if (!insurance) {
      return json.errorResponse(res, "Insurance not found", 404);
    }

    const updatedInsurance = await insurance.update(req.body);
    return json.showOne(res, "Insurance Profile Updated Successfully", 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

o.deleteInsuranceProfile = async function (req, res, next) {
  try {
    const user = req.decoded;
    if (user.role !== "insurance") {
      return json.errorResponse(
        res,
        "You are not authorized to perform this action",
        403
      );
    }
    const insurance = await Insurance.findOne({
      where: { userId: user.id },
    });

    if (!insurance) {
      return json.errorResponse(res, "Insurance not found", 404);
    }

    await insurance.destroy();
    return json.showOne(res, "Insurance Profile Deleted Successfully", 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

module.exports = o;
