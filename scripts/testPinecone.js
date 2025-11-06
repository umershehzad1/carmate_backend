/**
 * Test script to verify Pinecone connection and query
 * Usage: node scripts/testPinecone.js
 */

const { Pinecone } = require("@pinecone-database/pinecone");
const { OpenAIEmbeddings } = require("@langchain/openai");
const { PineconeStore } = require("@langchain/pinecone");
const { ChatOpenAI } = require("@langchain/openai");
const { PromptTemplate } = require("@langchain/core/prompts");
const { RunnableSequence } = require("@langchain/core/runnables");
require("dotenv").config();

const { OPENAI_API_KEY, PINECONE_API_KEY, PINECONE_INDEX } = process.env;

async function testConnection() {
  console.log("🧪 Testing Pinecone Connection...\n");

  try {
    // 1. Test Pinecone connection
    console.log("1️⃣  Connecting to Pinecone...");
    const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
    const index = pinecone.Index(PINECONE_INDEX || "carmate");
    console.log("   ✅ Connected to Pinecone\n");

    // 2. Get index stats
    console.log("2️⃣  Fetching index statistics...");
    const stats = await index.describeIndexStats();
    console.log(`   📊 Total vectors: ${stats.totalRecordCount || 0}`);
    console.log(`   📏 Dimension: ${stats.dimension || "N/A"}`);

    if (!stats.totalRecordCount || stats.totalRecordCount === 0) {
      console.log(
        "\n   ⚠️  Warning: Index is empty! Run initializePinecone.js first.\n"
      );
      return;
    }
    console.log("   ✅ Index has data\n");

    // 3. Initialize embeddings
    console.log("3️⃣  Initializing OpenAI embeddings...");
    const embeddings = new OpenAIEmbeddings({
      model: "text-embedding-3-large",
      apiKey: OPENAI_API_KEY,
    });
    console.log("   ✅ Embeddings initialized\n");

    // 4. Create vector store
    console.log("4️⃣  Creating vector store...");
    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex: index,
    });
    const retriever = vectorStore.asRetriever({ k: 3 });
    console.log("   ✅ Vector store ready\n");

    // 5. Test retrieval
    console.log("5️⃣  Testing document retrieval...");
    const testQuery = "What is Carmate?";
    console.log(`   Query: "${testQuery}"`);

    const docs = await retriever.getRelevantDocuments(testQuery);
    console.log(`   ✅ Retrieved ${docs.length} relevant documents\n`);

    if (docs.length > 0) {
      console.log("   📄 Sample results:");
      docs.forEach((doc, i) => {
        const preview = doc.pageContent.substring(0, 150).replace(/\n/g, " ");
        console.log(`   ${i + 1}. ${preview}...`);
        console.log(`      Category: ${doc.metadata.category || "N/A"}`);
        console.log(`      Source: ${doc.metadata.source || "N/A"}\n`);
      });
    }

    // 6. Test RAG chain
    console.log("6️⃣  Testing RAG chain...");
    const llm = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: 0,
      apiKey: OPENAI_API_KEY,
    });

    const ragPrompt = PromptTemplate.fromTemplate(`
You are a helpful assistant. Answer based on the context provided.

Question: {question}

Context:
{context}

Answer concisely:
`);

    const ragChain = RunnableSequence.from([
      {
        question: (input) => input.question,
        context: async (input) => {
          const docs = await retriever.getRelevantDocuments(input.question);
          return docs.map((d, i) => `[${i + 1}] ${d.pageContent}`).join("\n\n");
        },
      },
      ragPrompt,
      llm,
      (res) => res.content,
    ]);

    const testQuestions = [
      "What is Carmate?",
      "How do I create an account?",
      "What are the main API endpoints?",
    ];

    for (const question of testQuestions) {
      console.log(`\n   ❓ Question: "${question}"`);
      const answer = await ragChain.invoke({ question });
      console.log(`   💬 Answer: ${answer.substring(0, 200)}...`);
    }

    console.log("\n✅ All tests passed!\n");
    console.log("🎉 Your Pinecone setup is working correctly!\n");
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    console.error("\nFull error:", error);

    console.log("\n💡 Troubleshooting tips:");
    console.log("   1. Make sure your .env file has correct API keys");
    console.log("   2. Verify PINECONE_INDEX name matches your index");
    console.log(
      '   3. Run "node scripts/initializePinecone.js" if index is empty'
    );
    console.log("   4. Check that you have credits in your OpenAI account\n");
  }
}

// Sample queries to try
async function runSampleQueries() {
  console.log("\n📝 Running sample queries...\n");

  const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
  const index = pinecone.Index(PINECONE_INDEX || "carmate");

  const embeddings = new OpenAIEmbeddings({
    model: "text-embedding-3-large",
    apiKey: OPENAI_API_KEY,
  });

  const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex: index,
  });

  const queries = [
    "vehicle search features",
    "dealer registration process",
    "test drive scheduling",
    "payment methods",
    "database schema",
  ];

  for (const query of queries) {
    console.log(`\n🔍 Query: "${query}"`);
    const results = await vectorStore.similaritySearch(query, 2);

    results.forEach((doc, i) => {
      console.log(`\n   Result ${i + 1}:`);
      console.log(
        `   ${doc.pageContent.substring(0, 120).replace(/\n/g, " ")}...`
      );
      console.log(
        `   [${doc.metadata.category || "N/A"} / ${doc.metadata.source || "N/A"}]`
      );
    });
  }

  console.log("\n✅ Sample queries complete!\n");
}

// Main execution
async function main() {
  const mode = process.argv[2];

  if (!OPENAI_API_KEY || !PINECONE_API_KEY) {
    console.error("❌ Missing API keys in .env file!");
    console.log("\nMake sure you have:");
    console.log("  OPENAI_API_KEY=sk-...");
    console.log("  PINECONE_API_KEY=...");
    console.log("  PINECONE_INDEX=carmate\n");
    process.exit(1);
  }

  if (mode === "query") {
    await runSampleQueries();
  } else {
    await testConnection();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testConnection, runSampleQueries };
