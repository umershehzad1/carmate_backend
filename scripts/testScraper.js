"use strict";

/**
 * Manual Test Script for Vehicle Scraper
 * Run this script to manually test the scraper without waiting for the cronjob
 * 
 * Usage:
 *   node scripts/testScraper.js
 */

require("dotenv").config();
const ScraperOrchestrator = require("../app/Scrapper/ScraperOrchestrator");

async function testScraper() {
  console.log("\n" + "=".repeat(70));
  console.log("🧪 MANUAL SCRAPER TEST");
  console.log("=".repeat(70) + "\n");

  try {
    const orchestrator = new ScraperOrchestrator();

    // For testing: limit every configured scraper to 5 vehicles (and small page runs when supported)
    orchestrator.scrapers.forEach((s) => {
      if (typeof s.maxVehicles !== "undefined") s.maxVehicles = 5;
      if (typeof s.maxPages !== "undefined") s.maxPages = 1;
    });

    console.log("⚙️  Starting scraper orchestrator (TEST MODE: all scrapers limited to 5 vehicles each)...\n");

    await orchestrator.run();
    
    console.log("\n✅ Scraper test completed successfully!");
    console.log("\n📊 Check the database for scraped vehicles and dealers.\n");
    
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Scraper test failed:");
    console.error(error);
    console.error("\nStack trace:", error.stack);
    
    process.exit(1);
  }
}

// Run the test
testScraper();
