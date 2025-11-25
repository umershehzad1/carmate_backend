"use strict";

const cron = require("node-cron");
const ScraperOrchestrator = require("../app/Scrapper/ScraperOrchestrator");

/**
 * Vehicle Scraper Cron Job
 * Runs periodically to scrape vehicle data from configured sources
 */

let isRunning = false;

async function runVehicleScraper() {
  // Prevent multiple concurrent runs
  if (isRunning) {
    console.log("⚠️  Scraper is already running. Skipping this execution.");
    return;
  }

  isRunning = true;

  try {
    console.log("\n" + "=".repeat(70));
    console.log("🌙 [NIGHTLY SCRAPER] Starting vehicle scraper at 11 PM...");
    console.log("=".repeat(70) + "\n");

    const orchestrator = new ScraperOrchestrator();
    await orchestrator.run();

    console.log("\n✅ [NIGHTLY SCRAPER] Vehicle scraper completed successfully!\n");
  } catch (error) {
    console.error("\n❌ [NIGHTLY SCRAPER] Scraper failed with error:", error);
    console.error("Stack trace:", error.stack);
  } finally {
    isRunning = false;
  }
}

// ─────────────────────────────
// SCHEDULE CRON JOB
// ─────────────────────────────

// Run every 5 minutes
// Cron format: "*/5 * * * *"
// Minutes Hours Day Month DayOfWeek
cron.schedule("0 23 * * *", async () => {
  const orchestrator = new ScraperOrchestrator();
  // Ensure we run 33 vehicles per scraper for each nightly cron execution
  orchestrator.globalMaxVehicles = (orchestrator.scrapers.length || 1) * 33;
  console.log(`🧭 Running vehicle scraper: target ${orchestrator.globalMaxVehicles} vehicles (${orchestrator.scrapers.length} scrapers, 33 each)`);
  await orchestrator.run();
});

// For testing: Run every 5 minutes (uncomment when needed)
// cron.schedule("*/5 * * * *", async () => {
//   console.log("🧪 [TEST MODE] Running scraper every 5 minutes for testing...");
//   await runVehicleScraper();
// });

console.log("✅ Vehicle scraper cronjob initialized.");
console.log("   - Scheduled to run nightly at 11:00 PM (server timezone)");
console.log("   - Scrapes vehicles from AutoTrader, Steele (SteeleFord), and Oregan");
console.log("   - Kijiji scraper is intentionally excluded");
console.log("   - Creates dealer accounts (role: dealer) and dealer profiles");
console.log("   - Creates vehicles with base advertisements automatically (33 per scraper by default)");

// Export for manual execution if needed
module.exports = {
  runVehicleScraper,
};
