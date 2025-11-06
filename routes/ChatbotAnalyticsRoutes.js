const express = require("express");
const router = express.Router();
const AnalyticsController = require("../app/Http/Controllers/v1/ChatbotAnalytics");
const authCtrl = require("../app/Http/Controllers/v1/AuthController");

// All analytics routes require authentication and admin role
router.use(authCtrl.authenticate, authCtrl.isAdmin);

// GET /api/v1/chatbot-analytics/dashboard-stats - Overall dashboard statistics
router.get("/dashboard-stats", AnalyticsController.getDashboardStats);

// GET /api/v1/chatbot-analytics/top-searches - Top searched makes/models
router.get("/top-searches", AnalyticsController.getTopSearches);

// GET /api/v1/chatbot-analytics/city-wise-requests - City-wise repair/insurance requests
router.get("/city-wise-requests", AnalyticsController.getCityWiseRequests);

// GET /api/v1/chatbot-analytics/satisfaction - Chatbot satisfaction metrics (thumbs up/down)
router.get("/satisfaction", AnalyticsController.getSatisfactionMetrics);

// GET /api/v1/chatbot-analytics/message-volume - Message volume per day
router.get("/message-volume", AnalyticsController.getMessageVolume);

// GET /api/v1/chatbot-analytics/intent-distribution - FAQ hits vs GPT responses
router.get("/intent-distribution", AnalyticsController.getIntentDistribution);

module.exports = router;
