"use strict";

const path = require("path");
const fs = require("fs");
const slugify = require("slugify");
const json = require("../../../Traits/ApiResponser"); // Your custom response helper
const db = require("../../../Models/index");
const { Op, where } = require("sequelize");
const ReportedContent = db.ReportedContent;
const Vehicle = db.Vehicle;
const Dealer = db.Dealer;
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

o.createReport = async function (req, res, next) {
  try {
    const { vehicleId } = req.body; // Vehicle ID

    // Step 1: Verify that the vehicle exists
    const vehicle = await Vehicle.findByPk(vehicleId);
    if (!vehicle) {
      return json.errorResponse(res, "Vehicle not found", 404);
    }

    // Step 2: Check if a report already exists for this vehicle
    let reportedContent = await ReportedContent.findOne({
      where: { vehicleId: vehicleId },
    });

    // Step 3: If found, increment the reports count
    if (reportedContent) {
      reportedContent.reports += 1;
      await reportedContent.save();
    } else {
      // Step 4: Otherwise, create a new report record
      reportedContent = await ReportedContent.create({
        vehicleId: vehicleId,
        reports: 1,
      });
    }

    return json.successResponse(res, "Report recorded successfully.", 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

o.getReportDetails = async function (req, res, next) {
  try {
    const { id } = req.params;
    const report = await ReportedContent.findByPk(id);
    if (!report) {
      return json.errorResponse(res, "Report not found", 404);
    }
    return json.showOne(res, report, 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

o.getAllReports = async function (req, res, next) {
  try {
    const reports = await ReportedContent.findAll({
      include: [
        {
          model: Vehicle,
          as: "vehicle",
          include: [
            {
              model: User,
              as: "user",
              include: [
                {
                  model: Dealer,
                  as: "dealer",
                },
              ],
            },
          ],
        },
      ],
    });
    if (!reports) {
      return json.errorResponse(res, "No reports found", 404);
    }
    return json.showAll(res, reports, 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

module.exports = o;
