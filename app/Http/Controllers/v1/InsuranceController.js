"use strict";

const path = require("path");
const fs = require("fs");
const slugify = require("slugify");
const json = require("../../../Traits/ApiResponser"); // Your custom response helper
const db = require("../../../Models/index");
const { Op, where } = require("sequelize");
const Insurance = db.Insurance;
const Vehicle = db.Vehicle;
const Referral = db.Referral;
const Subscription = db.Subscription;
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

o.getInsuranceStats = async function (req, res, next) {
  try {
    const user = req.decoded;

    // Validate user role
    if (user.role !== "insurance") {
      return json.errorResponse(
        res,
        "You are not authorized to perform this action",
        403
      );
    }

    // Fetch all referrals assigned to the current user
    const referrals = await Referral.findAll({
      where: { assignedToId: user.id },
    });

    if (!referrals || referrals.length === 0) {
      return json.showOne(
        res,
        {
          totalReferrals: 0,
          referralsByStatus: {
            new: 0,
            inProgress: 0,
            completed: 0,
          },
          costPerLead: 0,
          roi: 0,
          totalSubscriptionCost: "$0.00",
          subscriptionCount: 0,
          chartData: generateEmptyChartData(),
          message: "No referrals found",
        },
        200
      );
    }

    // Count referrals by status
    const referralsByStatus = {
      new: referrals.filter((r) => r.status === "new").length,
      inProgress: referrals.filter((r) => r.status === "in progress").length,
      completed: referrals.filter((r) => r.status === "completed").length,
    };

    const totalReferrals = referrals.length;

    // Fetch all subscriptions for the current user
    const subscriptions = await Subscription.findAll({
      where: { userId: user.id },
    });

    // Calculate total subscription cost
    let totalSubscriptionCost = 0;

    if (subscriptions && subscriptions.length > 0) {
      subscriptions.forEach((subscription) => {
        // Remove $ and convert to number
        const price = parseFloat(subscription.price.replace("$", ""));
        totalSubscriptionCost += price;
      });
    }

    // Calculate cost per lead
    const costPerLead =
      totalReferrals > 0
        ? (totalSubscriptionCost / totalReferrals).toFixed(2)
        : 0;

    // Calculate ROI
    const completedReferrals = referralsByStatus.completed;
    const roi =
      totalSubscriptionCost > 0
        ? (
            ((completedReferrals * costPerLead - totalSubscriptionCost) /
              totalSubscriptionCost) *
            100
          ).toFixed(2)
        : 0;

    // Generate chart data for all 12 months
    const chartData = generateChartDataForAllMonths(referrals);

    const analyticsData = {
      totalReferrals,
      referralsByStatus,
      totalSubscriptionCost: `$${totalSubscriptionCost.toFixed(2)}`,
      costPerLead: `$${costPerLead}`,
      roi: `${roi}%`,
      subscriptionCount: subscriptions.length,
      chartData: chartData,
    };

    return json.showOne(res, analyticsData, 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

// Helper function to generate empty chart data for all 12 months
function generateEmptyChartData() {
  return [
    { month: "JAN", value: 0 },
    { month: "FEB", value: 0 },
    { month: "MAR", value: 0 },
    { month: "APR", value: 0 },
    { month: "MAY", value: 0 },
    { month: "JUN", value: 0 },
    { month: "JUL", value: 0 },
    { month: "AUG", value: 0 },
    { month: "SEP", value: 0 },
    { month: "OCT", value: 0 },
    { month: "NOV", value: 0 },
    { month: "DEC", value: 0 },
  ];
}

// Helper function to generate chart data for all 12 months of current year
function generateChartDataForAllMonths(referrals) {
  const monthNames = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];

  // Initialize all months with 0 for current year
  const monthCounts = {};
  monthNames.forEach((m) => (monthCounts[m] = 0));

  const now = new Date();
  const currentYear = now.getFullYear();

  // Count referrals by month for the current year
  referrals.forEach((referral) => {
    if (!referral.createdAt) return;

    const referralDate = new Date(referral.createdAt);
    const referralYear = referralDate.getFullYear();
    const referralMonth = referralDate.getMonth(); // 0-11

    // Only count referrals from the current year
    if (referralYear === currentYear) {
      const monthName = monthNames[referralMonth];
      monthCounts[monthName]++;
    }
  });

  // Return data for all 12 months in order
  return monthNames.map((month) => ({
    month: month,
    value: monthCounts[month],
  }));
}

module.exports = o;
