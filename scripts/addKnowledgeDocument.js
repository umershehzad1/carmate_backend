/**
 * Helper script to add individual documents to Pinecone
 * Usage: node scripts/addKnowledgeDocument.js
 */

const { Pinecone } = require("@pinecone-database/pinecone");
const { OpenAIEmbeddings } = require("@langchain/openai");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { Document } = require("@langchain/core/documents");
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
 * Add a single document to Pinecone
 */
async function addDocument(content, metadata = {}) {
  console.log("🔌 Connecting to Pinecone...");

  const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
  const index = pinecone.Index(PINECONE_INDEX || "carmate-knowledge");

  const embeddings = new OpenAIEmbeddings({
    model: "text-embedding-3-large",
    apiKey: OPENAI_API_KEY,
  });

  // Split document if needed
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const doc = new Document({
    pageContent: content,
    metadata: {
      ...metadata,
      timestamp: new Date().toISOString(),
    },
  });

  console.log("✂️  Splitting document...");
  const chunks = await splitter.splitDocuments([doc]);
  console.log(`Created ${chunks.length} chunks`);

  console.log("🚀 Generating embeddings...");
  const texts = chunks.map((chunk) => chunk.pageContent);
  const vectors = await embeddings.embedDocuments(texts);

  // Prepare and upload
  const records = chunks.map((chunk, idx) => ({
    id: `doc_${Date.now()}_${idx}`,
    values: vectors[idx],
    metadata: {
      text: chunk.pageContent,
      ...chunk.metadata,
    },
  }));

  console.log("📤 Uploading to Pinecone...");
  await index.upsert(records);

  console.log(`✅ Successfully added document with ${chunks.length} chunks!`);
}

/**
 * Interactive mode to add documents
 */
async function interactive() {
  console.log("\n📝 Add Knowledge Document to Pinecone\n");

  const category = await question(
    "Enter category (e.g., api, features, troubleshooting): "
  );
  const source = await question("Enter source name (e.g., faq, manual): ");

  console.log("\nEnter document content (type END on a new line when done):");

  let content = "";
  let line;
  while ((line = await question("")) !== "END") {
    content += line + "\n";
  }

  if (!content.trim()) {
    console.log("❌ No content provided. Exiting.");
    rl.close();
    return;
  }

  const metadata = {
    category: category || "general",
    source: source || "manual",
  };

  await addDocument(content, metadata);
  rl.close();
}

// Quick add examples
const QUICK_DOCS = {
  faq: `
# Carmate Frequently Asked Questions

## How do I create an account?
Go to the registration page and fill in your details including name, email, and password. 
You'll receive a verification email to confirm your account.

## How do I list a vehicle for sale?
After logging in, go to "Sell Your Car" and fill in the vehicle details including make, 
model, year, price, condition, and upload photos. Your listing will be reviewed before going live.

## How can I contact a dealer?
Click on any dealer's profile and use the "Contact" button to send a message or view their 
phone number and address.

## What payment methods are accepted?
We support credit/debit cards, bank transfers, and digital wallets through our secure payment gateway.

## How do I schedule a test drive?
On any vehicle listing, click "Request Test Drive" and choose your preferred date and time. 
The dealer will confirm the appointment.

## Is my personal information secure?
Yes, we use industry-standard encryption and security measures to protect your data.

## How do reviews work?
After a transaction, you can rate and review dealers and vehicles. Reviews help build trust in our community.

## Can I delete my account?
Yes, go to Settings > Account > Delete Account. Note that this action is permanent.
  `,

  troubleshooting: `
# Carmate Troubleshooting Guide

## Login Issues
- Forgot Password: Use the "Forgot Password" link to reset via email
- Account Locked: Contact support if you've had multiple failed login attempts
- Email Not Verified: Check your spam folder for the verification email

## Search Problems
- No Results: Try broader search terms or adjust your filters
- Filters Not Working: Clear your browser cache and try again
- Location Not Found: Make sure to enter the full city name

## Messaging Issues
- Messages Not Sending: Check your internet connection
- Notifications Not Received: Enable push notifications in your browser/app settings
- Can't See Conversation: The other user may have deleted their account

## Payment Issues
- Payment Failed: Verify your card details and ensure sufficient funds
- Subscription Not Active: Payment may take a few minutes to process
- Refund Request: Contact support with your transaction ID

## Upload Problems
- Images Not Uploading: Ensure images are under 5MB and in JPG/PNG format
- Slow Upload Speed: Try compressing images or using a faster internet connection

## Contact Support
If issues persist, email support@carmate.com or call our helpline.
  `,
};

/**
 * Main execution
 */
async function main() {
  const mode = process.argv[2];

  if (mode === "faq") {
    await addDocument(QUICK_DOCS.faq, { category: "faq", source: "quick-add" });
  } else if (mode === "troubleshooting") {
    await addDocument(QUICK_DOCS.troubleshooting, {
      category: "troubleshooting",
      source: "quick-add",
    });
  } else if (mode === "all-quick") {
    for (const [key, content] of Object.entries(QUICK_DOCS)) {
      console.log(`\nAdding ${key}...`);
      await addDocument(content, { category: key, source: "quick-add" });
    }
  } else {
    await interactive();
  }
}

if (require.main === module) {
  main()
    .then(() => {
      console.log("\n✅ Done!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Error:", error);
      process.exit(1);
    });
}

module.exports = { addDocument };
