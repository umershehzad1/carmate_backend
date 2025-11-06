const express = require("express");
const router = express.Router();
const ChatBotController = require("../app/Http/Controllers/v1/ChatBot");

// POST /api/v1/chatbot - Main chatbot endpoint
router.post("/", ChatBotController.chatbot);

// POST /api/v1/chatbot/feedback - Submit feedback for chatbot response
router.post("/feedback", ChatBotController.submitFeedback);

module.exports = router;
