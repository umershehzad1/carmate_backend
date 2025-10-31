"use strict";

const path = require("path");
const fs = require("fs");
const slugify = require("slugify");
const json = require("../../../Traits/ApiResponser"); // Your custom response helper
const db = require("../../../Models/index");
const { Op, where } = require("sequelize");

const Notifications = db.Notifications;
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
    const {
      receiverId,
      type,
      content,
      messageId,
      testDriveRequestId,
      referralId,
    } = req.body;

    validateRequiredFieldsSequentially(req.body, ["userId", "type", "content"]);

    const notification = await Notifications.create({
      senderId: req.decoded.id,
      receiverId: receiverId,
      type,
      content,
      messageId: messageId || null,
      testDriveRequestId: testDriveRequestId || null,
      referralId: referralId || null,
    });

    // Emit real-time notification via Socket.io
    if (io) {
      io.to(`user_${receiverId}`).emit("new_notification", notification);
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
    const userId = req.decoded.id;

    // Pagination setup
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Fetch notifications with ordering: unread first, then read (latest first within each group)
    const { count, rows: notifications } = await Notifications.findAndCountAll({
      where: { receiverId: userId },
      include: [
        { model: Message, as: "message" },
        {
          model: User,
          as: "sender",
          attributes: ["id", "fullname", "email", "phone", "image"],
        },
        {
          model: User,
          as: "receiver",
          attributes: ["id", "fullname", "email", "phone", "image"],
        },
      ],
      order: [
        ["isRead", "ASC"], // Unread first (false before true)
        ["createdAt", "DESC"], // Latest first within each group
      ],
      limit,
      offset,
    });

    // Count unread and read notifications separately
    const unreadCount = await Notifications.count({
      where: { receiverId: userId, isRead: false },
    });
    const readCount = await Notifications.count({
      where: { receiverId: userId, isRead: true },
    });

    return json.showAll(
      res,
      {
        notifications,
        pagination: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
        },
        summary: {
          unreadCount,
          readCount,
        },
      },
      200
    );
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

    const notification = await Notifications.findByPk(notificationId);
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

    const deleted = await Notifications.destroy({
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
