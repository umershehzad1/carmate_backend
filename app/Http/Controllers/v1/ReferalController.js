"use strict";

const path = require("path");
const fs = require("fs");
const slugify = require("slugify");
const json = require("../../../Traits/ApiResponser"); // Your custom response helper
const db = require("../../../Models/index");
const { Op, where, Sequelize } = require("sequelize");
const createAndEmitNotification = require("../../../Traits/CreateAndEmitNotification");
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
    const { jobType, requestedDate, vehicleName, jobCategory, jobDescription } =
      req.body;
    const { id } = req.decoded;
    const { assignedToId } = req.params;
    validateRequiredFieldsSequentially(req.body, [
      "jobType",
      "vehicleName",
      "requestedDate",
      "jobDescription",
    ]);
    const user = await User.findByPk(id);
    const referral = await Referral.create({
      customerId: id,
      vehicleName: vehicleName,
      jobType: jobType,
      assignedToId: assignedToId,
      requestedDate: requestedDate,
      jobCategory,
      jobDescription,
    });
    createAndEmitNotification(
      {
        senderId: id,
        receiverId: assignedToId,
        type: "test_drive",
        content: `${user.fullname} requested a ${jobCategory} for ${vehicleName}`,
        referralId: referral.id,
      },
      io
    );
    return json.successResponse(res, "Requested successfully.", 200);
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
          model: User,
          as: "customer",
          attributes: { exclude: ["password"] },
        },
      ],
    });

    if (!Referral) {
      return json.errorResponse(res, "Repair Referral Not Fount", 404);
    }

    return json.showOne(res, ReferralDetails, 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

o.getAllReferrals = async function (req, res, next) {
  const { id } = req.decoded;
  const { status } = req.params;
  try {
    const Referrals = await Referral.findAll({
      where: { assignedToId: id, status: status },
      include: [
        {
          model: User,
          as: "customer",
          attributes: { exclude: [] },
        },
      ],
    });

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

o.getReferralsStats = async function (req, res, next) {
  try {
    const id = req.decoded.id; // logged-in user ID

    // Fetch all referrals created by this user
    const referrals = await Referral.findAll({
      where: { assignedToId: id },
      order: [["createdAt", "DESC"]],
    });

    // Calculate total count
    const totalReferrals = referrals.length;

    const statusStats = {
      new: referrals.filter((r) => r.status === "new").length,
      inprogress: referrals.filter((r) => r.status === "inprogress").length,
      completed: referrals.filter((r) => r.status === "completed").length,
    };

    return json.showOne(res, { totalReferrals, statusStats, referrals }, 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

o.getMostInDemandServices = async function (req, res, next) {
  try {
    const id = req.decoded.id;

    // Query to find top 4 most requested job categories for this user
    const topServices = await Referral.findAll({
      where: { assignedToId: id },
      attributes: [
        "jobCategory",
        [Sequelize.fn("COUNT", Sequelize.col("jobCategory")), "count"],
      ],
      group: ["jobCategory"],
      order: [[Sequelize.literal("count"), "DESC"]],
      limit: 4,
      raw: true,
    });

    // Format response
    return json.showOne(res, topServices, 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

module.exports = o;
