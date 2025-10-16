"use strict";

const express = require("express");
const router = express.Router();
const ConversationController = require("../app/Http/Controllers/v1/ConversationController");
const { authenticate } = require("../app/Http/Controllers/v1/AuthController");

// -------------------------------------
// Conversation Routes
// -------------------------------------

router.post("/create-or-get", ConversationController.createOrGetConversation);
// Create or get existing conversation between two users

// Get all conversations for a specific user
router.get(
  "/userconversations",
  authenticate,
  ConversationController.getUserConversations
);

// Get a single conversation by ID (with messages)
router.get("/:id", ConversationController.getConversationById);

// Delete a specific conversation (and its messages)
router.delete("/:id", ConversationController.deleteConversation);

module.exports = router;
