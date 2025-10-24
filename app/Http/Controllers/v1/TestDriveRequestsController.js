"use strict";

const path = require("path");
const fs = require("fs");
const slugify = require("slugify");
const json = require("../../../Traits/ApiResponser"); // Your custom response helper
const db = require("../../../Models/index");
const { Op, where } = require("sequelize");
const TestDriveRequest = db.TestDriveRequest;
const Vehicle = db.Vehicle;
const User = db.User;
const Notifications = db.Notifications;
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
const createAndEmitNotification = async (data, io) => {
  const {
    receiverId,
    senderId,
    type,
    content,
    messageId,
    testDriveRequestId,
    referralId,
  } = data;

  try {
    const notification = await Notifications.create({
      receiverId,
      senderId,
      type,
      content,
      messageId: messageId || null,
      testDriveRequestId: testDriveRequestId || null,
      referralId: referralId || null,
      isRead: false,
    });

    // Emit real-time notification
    if (io) {
      io.to(`user_${receiverId}`).emit("new_notification", notification);
    }

    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
};

o.addTestDriveRequest = async function (req, res, io) {
  try {
    const { vehicleId, requestedDate } = req.body;
    const userId = req.decoded.id;

    validateRequiredFieldsSequentially(req.body, [
      "vehicleId",
      "requestedDate",
    ]);

    const vehicle = await Vehicle.findByPk(vehicleId);
    if (!vehicle) {
      return json.errorResponse(res, "Vehicle not found", 404);
    }

    const user = await User.findByPk(userId);

    const testDriveRequest = await TestDriveRequest.create({
      vehicleId: vehicleId,
      userId: userId,
      requestedDate,
    });

    // Send notification using helper
    await createAndEmitNotification(
      {
        senderId: userId,
        receiverId: vehicle.dealerId,
        type: "test_drive",
        content: `${user.fullname} requested a test drive for ${vehicle.name}`,
        testDriveRequestId: testDriveRequest.id,
      },
      io
    );

    return json.successResponse(res, "Test Drive Requested Successfully.", 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

o.getAllTestDriveRequests = async function (req, res) {
  try {
    // Ensure only dealers can access this
    if (req.decoded.role !== "dealer") {
      return json.errorResponse(res, "Unauthorized access", 401);
    }

    const dealerId = req.decoded.id;

    const testDriveRequests = await TestDriveRequest.findAll({
      include: [
        {
          model: Vehicle,
          as: "vehicle",
          where: { dealerId: dealerId }, // Filter by dealerId
          attributes: { exclude: [] }, // Include all attributes
        },
        {
          model: User,
          as: "customer", // Include user (customer) details if needed
          attributes: ["id", "fullname", "email", "phone", "image"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    if (!testDriveRequests || testDriveRequests.length === 0) {
      return json.errorResponse(res, "No Test Drive Requests Found", 404);
    }

    return json.showAll(res, testDriveRequests, 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

o.getTestDriveRequestDetails = async function (req, res, next) {
  try {
    const { id } = req.params;
    const testDriveRequest = await TestDriveRequest.findByPk(id, {
      include: [
        {
          model: Vehicle,
          as: "vehicle",
          attributes: { exclude: [] },
        },
        {
          model: User,
          as: "customer",
          attributes: { exclude: [] },
        },
      ],
    });
    if (!testDriveRequest) {
      return json.errorResponse(res, "Test Drive Request not found", 404);
    }
    return json.showOne(res, testDriveRequest, 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

module.exports = o;
