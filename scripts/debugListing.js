"use strict";

/**
 * Debug Listing Page HTML
 */

require("dotenv").config();
const axios = require("axios");
const cheerio = require("cheerio");

async function debugListing() {
  console.log("\n🧪 Debugging listing page HTML...\n");

  try {
    const response = await axios.get("https://www.autotrader.ca/cars/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      timeout: 30000,
    });

    const $ = cheerio.load(response.data);
    
    // Find first vehicle listing
    const selectors = [
      "[class*='result-item']",
      "[class*='listing']",
      "[class*='vehicle']",
      "[data-testid*='listing']",
      "article",
    ];

    for (const selector of selectors) {
      const listings = $(selector);
      if (listings.length > 0) {
        console.log(`\n✅ Found ${listings.length} listings with selector: ${selector}\n`);
        
        const firstListing = listings.first();
        console.log("First listing HTML (first 2000 chars):");
        console.log("─".repeat(70));
        console.log(firstListing.html().substring(0, 2000));
        console.log("─".repeat(70));
        
        // Try to extract details
        console.log("\n📋 Attempting to extract details from first listing:\n");
        
        const title = firstListing.find("h2, .title, [class*='title'], a[class*='title']").first().text().trim();
        console.log(`Title: ${title || "NOT FOUND"}`);
        
        const price = firstListing.find("[class*='price'], .price-amount").first().text().trim();
        console.log(`Price: ${price || "NOT FOUND"}`);
        
        const location = firstListing.find("[class*='location'], .dealer-address").first().text().trim();
        console.log(`Location: ${location || "NOT FOUND"}`);
        
        console.log(`\nAll text from listing (first 500 chars):`);
        console.log(firstListing.text().trim().substring(0, 500));
        
        break;
      }
    }
    
    console.log("\n✅ Debug completed\n");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Debug failed:", error.message);
    process.exit(1);
  }
}

debugListing();
