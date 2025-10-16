"use strict";

const express = require("express");
const router = express.Router();
const MessageController = require("../app/Http/Controllers/v1/MessageController");
const { authenticate } = require("../app/Http/Controllers/v1/AuthController");

// -------------------------------------
// Message Routes
// -------------------------------------

// Send a new message (auto-creates conversation if not exists)
router.post("/send", authenticate, MessageController.sendMessage);

// Get all messages in a specific conversation
router.get(
  "/conversation/:conversationId",
  authenticate,
  MessageController.getMessagesByConversation
);

// Mark a specific message as read
router.put("/read/:id", authenticate, MessageController.markAsRead);

// Delete a specific message
router.delete("/:id", authenticate, MessageController.deleteMessage);

// Get unread message count for a user
router.get("/unread/:userId", authenticate, MessageController.getUnreadCount);

module.exports = router;
