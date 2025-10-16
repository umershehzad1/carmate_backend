"use strict";

const path = require("path");
const fs = require("fs");
const slugify = require("slugify");
const json = require("../../../Traits/ApiResponser"); // Your custom response helper
const db = require("../../../Models/index");
const { Op, where } = require("sequelize");

const Notification = db.Notifications;
const Message = db.Message;
const Conversation = db.Conversation;
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

/**
 * Create a notification
 * Optional: messageId, testDriveRequestId, referralId depending on type
 */
o.createNotification = async (req, res, io) => {
  try {
    const { userId, type, content, messageId, testDriveRequestId, referralId } =
      req.body;

    validateRequiredFieldsSequentially(req.body, ["userId", "type", "content"]);

    const notification = await Notification.create({
      userId,
      type,
      content,
      messageId: messageId || null,
      testDriveRequestId: testDriveRequestId || null,
      referralId: referralId || null,
    });

    // Emit real-time notification via Socket.io
    if (io) {
      io.to(`user_${userId}`).emit("new_notification", notification);
    }

    return json.successResponse(
      res,
      "Notification created successfully.",
      201,
      notification
    );
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

/**
 * Get all notifications for a user
 */
o.getUserNotifications = async (req, res) => {
  try {
    const { userId } = req.params;

    const notifications = await Notification.findAll({
      where: { userId },
      include: [{ model: Message, as: "message" }],
      order: [["createdAt", "DESC"]],
    });

    return json.showAll(res, notifications, 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

/**
 * Mark a notification as read
 */
o.markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findByPk(notificationId);
    if (!notification) {
      return json.errorResponse(res, "Notification not found", 404);
    }

    notification.isRead = true;
    await notification.save();

    return json.successResponse(
      res,
      "Notification marked as read.",
      200,
      notification
    );
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

/**
 * Delete a notification
 */
o.deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const deleted = await Notification.destroy({
      where: { id: notificationId },
    });
    if (!deleted) {
      return json.errorResponse(res, "Notification not found", 404);
    }

    return json.successResponse(res, "Notification deleted successfully.", 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

/**
 * Send a message and create a notification for the receiver
 * Real-time updates via socket.io
 */
o.sendMessage = async (req, res, io) => {
  try {
    const { senderId, receiverId, conversationId, content } = req.body;

    validateRequiredFieldsSequentially(req.body, [
      "senderId",
      "receiverId",
      "conversationId",
      "content",
    ]);

    // Create message
    const message = await Message.create({
      senderId,
      receiverId,
      conversationId,
      content,
      sentAt: new Date(),
      isRead: false,
    });

    // Create notification for receiver
    const notification = await Notification.create({
      userId: receiverId,
      type: "message",
      content: `New message from ${senderId}`,
      messageId: message.id,
    });

    // Emit real-time events
    if (io) {
      io.to(`user_${receiverId}`).emit("new_message", message);
      io.to(`user_${receiverId}`).emit("new_notification", notification);
    }

    return json.successResponse(
      res,
      "Message sent successfully.",
      201,
      message
    );
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

module.exports = o;
