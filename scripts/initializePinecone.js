/**
 * Initialize Pinecone index from PDF knowledge base
 * Usage: node scripts/initializePinecone.js
 */

const path = require("path");
const fs = require("fs");
const { Pinecone } = require("@pinecone-database/pinecone");
const { OpenAIEmbeddings } = require("@langchain/openai");
const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const { Document } = require("@langchain/core/documents");
const pdf = require("pdfjs-dist/legacy/build/pdf.js");
require("dotenv").config();

const { OPENAI_API_KEY, PINECONE_API_KEY } = process.env;

// Configuration
const CONFIG = {
  indexName: "carmate",
  pdfPath: path.join(__dirname, "CarMate_Knowledge_Base.pdf"),
  dimension: 3072,
  metric: "cosine",
  cloud: "aws",
  region: "us-east-1",
  chunkSize: 1000,
  chunkOverlap: 200,
  batchSize: 100,
};

/**
 * Initialize Pinecone client
 */
async function initPinecone() {
  console.log("🔌 Initializing Pinecone client...");
  const pinecone = new Pinecone({
    apiKey: PINECONE_API_KEY,
  });
  return pinecone;
}

/**
 * Create or verify Pinecone index exists
 */
async function ensureIndexExists(pinecone) {
  console.log(`📊 Checking if index "${CONFIG.indexName}" exists...`);

  try {
    const indexes = await pinecone.listIndexes();
    const indexExists = indexes.indexes?.some(
      (idx) => idx.name === CONFIG.indexName
    );

    if (!indexExists) {
      console.log(`🏗️  Creating new index "${CONFIG.indexName}"...`);
      await pinecone.createIndex({
        name: CONFIG.indexName,
        dimension: CONFIG.dimension,
        metric: CONFIG.metric,
        spec: {
          serverless: {
            cloud: CONFIG.cloud,
            region: CONFIG.region,
          },
        },
      });

      console.log("⏳ Waiting for index to be ready...");
      await new Promise((resolve) => setTimeout(resolve, 60000));
      console.log("✅ Index created successfully!");
    } else {
      console.log("✅ Index already exists!");
    }

    return pinecone.Index(CONFIG.indexName);
  } catch (error) {
    console.error("❌ Error managing index:", error);
    throw error;
  }
}

/**
 * Load PDF document
 */
async function loadPDF() {
  console.log("📚 Loading PDF knowledge base...");
  console.log(`   File: ${CONFIG.pdfPath}`);

  try {
    const dataBuffer = fs.readFileSync(CONFIG.pdfPath);
    const loadingTask = pdf.getDocument({
      data: new Uint8Array(dataBuffer),
      useSystemFonts: true,
    });

    const pdfDocument = await loadingTask.promise;
    const numPages = pdfDocument.numPages;
    const documents = [];

    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      const text = textContent.items.map((item) => item.str).join(" ");

      documents.push(
        new Document({
          pageContent: text,
          metadata: {
            page: i,
            totalPages: numPages,
            source: "CarMate_Knowledge_Base.pdf",
          },
        })
      );
    }

    console.log(`✅ Loaded PDF with ${documents.length} pages`);
    return documents;
  } catch (error) {
    console.error("❌ Error loading PDF:", error.message);
    throw error;
  }
}

/**
 * Split documents into chunks
 */
async function splitDocuments(documents) {
  console.log("✂️  Splitting documents into chunks...");

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CONFIG.chunkSize,
    chunkOverlap: CONFIG.chunkOverlap,
    separators: ["\n\n", "\n", ". ", " ", ""],
  });

  const chunks = await splitter.splitDocuments(documents);
  console.log(`✅ Created ${chunks.length} chunks`);
  return chunks;
}

/**
 * Generate embeddings and upload to Pinecone
 */
async function uploadToPinecone(index, chunks) {
  console.log("🚀 Generating embeddings and uploading to Pinecone...");

  const embeddings = new OpenAIEmbeddings({
    model: "text-embedding-3-large",
    apiKey: OPENAI_API_KEY,
  });

  const totalBatches = Math.ceil(chunks.length / CONFIG.batchSize);

  for (let i = 0; i < chunks.length; i += CONFIG.batchSize) {
    const batch = chunks.slice(i, i + CONFIG.batchSize);
    const batchNum = Math.floor(i / CONFIG.batchSize) + 1;

    console.log(
      `  Processing batch ${batchNum}/${totalBatches} (${batch.length} chunks)...`
    );

    try {
      const texts = batch.map((chunk) => chunk.pageContent);
      const vectors = await embeddings.embedDocuments(texts);

      const records = batch.map((chunk, idx) => ({
        id: `doc_${Date.now()}_${i + idx}`,
        values: vectors[idx],
        metadata: {
          text: chunk.pageContent,
          page: chunk.metadata.loc?.pageNumber || 0,
          source: "CarMate_Knowledge_Base.pdf",
          timestamp: new Date().toISOString(),
        },
      }));

      await index.upsert(records);
      console.log(`  ✅ Uploaded batch ${batchNum}/${totalBatches}`);

      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`  ❌ Error processing batch ${batchNum}:`, error.message);
    }
  }

  console.log("✅ All chunks uploaded successfully!");
}

/**
 * Get index statistics
 */
async function getIndexStats(index) {
  try {
    const stats = await index.describeIndexStats();
    console.log("\n📊 Index Statistics:");
    console.log(`  Total vectors: ${stats.totalRecordCount || 0}`);
    console.log(`  Dimension: ${stats.dimension || CONFIG.dimension}`);
  } catch (error) {
    console.warn("⚠️  Could not fetch index stats:", error.message);
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log("🚀 Starting Pinecone initialization from PDF...\n");

  // Validate environment variables
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set in environment variables");
  }
  if (!PINECONE_API_KEY) {
    throw new Error("PINECONE_API_KEY is not set in environment variables");
  }

  try {
    // 1. Initialize Pinecone
    const pinecone = await initPinecone();

    // 2. Ensure index exists
    const index = await ensureIndexExists(pinecone);

    // 3. Load PDF
    const documents = await loadPDF();

    // 4. Split into chunks
    const chunks = await splitDocuments(documents);

    // 5. Upload to Pinecone
    await uploadToPinecone(index, chunks);

    // 6. Display stats
    await getIndexStats(index);

    console.log("\n🎉 Pinecone initialization complete!");
    console.log(
      `\n💡 Your chatbot can now query the knowledge base using index: "${CONFIG.indexName}"\n`
    );
  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
