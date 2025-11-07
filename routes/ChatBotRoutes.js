const express = require("express");
const router = express.Router();
const ChatBotController = require("../app/Http/Controllers/v1/ChatBot");
const KnowledgeBaseController = require("../app/Http/Controllers/v1/KnowledgeBaseController");

// POST /api/v1/chatbot - Main chatbot endpoint
router.post("/", ChatBotController.chatbot);

// POST /api/v1/chatbot/feedback - Submit feedback for chatbot response
router.post("/feedback", ChatBotController.submitFeedback);

// GET /api/v1/chatbot/faqs - Get FAQs for chatbot
router.get("/faqs", KnowledgeBaseController.getFAQs);

module.exports = router;
