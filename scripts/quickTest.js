"use strict";

/**
 * Quick Test - Single Vehicle
 */

require("dotenv").config();
const AutoTraderScraper = require("../app/Scrapper/AutoTraderScraper");

async function quickTest() {
  console.log("\n🧪 Testing single vehicle scraping with debug output...\n");

  const scraper = new AutoTraderScraper();
  
  try {
    // Scrape just the first page
    const vehicles = await scraper.scrape(1);
    
    if (vehicles && vehicles.length > 0) {
      const firstVehicle = vehicles[0];
      console.log("\n📋 First vehicle data:");
      console.log(JSON.stringify(firstVehicle, null, 2));
    }
    
    console.log("\n✅ Test completed\n");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

quickTest();
