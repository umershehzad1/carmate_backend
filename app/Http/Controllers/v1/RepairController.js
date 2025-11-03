"use strict";

const path = require("path");
const fs = require("fs");
const slugify = require("slugify");
const json = require("../../../Traits/ApiResponser"); // Your custom response helper
const db = require("../../../Models/index");
const { Op, where } = require("sequelize");
const Repair = db.Repair;
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

o.getRepairStats = async function (req, res, next) {
  try {
    const user = req.decoded;

    // Validate user role
    if (user.role !== "repair") {
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
          statusStats: {
            new: 0,
            inprogress: 0,
            completed: 0,
          },
          conversionRate: "0%",
          averageJobValue: "$0.00",
          totalJobValue: "$0.00",
          chartData: generateEmptyChartData(),
          message: "No referrals found",
        },
        200
      );
    }

    // Count referrals by status
    const statusStats = {
      new: referrals.filter((r) => r.status === "new" || r.status === "New")
        .length,
      inprogress: referrals.filter(
        (r) =>
          r.status === "in progress" ||
          r.status === "inprogress" ||
          r.status === "In Progress"
      ).length,
      completed: referrals.filter(
        (r) => r.status === "completed" || r.status === "Completed"
      ).length,
    };

    const totalReferrals = referrals.length;

    // Calculate conversion rate
    // Converted referrals are those in progress or completed
    const convertedReferrals = statusStats.inprogress + statusStats.completed;
    const conversionRate =
      totalReferrals > 0
        ? ((convertedReferrals / totalReferrals) * 100).toFixed(2)
        : 0;

    // Calculate average job value from completed referrals
    const completedReferrals = referrals.filter(
      (r) => r.status === "completed" || r.status === "Completed"
    );
    let totalJobValue = 0;
    let averageJobValue = 0;

    if (completedReferrals.length > 0) {
      completedReferrals.forEach((referral) => {
        // Assuming there's a jobValue or value field in the referral
        const jobValue = parseFloat(referral.jobValue || referral.value || 0);
        totalJobValue += jobValue;
      });
      averageJobValue = (totalJobValue / completedReferrals.length).toFixed(2);
    }

    // Generate chart data for all 12 months
    const chartData = generateChartDataForAllMonths(referrals);

    const analyticsData = {
      totalReferrals: totalReferrals,
      statusStats: statusStats,
      conversionRate: `${conversionRate}%`,
      averageJobValue: `$${parseFloat(averageJobValue).toFixed(2)}`,
      totalJobValue: `$${parseFloat(totalJobValue).toFixed(2)}`,
      chartData: chartData,
    };

    return json.showOne(res, analyticsData, 200);
  } catch (error) {
    console.error("Error in getRepairStats:", error);
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

    try {
      const referralDate = new Date(referral.createdAt);
      const referralYear = referralDate.getFullYear();
      const referralMonth = referralDate.getMonth(); // 0-11

      // Only count referrals from the current year
      if (referralYear === currentYear) {
        const monthName = monthNames[referralMonth];
        monthCounts[monthName]++;
      }
    } catch (err) {
      console.error("Error parsing date:", referral.createdAt, err);
    }
  });

  // Return data for all 12 months in order
  return monthNames.map((month) => ({
    month: month,
    value: monthCounts[month],
  }));
}
module.exports = o;
