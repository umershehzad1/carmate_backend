const express = require("express");
const router = express.Router();
const ChatBotController = require("../app/Http/Controllers/v1/ChatBot");

// POST /api/v1/chatbot
router.post("/", ChatBotController.chatbot);

module.exports = router;
