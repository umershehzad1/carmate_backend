"use strict";

require("dotenv").config();
const { port } = require("./config/app");
require("./config/connection");

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

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

// Notifications & Messaging routes
const notificationsRoutes = require("./routes/NotificationRoutes");

const app = express();

app.use("/api/stripe", require("./routes/StripeWebhook"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
require("./cronjobs/clearOldNotifications");
// API Routes
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

// Notifications & Messaging Routes
app.use("/api/v1/notifications", notificationsRoutes);
app.use("/api/v1/conversation", conversationRoutes);
app.use("/api/v1/message", messageRoutes);
// HTTP Server & Socket.io Setup
const server = http.createServer(app);

global.io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// Handle user connections
global.io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Join user's personal room for notifications
  socket.on("join_room", (userId) => {
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined room user_${userId}`);
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// Start server
server.listen(port, () => {
  console.log("Socket is running on port " + port);
});

// Error handling (attach to server, not app)
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
