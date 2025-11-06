"use strict";

const cron = require("node-cron");
const { Op } = require("sequelize");
const db = require("../app/Models/index");
const Advertisement = db.Advertisement;
const Wallet = db.Wallet;

async function checkAndStopExpiredAds() {
  try {
    console.log("🔍 Checking for expired advertisements...");

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today

    // Find all running ads where end date has passed
    const expiredAds = await Advertisement.findAll({
      where: {
        status: "running",
        endDate: {
          [Op.lt]: today, // End date is before today
        },
        adType: {
          [Op.in]: ["sponsored", "featured"], // Only check ads with end dates
        },
      },
    });

    if (expiredAds.length > 0) {
      console.log(
        `⏰ Found ${expiredAds.length} expired ads. Stopping them...`
      );

      // Update all expired ads
      for (const ad of expiredAds) {
        await ad.update({
          status: "stopped",
          pauseReason: "system",
        });

        console.log(
          `✅ Stopped ad ID ${ad.id} (vehicleId: ${ad.vehicleId}) - End date passed`
        );
      }
    } else {
      console.log("✅ No expired ads found.");
    }
  } catch (error) {
    console.error("❌ Error while checking expired ads:", error);
  }
}

// Function to check and stop ads that reached daily budget
async function checkDailyBudgetLimits() {
  try {
    console.log("💰 Checking ads that reached daily budget...");

    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const costPerClick = 0.1; // $0.10 per click

    // Find all running sponsored ads
    const runningAds = await Advertisement.findAll({
      where: {
        status: "running",
        adType: "sponsored",
        lastClickDate: today,
      },
    });

    let stoppedCount = 0;

    for (const ad of runningAds) {
      const dailySpent = (ad.clicksToday || 0) * costPerClick;
      const dailyBudget = parseFloat(ad.dailyBudget || 0);

      // If daily budget has been reached or exceeded
      if (dailySpent >= dailyBudget && dailyBudget > 0) {
        await ad.update({
          status: "stopped",
          pauseReason: "budget",
        });

        stoppedCount++;
        console.log(
          `✅ Stopped ad ID ${ad.id} - Daily budget reached ($${dailySpent.toFixed(
            2
          )}/$${dailyBudget})`
        );
      }
    }

    if (stoppedCount > 0) {
      console.log(`💰 Stopped ${stoppedCount} ads due to budget limits.`);
    } else {
      console.log("✅ No ads reached their daily budget limit.");
    }
  } catch (error) {
    console.error("❌ Error while checking daily budget limits:", error);
  }
}

// Function to reset daily click counters at midnight
async function resetDailyClickCounters() {
  try {
    console.log("🔄 Resetting daily click counters for all ads...");

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    // Find all ads that have yesterday's date in lastClickDate
    const adsToReset = await Advertisement.findAll({
      where: {
        adType: "sponsored",
        lastClickDate: {
          [Op.lte]: yesterdayStr,
        },
      },
    });

    let resetCount = 0;

    for (const ad of adsToReset) {
      // Reset daily counters
      await ad.update({
        clicksToday: 0,
        userClicks: [], // Clear the user clicks array for new day
      });

      // If ad was stopped due to budget, resume it
      if (ad.status === "stopped" && ad.pauseReason === "budget") {
        // Check if ad hasn't expired
        if (!ad.endDate || new Date(ad.endDate) >= new Date()) {
          await ad.update({
            status: "running",
            pauseReason: "none",
          });

          console.log(`▶️ Resumed ad ID ${ad.id} - New day, budget reset`);
        }
      }

      resetCount++;
    }

    if (resetCount > 0) {
      console.log(`🔄 Reset ${resetCount} ad counters for the new day.`);
    } else {
      console.log("✅ No ad counters needed resetting.");
    }
  } catch (error) {
    console.error("❌ Error while resetting daily click counters:", error);
  }
}

// ─────────────────────────────
// SCHEDULE CRON JOBS
// ─────────────────────────────

// Run every hour to check for expired ads
cron.schedule("0 * * * *", async () => {
  console.log("\n🕐 [HOURLY] Running advertisement management checks...");
  await checkAndStopExpiredAds();
  await checkDailyBudgetLimits();
  console.log("✅ [HOURLY] Advertisement management checks completed.\n");
});

// Run at midnight (00:00) every day to reset daily counters
cron.schedule("0 0 * * *", async () => {
  console.log("\n🌙 [MIDNIGHT] Running daily advertisement reset...");
  await resetDailyClickCounters();
  console.log("✅ [MIDNIGHT] Daily advertisement reset completed.\n");
});

console.log("✅ Advertisement management cronjobs initialized.");
console.log("   - Hourly check for expired ads and budget limits");
console.log("   - Midnight reset for daily click counters");

module.exports = {
  checkAndStopExpiredAds,
  checkDailyBudgetLimits,
  resetDailyClickCounters,
};
