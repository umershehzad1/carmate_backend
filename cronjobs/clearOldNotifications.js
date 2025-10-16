"use strict";

const cron = require("node-cron");
const { Op } = require("sequelize");
// Your custom response helper
const db = require("../app/Models/index");
const Notification = db.Notifications;

// ─────────────────────────────
// CRON JOB: Delete old notifications
// Runs every day at midnight (00:00)
// ─────────────────────────────
cron.schedule("0 0 * * *", async () => {
  try {
    console.log("🧹 Running scheduled cleanup for old notifications...");

    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    // Delete notifications older than 1 month
    const deletedCount = await Notification.destroy({
      where: {
        createdAt: {
          [Op.lt]: oneMonthAgo,
        },
      },
    });

    console.log(`✅ Deleted ${deletedCount} old notifications.`);
  } catch (error) {
    console.error("❌ Error while cleaning old notifications:", error);
  }
});
