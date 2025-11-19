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
    
    console.log("⚙️  Starting scraper orchestrator...\n");
    
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
