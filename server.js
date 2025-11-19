"use strict";

require("dotenv").config();
const { port } = require("./config/app");
require("./config/connection");
const bodyParser = require("body-parser");
const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const cors = require("cors");

// ✅ Import all routes
const userRoutes = require("./routes/UserRoutes");
const vehicleRoutes = require("./routes/VehicleRoutes");
const testDriveRequestRoutes = require("./routes/TestDriveRequestsRoutes");
const contactRoutes = require("./routes/ContactRoutes");
const reportsRoutes = require("./routes/ReportsRoutes");
const dealerRoutes = require("./routes/DealerRoutes");
const referralRoutes = require("./routes/ReferralRoutes");
const repairRoutes = require("./routes/RepairRoutes");
const insuranceRoutes = require("./routes/InsuranceRoutes");
const advertisementRoutes = require("./routes/AdvertisementRoutes");
const subscriptionRoutes = require("./routes/SubscriptionRoutes");
const conversationRoutes = require("./routes/ConversationRoutes");
const messageRoutes = require("./routes/MessageRoutes");
const reviewRoutes = require("./routes/ReviewRoutes");
const packageRoutes = require("./routes/PackageRoutes");
const notificationsRoutes = require("./routes/NotificationRoutes");
const stripeWebhookRoutes = require("./routes/StripeWebhook");

const walletRoutes = require("./routes/WalletRoutes");
const chatBotRoutes = require("./routes/ChatBotRoutes");
const chatbotAnalyticsRoutes = require("./routes/ChatbotAnalyticsRoutes");
const knowledgeBaseRoutes = require("./routes/KnowledgeBaseRoutes");

const app = express();

// ✅ 1. CORS first
app.use(
  cors({
    origin: "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-access-token",
      "x-device-id",
    ],
  })
);

// ✅ 2. WEBHOOK FIRST (needs raw body, before JSON parser)
app.use("/api/stripe", stripeWebhookRoutes);

// ✅ 3. BODY PARSERS (JSON, URL-encoded)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
// ✅ 4. Static files
app.use(express.static(path.join(__dirname, "public")));

// ✅ 5. CronJobs
require("./cronjobs/clearOldNotifications");
require("./cronjobs/manageAdvertisements");
require("./cronjobs/vehicleScraper");

// ✅ 6. ALL OTHER ROUTES
app.use("/api/v1/user", userRoutes);
app.use("/api/v1/vehicle", vehicleRoutes);
app.use("/api/v1/testdriverequest", testDriveRequestRoutes);
app.use("/api/v1/contact", contactRoutes);
app.use("/api/v1/report", reportsRoutes);
app.use("/api/v1/dealer", dealerRoutes);
app.use("/api/v1/referral", referralRoutes);
app.use("/api/v1/repair", repairRoutes);
app.use("/api/v1/insurance", insuranceRoutes);
app.use("/api/v1/advertisement", advertisementRoutes);
app.use("/api/v1/subscriptions", subscriptionRoutes);
app.use("/api/v1/review", reviewRoutes);
app.use("/api/v1/package", packageRoutes);
app.use("/api/v1/notifications", notificationsRoutes);
app.use("/api/v1/conversation", conversationRoutes);
app.use("/api/v1/message", messageRoutes);
app.use("/api/v1/wallet", walletRoutes);
app.use("/api/v1/chatbot", chatBotRoutes);
app.use("/api/v1/chatbot-analytics", chatbotAnalyticsRoutes);
app.use("/api/v1/knowledgebase", knowledgeBaseRoutes);
// ✅ HTTP Server & Socket.io Setup
const server = http.createServer(app);

global.io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// Handle user connections
global.io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join_room", (userId) => {
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined user_${userId}`);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// Start server
server.listen(port, () => {
  console.log("Socket is running on port " + port);
});

// Error handling
server.on("error", (error) => {
  if (error.syscall !== "listen") throw error;
  const bind = typeof port === "string" ? "Pipe " + port : "Port " + port;

  switch (error.code) {
    case "EACCES":
      console.error(bind + " requires elevated privileges");
      process.exit(1);
      break;
    case "EADDRINUSE":
      console.error(bind + " is already in use");
      process.exit(1);
      break;
    default:
      throw error;
  }
});

server.on("listening", () => {
  const addr = server.address();
  const bind = typeof addr === "string" ? "pipe " + addr : "port " + addr.port;
  console.log("Server is Listening on " + bind);
});
