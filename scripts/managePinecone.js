/**
 * Pinecone Management Utility
 * Usage:
 *   node scripts/managePinecone.js stats      - View index statistics
 *   node scripts/managePinecone.js clear      - Clear all vectors (WARNING!)
 *   node scripts/managePinecone.js delete     - Delete the index (WARNING!)
 *   node scripts/managePinecone.js search     - Interactive search
 */

const { Pinecone } = require("@pinecone-database/pinecone");
const { OpenAIEmbeddings } = require("@langchain/openai");
const { PineconeStore } = require("@langchain/pinecone");
const readline = require("readline");
require("dotenv").config();

const { OPENAI_API_KEY, PINECONE_API_KEY, PINECONE_INDEX } = process.env;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

/**
 * Get detailed index statistics
 */
async function getStats() {
  console.log("📊 Fetching Pinecone index statistics...\n");

  const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });

  try {
    // List all indexes
    const indexes = await pinecone.listIndexes();
    console.log("📋 Available Indexes:");

    if (indexes.indexes && indexes.indexes.length > 0) {
      indexes.indexes.forEach((idx) => {
        const current = idx.name === PINECONE_INDEX ? " ← (current)" : "";
        console.log(`   • ${idx.name}${current}`);
        console.log(`     Host: ${idx.host}`);
        console.log(
          `     Status: ${idx.status?.ready ? "✅ Ready" : "⏳ Not Ready"}`
        );
      });
    } else {
      console.log("   (No indexes found)");
    }

    console.log(`\n🎯 Current Index: ${PINECONE_INDEX}\n`);

    // Get stats for current index
    const index = pinecone.Index(PINECONE_INDEX);
    const stats = await index.describeIndexStats();

    console.log("📈 Index Statistics:");
    console.log(`   Total Vectors: ${stats.totalRecordCount || 0}`);
    console.log(`   Dimension: ${stats.dimension || "N/A"}`);
    console.log(`   Index Fullness: ${stats.indexFullness || 0}`);

    if (stats.namespaces && Object.keys(stats.namespaces).length > 0) {
      console.log("\n📦 Namespaces:");
      for (const [ns, nsStats] of Object.entries(stats.namespaces)) {
        const nsName = ns || "(default)";
        console.log(`   ${nsName}: ${nsStats.recordCount || 0} vectors`);
      }
    }

    console.log("\n✅ Stats retrieved successfully!\n");
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

/**
 * Clear all vectors from index
 */
async function clearIndex() {
  console.log("⚠️  WARNING: This will delete ALL vectors from the index!\n");

  const confirm = await question('Type "YES" to confirm: ');

  if (confirm !== "YES") {
    console.log("❌ Cancelled.");
    rl.close();
    return;
  }

  console.log("\n🗑️  Clearing index...");

  const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
  const index = pinecone.Index(PINECONE_INDEX);

  try {
    await index.deleteAll();
    console.log("✅ Index cleared successfully!\n");
  } catch (error) {
    console.error("❌ Error:", error.message);
  }

  rl.close();
}

/**
 * Delete the entire index
 */
async function deleteIndex() {
  console.log("⚠️  WARNING: This will PERMANENTLY DELETE the entire index!\n");
  console.log(`Index to delete: ${PINECONE_INDEX}\n`);

  const confirm1 = await question("Type the index name to confirm: ");

  if (confirm1 !== PINECONE_INDEX) {
    console.log("❌ Index name does not match. Cancelled.");
    rl.close();
    return;
  }

  const confirm2 = await question('Type "DELETE" to proceed: ');

  if (confirm2 !== "DELETE") {
    console.log("❌ Cancelled.");
    rl.close();
    return;
  }

  console.log("\n🗑️  Deleting index...");

  const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });

  try {
    await pinecone.deleteIndex(PINECONE_INDEX);
    console.log("✅ Index deleted successfully!\n");
    console.log("💡 Run initializePinecone.js to create a new index.\n");
  } catch (error) {
    console.error("❌ Error:", error.message);
  }

  rl.close();
}

/**
 * Interactive search
 */
