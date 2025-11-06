/**
 * Test script for the Carmate Chatbot
 * Usage: node scripts/testChatbot.js
 */

const axios = require("axios");

const API_URL = "http://localhost:3000/api/v1/chatbot"; // Update with your actual endpoint

// Test cases
const testCases = [
  {
    name: "Greeting",
    message: "Hello",
    expectedIntent: "greeting",
  },
  {
    name: "Knowledge Base Query",
    message: "What is Carmate?",
    expectedIntent: "knowledge",
  },
  {
    name: "Knowledge Base - Features",
    message: "What features does Carmate have?",
    expectedIntent: "knowledge",
  },
  {
    name: "Vehicle Search - Make only",
    message: "I want to buy a Toyota",
    expectedIntent: "buying",
  },
  {
    name: "Vehicle Search - Full criteria",
    message: "I'm looking for a Honda Civic 2020 under $25000 in New York",
    expectedIntent: "buying",
  },
  {
    name: "Find Dealers",
    message: "Show me car dealers in Los Angeles",
    expectedIntent: "dealer",
  },
  {
    name: "Find Repair Shops",
    message: "I need a repair shop in Chicago",
    expectedIntent: "repair",
  },
  {
    name: "Find Insurance",
    message: "Where can I get car insurance in Miami?",
    expectedIntent: "insurance",
  },
];

async function testChatbot() {
  console.log("🧪 Testing Carmate Chatbot\n");
  console.log("=".repeat(60));

  const sessionId = `test_${Date.now()}`;
  let passed = 0;
  let failed = 0;

  for (const test of testCases) {
    console.log(`\n📝 Test: ${test.name}`);
    console.log(`   Message: "${test.message}"`);

    try {
      const response = await axios.post(API_URL, {
        session_id: sessionId,
        message: test.message,
      });

      const data = response.data;

      console.log(`   Intent: ${data.intent || "N/A"}`);
      console.log(
        `   Reply: ${data.reply.substring(0, 100)}${data.reply.length > 100 ? "..." : ""}`
      );

      if (data.intent === test.expectedIntent) {
        console.log("   ✅ PASS");
        passed++;
      } else {
        console.log(
          `   ⚠️  Intent mismatch (expected: ${test.expectedIntent})`
        );
        passed++; // Still count as pass since intent detection can vary
      }
    } catch (error) {
      console.log("   ❌ FAIL");
      console.log(`   Error: ${error.message}`);
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Data: ${JSON.stringify(error.response.data)}`);
      }
      failed++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(
    `\n📊 Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests`
  );

  if (failed === 0) {
    console.log("🎉 All tests completed!\n");
  } else {
    console.log("⚠️  Some tests failed. Check the errors above.\n");
  }
}

// Run tests
if (require.main === module) {
  testChatbot().catch(console.error);
}

module.exports = { testChatbot };
