"use strict";

const path = require("path");
const fs = require("fs");
const slugify = require("slugify");
const json = require("../../../Traits/ApiResponser"); // Your custom response helper
const db = require("../../../Models/index");
const { Op, where } = require("sequelize");
const TestDriveRequest = db.TestDriveRequest;
const Referral = db.Referral;
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

o.createReferral = async function (req, res, next) {
  try {
    const { jobType, vehicleId, requestedDate } = req.body;
    const { id } = req.decoded;
    validateRequiredFieldsSequentially(req.body, [
      "jobType",
      "vehicleId",
      "requestedDate",
    ]);
    const vehicle = await Vehicle.findByPk(vehicleId);
    if (!vehicle) {
      return json.errorResponse(res, "Vehicle not found", 404);
    }
    const referral = await Referral.create({
      customerId: id,
      jobType: jobType,
      vehicleId: vehicleId,
      userId: id,
      requestedDate: requestedDate,
    });

    return json.showOne(res, referral, 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

o.getReferralDetails = async function (req, res, next) {
  try {
    const { id } = req.params;
    const ReferralDetails = await Referral.findByPk(id, {
      include: [
        {
          model: Vehicle,
          as: "vehicle",
        },
        {
          model: User,
          as: "customer",
          attributes: { exclude: [] },
        },
      ],
    });
    console.log("referrals data:", ReferralDetails);

    if (!Referral) {
      return json.errorResponse(res, "Repair Referral Not Fount", 404);
    }
    return json.showOne(res, ReferralDetails, 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

o.getAllReferrals = async function (req, res, next) {
  try {
    const Referrals = await Referral.findAll({
      include: [
        {
          model: Vehicle,
          as: "vehicle",
          where: { dealerId: req.decoded.id },
          required: true,
        },
        {
          model: User,
          as: "customer",
          attributes: { exclude: [] },
        },
      ],
    });

    if (!Referrals || Referrals.length === 0) {
      return json.errorResponse(res, "No repair referrals found", 404);
    }

    return json.showAll(res, Referrals, 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

o.UpdateStatus = async function (req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const ReferralDetails = await Referral.findByPk(id);

    if (!ReferralDetails) {
      return json.errorResponse(res, "Repair Referral Not Fount", 404);
    }

    await ReferralDetails.update({ status: status });
    return json.successResponse(
      res,
      `Referral Status Update to ${status}`,
      200
    );
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

module.exports = o;
