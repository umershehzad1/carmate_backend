"use strict";

const express = require("express");
const router = express.Router();
const notificationController = require("../app/Http/Controllers/v1/NotificationController");

/**
 * Middleware to attach socket.io instance to request (optional)
 * Example:
 *   app.use((req, res, next) => { req.io = io; next(); });
 */
const attachIO = (io) => (req, res, next) => {
  req.io = io;
  next();
};

// Create a notification
router.post("/", (req, res) =>
  notificationController.createNotification(req, res, req.io)
);

// Get all notifications for a user
router.get("/user/:userId", notificationController.getUserNotifications);

// Mark a notification as read
router.patch("/:notificationId/read", notificationController.markAsRead);

// Delete a notification
router.delete("/:notificationId", notificationController.deleteNotification);

// Send a message (creates message + notification)
router.post("/send-message", (req, res) =>
  notificationController.sendMessage(req, res, req.io)
);

module.exports = router;