async function interactiveSearch() {
  console.log("🔍 Interactive Pinecone Search\n");
  console.log('Type your search query (or "exit" to quit)\n');

  const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
  const index = pinecone.Index(PINECONE_INDEX);

  const embeddings = new OpenAIEmbeddings({
    model: "text-embedding-3-large",
    apiKey: OPENAI_API_KEY,
  });

  const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex: index,
  });

  while (true) {
    const query = await question("\n🔎 Query: ");

    if (query.toLowerCase() === "exit") {
      break;
    }

    if (!query.trim()) {
      continue;
    }

    try {
      console.log("\n⏳ Searching...");
      const results = await vectorStore.similaritySearchWithScore(query, 5);

      if (results.length === 0) {
        console.log("   No results found.");
        continue;
      }

      console.log(`\n✅ Found ${results.length} results:\n`);

      results.forEach(([doc, score], i) => {
        console.log(`${i + 1}. [Score: ${score.toFixed(4)}]`);
        console.log(`   Category: ${doc.metadata.category || "N/A"}`);
        console.log(`   Source: ${doc.metadata.source || "N/A"}`);

        const preview = doc.pageContent.substring(0, 200).replace(/\n/g, " ");
        console.log(
          `   Content: ${preview}${doc.pageContent.length > 200 ? "..." : ""}`
        );
        console.log("");
      });
    } catch (error) {
      console.error("❌ Search error:", error.message);
    }
  }

  console.log("\n👋 Goodbye!\n");
  rl.close();
}

/**
 * List recent vectors
 */
async function listVectors() {
  console.log("📄 Listing sample vectors...\n");

  const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
  const index = pinecone.Index(PINECONE_INDEX);

  try {
    // Note: Pinecone doesn't have a direct "list all" operation
    // This is a workaround using query with a dummy vector
    console.log(
      "💡 Tip: Use the search command for better vector exploration\n"
    );

    const stats = await index.describeIndexStats();
    console.log(`Total vectors in index: ${stats.totalRecordCount || 0}\n`);

    if (stats.namespaces) {
      console.log("Namespaces:");
      for (const [ns, nsStats] of Object.entries(stats.namespaces)) {
        console.log(`  ${ns || "(default)"}: ${nsStats.recordCount} vectors`);
      }
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

/**
 * Show help
 */
function showHelp() {
  console.log(`
📘 Pinecone Management Utility

Usage: node scripts/managePinecone.js <command>

Commands:
  stats     - View detailed index statistics
  search    - Interactive semantic search
  list      - List vector information
  clear     - Clear all vectors (⚠️  destructive)
  delete    - Delete the entire index (⚠️  destructive)
  help      - Show this help message

Examples:
  node scripts/managePinecone.js stats
  node scripts/managePinecone.js search
  node scripts/managePinecone.js clear

Environment Variables Required:
  PINECONE_API_KEY    - Your Pinecone API key
  PINECONE_INDEX      - Name of your index
  OPENAI_API_KEY      - Your OpenAI API key (for search)
`);
}

/**
 * Main execution
 */
async function main() {
  const command = process.argv[2];

  if (!PINECONE_API_KEY) {
    console.error("❌ PINECONE_API_KEY not found in environment variables!\n");
    process.exit(1);
  }

  if (!PINECONE_INDEX) {
    console.error("❌ PINECONE_INDEX not found in environment variables!\n");
    process.exit(1);
  }

  switch (command) {
    case "stats":
      await getStats();
      break;

    case "search":
      if (!OPENAI_API_KEY) {
        console.error("❌ OPENAI_API_KEY required for search!\n");
        process.exit(1);
      }
      await interactiveSearch();
      break;

    case "list":
      await listVectors();
      break;

    case "clear":
      await clearIndex();
      break;

    case "delete":
      await deleteIndex();
      break;

    case "help":
    case undefined:
      showHelp();
      break;

    default:
      console.log(`❌ Unknown command: ${command}\n`);
      showHelp();
      process.exit(1);
  }
}

if (require.main === module) {
  main()
    .then(() => {
      if (!["search", "clear", "delete"].includes(process.argv[2])) {
        process.exit(0);
      }
    })
    .catch((error) => {
      console.error("\n❌ Error:", error);
      process.exit(1);
    });
}

module.exports = { getStats, clearIndex, deleteIndex, interactiveSearch };
