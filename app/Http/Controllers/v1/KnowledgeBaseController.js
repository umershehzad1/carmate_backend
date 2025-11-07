"use strict";

const { Pinecone } = require("@pinecone-database/pinecone");
const { OpenAIEmbeddings } = require("@langchain/openai");
const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const { Document } = require("@langchain/core/documents");
const { PineconeStore } = require("@langchain/pinecone");
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const PDFParse = require("pdf-parse");
const json = require("../../../Traits/ApiResponser");

const { OPENAI_API_KEY, PINECONE_API_KEY, PINECONE_INDEX } = process.env;

// Configure multer for file uploads (memory storage)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [".pdf", ".txt"];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(
        new Error("Invalid file type. Only PDF and TXT files are allowed."),
        false
      );
    }
  },
}).single("file");

const o = {};

/**
 * Get Pinecone index statistics
 */
o.getStats = async function (req, res, next) {
  try {
    const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
    const index = pinecone.Index(PINECONE_INDEX || "carmate");

    // Get index stats
    const stats = await index.describeIndexStats();

    return json.successResponse(
      res,
      {
        totalVectors: stats.totalRecordCount || 0,
        dimension: stats.dimension || 0,
        indexFullness: stats.indexFullness || 0,
        namespaces: stats.namespaces || {},
      },
      200
    );
  } catch (error) {
    console.error("[KnowledgeBase] Get stats error:", error);

    // User-friendly error messages
    let userMessage =
      "Unable to retrieve knowledge base statistics at this time. Please try again later.";

    if (
      error.message?.includes("API key") ||
      error.message?.includes("authentication")
    ) {
      userMessage =
        "Knowledge base service authentication failed. Please contact support.";
    } else if (
      error.message?.includes("network") ||
      error.message?.includes("ECONNREFUSED") ||
      error.message?.includes("ETIMEDOUT")
    ) {
      userMessage =
        "Unable to connect to knowledge base service. Please check your internet connection and try again.";
    } else if (
      error.message?.includes("index") ||
      error.message?.includes("not found")
    ) {
      userMessage =
        "Knowledge base is not properly configured. Please contact support.";
    }

    return json.errorResponse(res, userMessage, 500);
  }
};

/**
 * Upload and process document (PDF or TXT)
 */
o.uploadDocument = async function (req, res, next) {
  upload(req, res, async (err) => {
    if (err) {
      console.error("[KnowledgeBase] Upload error:", err);
      return json.errorResponse(res, err.message || "File upload failed", 400);
    }

    try {
      const { category, source } = req.body;
      const file = req.file;

      // Validate required fields
      if (!category || !source) {
        return json.errorResponse(res, "Category and source are required", 400);
      }

      if (!file) {
        return json.errorResponse(res, "No file uploaded", 400);
      }

      // Extract text from file
      let content = "";
      const ext = path.extname(file.originalname).toLowerCase();
      const fileName = file.originalname;

      if (ext === ".pdf") {
        // Parse PDF
        const data = await PDFParse(file.buffer);
        content = data.text || "";
      } else if (ext === ".txt") {
        // Read TXT file
        content = file.buffer.toString("utf-8");
      }

      if (!content || content.trim().length === 0) {
        return json.errorResponse(
          res,
          "No content could be extracted from the file",
          400
        );
      }

      // Connect to Pinecone
      const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
      const index = pinecone.Index(PINECONE_INDEX || "carmate");

      const embeddings = new OpenAIEmbeddings({
        model: "text-embedding-3-large",
        apiKey: OPENAI_API_KEY,
      });

      // Split document into chunks
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });

      const doc = new Document({
        pageContent: content,
        metadata: {
          category,
          source,
          fileName, // Store filename for tracking
          uploadedAt: new Date().toISOString(),
        },
      });

      const chunks = await splitter.splitDocuments([doc]);

      // Generate embeddings
      const texts = chunks.map((chunk) => chunk.pageContent);
      const vectors = await embeddings.embedDocuments(texts);

      // Prepare records with unique IDs based on filename
      const fileId = `file_${Date.now()}_${fileName.replace(
        /[^a-zA-Z0-9]/g,
        "_"
      )}`;
      const records = chunks.map((chunk, idx) => ({
        id: `${fileId}_chunk_${idx}`,
        values: vectors[idx],
        metadata: {
          text: chunk.pageContent,
          category,
          source,
          fileName,
          fileId, // Store fileId to delete all chunks of this file later
          chunkIndex: idx,
          uploadedAt: chunk.metadata.uploadedAt,
        },
      }));

      // Upload to Pinecone
      await index.upsert(records);

      console.log(
        `[KnowledgeBase] Successfully uploaded ${fileName} with ${chunks.length} chunks`
      );

      return json.successResponse(
        res,
        {
          fileName,
          fileId,
          chunks: chunks.length,
          category,
          source,
        },
        200
      );
    } catch (error) {
      console.error("[KnowledgeBase] Upload processing error:", error);

      // User-friendly error messages
      let userMessage =
        "Failed to process and upload your document. Please try again.";

      if (
        error.message?.includes("API key") ||
        error.message?.includes("authentication") ||
        error.message?.includes("401")
      ) {
        userMessage = "Service authentication issue. Please contact support.";
      } else if (
        error.message?.includes("network") ||
        error.message?.includes("ECONNREFUSED") ||
        error.message?.includes("ETIMEDOUT")
      ) {
        userMessage =
          "Network connection error. Please check your internet connection and try again.";
      } else if (
        error.message?.includes("OpenAI") ||
        error.message?.includes("embedding")
      ) {
        userMessage =
          "Document processing service is currently unavailable. Please try again in a few moments.";
      } else if (
        error.message?.includes("Pinecone") ||
        error.message?.includes("index")
      ) {
        userMessage =
          "Knowledge base storage is currently unavailable. Please try again later.";
      } else if (
        error.message?.includes("parse") ||
        error.message?.includes("extract")
      ) {
        userMessage =
          "Unable to extract content from the uploaded file. Please ensure the file is not corrupted.";
      } else if (
        error.message?.includes("quota") ||
        error.message?.includes("limit") ||
        error.message?.includes("429")
      ) {
        userMessage =
          "Service usage limit reached. Please try again in a few minutes.";
      }

      return json.errorResponse(res, userMessage, 500);
    }
  });
};

/**
 * Add text document manually
 */
o.addDocument = async function (req, res, next) {
  try {
    const { category, source, content } = req.body;

    // Validate required fields
    if (!category || !source || !content) {
      return json.errorResponse(
        res,
        "Category, source, and content are required",
        400
      );
    }

    if (content.trim().length === 0) {
      return json.errorResponse(res, "Content cannot be empty", 400);
    }

    // Connect to Pinecone
    const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
    const index = pinecone.Index(PINECONE_INDEX || "carmate");

    const embeddings = new OpenAIEmbeddings({
      model: "text-embedding-3-large",
      apiKey: OPENAI_API_KEY,
    });

    // Split document into chunks
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const doc = new Document({
      pageContent: content,
      metadata: {
        category,
        source,
        fileName: `manual_${Date.now()}`,
        uploadedAt: new Date().toISOString(),
      },
    });

    const chunks = await splitter.splitDocuments([doc]);

    // Generate embeddings
    const texts = chunks.map((chunk) => chunk.pageContent);
    const vectors = await embeddings.embedDocuments(texts);

    // Prepare records
    const fileId = `manual_${Date.now()}`;
    const records = chunks.map((chunk, idx) => ({
      id: `${fileId}_chunk_${idx}`,
      values: vectors[idx],
      metadata: {
        text: chunk.pageContent,
        category,
        source,
        fileName: fileId,
        fileId,
        chunkIndex: idx,
        uploadedAt: chunk.metadata.uploadedAt,
      },
    }));

    // Upload to Pinecone
    await index.upsert(records);

    console.log(
      `[KnowledgeBase] Successfully added manual document with ${chunks.length} chunks`
    );

    return json.successResponse(
      res,
      {
        fileId,
        chunks: chunks.length,
        category,
        source,
      },
      200
    );
  } catch (error) {
    console.error("[KnowledgeBase] Add document error:", error);

    // User-friendly error messages
    let userMessage =
      "Failed to add document to knowledge base. Please try again.";

    if (
      error.message?.includes("API key") ||
      error.message?.includes("authentication") ||
      error.message?.includes("401")
    ) {
      userMessage = "Service authentication issue. Please contact support.";
    } else if (
      error.message?.includes("network") ||
      error.message?.includes("ECONNREFUSED") ||
      error.message?.includes("ETIMEDOUT")
    ) {
      userMessage =
        "Network connection error. Please check your internet connection and try again.";
    } else if (
      error.message?.includes("OpenAI") ||
      error.message?.includes("embedding")
    ) {
      userMessage =
        "Document processing service is currently unavailable. Please try again in a few moments.";
    } else if (
      error.message?.includes("Pinecone") ||
      error.message?.includes("index")
    ) {
      userMessage =
        "Knowledge base storage is currently unavailable. Please try again later.";
    } else if (
      error.message?.includes("quota") ||
      error.message?.includes("limit") ||
      error.message?.includes("429")
    ) {
      userMessage =
        "Service usage limit reached. Please try again in a few minutes.";
    }

    return json.errorResponse(res, userMessage, 500);
  }
};

/**
 * Search knowledge base
 */
o.searchKnowledgeBase = async function (req, res, next) {
  try {
    const { query, limit = 5 } = req.body;

    if (!query || query.trim().length === 0) {
      return json.errorResponse(res, "Search query is required", 400);
    }

    const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
    const index = pinecone.Index(PINECONE_INDEX || "carmate");

    const embeddings = new OpenAIEmbeddings({
      model: "text-embedding-3-large",
      apiKey: OPENAI_API_KEY,
    });

    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex: index,
    });

    const results = await vectorStore.similaritySearchWithScore(
      query,
      parseInt(limit)
    );

    const formattedResults = results.map(([doc, score]) => ({
      score,
      category: doc.metadata.category || "N/A",
      source: doc.metadata.source || "N/A",
      fileName: doc.metadata.fileName || "N/A",
      content: doc.pageContent,
    }));

    return json.successResponse(res, formattedResults, 200);
  } catch (error) {
    console.error("[KnowledgeBase] Search error:", error);

    // User-friendly error messages
    let userMessage =
      "Unable to search knowledge base at this time. Please try again.";

    if (
      error.message?.includes("API key") ||
      error.message?.includes("authentication") ||
      error.message?.includes("401")
    ) {
      userMessage = "Service authentication issue. Please contact support.";
    } else if (
      error.message?.includes("network") ||
      error.message?.includes("ECONNREFUSED") ||
      error.message?.includes("ETIMEDOUT")
    ) {
      userMessage =
        "Network connection error. Please check your internet connection and try again.";
    } else if (
      error.message?.includes("OpenAI") ||
      error.message?.includes("embedding")
    ) {
      userMessage =
        "Search service is currently unavailable. Please try again in a few moments.";
    } else if (
      error.message?.includes("Pinecone") ||
      error.message?.includes("index")
    ) {
      userMessage =
        "Knowledge base is currently unavailable. Please try again later.";
    } else if (
      error.message?.includes("quota") ||
      error.message?.includes("limit") ||
      error.message?.includes("429")
    ) {
      userMessage =
        "Service usage limit reached. Please try again in a few minutes.";
    }

    return json.errorResponse(res, userMessage, 500);
  }
};

/**
 * Delete document by fileId (deletes all chunks of that file)
 */
o.deleteDocument = async function (req, res, next) {
  try {
    const { fileId } = req.params;

    if (!fileId) {
      return json.errorResponse(res, "File ID is required", 400);
    }

    const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
    const index = pinecone.Index(PINECONE_INDEX || "carmate");

    // Query to find all vectors with this fileId
    const embeddings = new OpenAIEmbeddings({
      model: "text-embedding-3-large",
      apiKey: OPENAI_API_KEY,
    });

    // Create a dummy query to search for all chunks with this fileId
    // We'll use metadata filtering if Pinecone supports it, or delete by ID prefix

    // Delete all chunks matching the fileId pattern
    // Since we use pattern: fileId_chunk_0, fileId_chunk_1, etc.
    // We need to query and delete them

    // For simplicity, we'll attempt to delete by ID pattern
    // Pinecone allows deletion by ID prefix or by fetching IDs first

    // Get all IDs that start with this fileId
    const stats = await index.describeIndexStats();

    // Delete by metadata filter (if your Pinecone version supports it)
    // Otherwise, we'll need to list and delete individually
    try {
      // Attempt to delete all vectors with matching metadata
      await index.deleteMany({ fileId: fileId });
      console.log(`[KnowledgeBase] Deleted all chunks for fileId: ${fileId}`);
    } catch (deleteError) {
      // Fallback: Delete by ID pattern (less efficient but works)
      // We'll try deleting chunks 0-999 (should cover most files)
      const idsToDelete = [];
      for (let i = 0; i < 1000; i++) {
        idsToDelete.push(`${fileId}_chunk_${i}`);
      }

      // Delete in batches
      const batchSize = 100;
      for (let i = 0; i < idsToDelete.length; i += batchSize) {
        const batch = idsToDelete.slice(i, i + batchSize);
        await index.deleteMany(batch);
      }
      console.log(
        `[KnowledgeBase] Deleted chunks by ID pattern for fileId: ${fileId}`
      );
    }

    return json.successResponse(res, { fileId }, 200);
  } catch (error) {
    console.error("[KnowledgeBase] Delete error:", error);

    // User-friendly error messages
    let userMessage =
      "Failed to delete document from knowledge base. Please try again.";

    if (
      error.message?.includes("API key") ||
      error.message?.includes("authentication") ||
      error.message?.includes("401")
    ) {
      userMessage = "Service authentication issue. Please contact support.";
    } else if (
      error.message?.includes("network") ||
      error.message?.includes("ECONNREFUSED") ||
      error.message?.includes("ETIMEDOUT")
    ) {
      userMessage =
        "Network connection error. Please check your internet connection and try again.";
    } else if (
      error.message?.includes("Pinecone") ||
      error.message?.includes("index")
    ) {
      userMessage =
        "Knowledge base is currently unavailable. Please try again later.";
    } else if (
      error.message?.includes("not found") ||
      error.message?.includes("404")
    ) {
      userMessage = "Document not found. It may have already been deleted.";
    } else if (
      error.message?.includes("quota") ||
      error.message?.includes("limit") ||
      error.message?.includes("429")
    ) {
      userMessage =
        "Service usage limit reached. Please try again in a few minutes.";
    }

    return json.errorResponse(res, userMessage, 500);
  }
};

/**
 * List all uploaded documents (unique files)
 */
o.listDocuments = async function (req, res, next) {
  try {
    const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
    const index = pinecone.Index(PINECONE_INDEX || "carmate");

    // Get stats to understand the data
    const stats = await index.describeIndexStats();

    // Query random vectors to get metadata (Pinecone limitation)
    // We'll use a dummy query to fetch some results and extract unique files
    const embeddings = new OpenAIEmbeddings({
      model: "text-embedding-3-large",
      apiKey: OPENAI_API_KEY,
    });

    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex: index,
    });

    // Perform a broad search to get sample documents
    const results = await vectorStore.similaritySearch(
      "document information",
      100 // Get more results to find unique files
    );

    // Extract unique files based on fileId
    const filesMap = new Map();
    results.forEach((doc) => {
      const fileId = doc.metadata.fileId;
      if (fileId && !filesMap.has(fileId)) {
        filesMap.set(fileId, {
          fileId,
          fileName: doc.metadata.fileName || "Unknown",
          category: doc.metadata.category || "N/A",
          source: doc.metadata.source || "N/A",
          uploadedAt: doc.metadata.uploadedAt || "N/A",
        });
      }
    });

    const documents = Array.from(filesMap.values());

    return json.successResponse(
      res,
      {
        totalVectors: stats.totalRecordCount || 0,
        documents,
      },
      200
    );
  } catch (error) {
    console.error("[KnowledgeBase] List documents error:", error);

    // User-friendly error messages
    let userMessage =
      "Unable to retrieve document list at this time. Please try again.";

    if (
      error.message?.includes("API key") ||
      error.message?.includes("authentication") ||
      error.message?.includes("401")
    ) {
      userMessage = "Service authentication issue. Please contact support.";
    } else if (
      error.message?.includes("network") ||
      error.message?.includes("ECONNREFUSED") ||
      error.message?.includes("ETIMEDOUT")
    ) {
      userMessage =
        "Network connection error. Please check your internet connection and try again.";
    } else if (
      error.message?.includes("OpenAI") ||
      error.message?.includes("embedding")
    ) {
      userMessage =
        "Document listing service is currently unavailable. Please try again in a few moments.";
    } else if (
      error.message?.includes("Pinecone") ||
      error.message?.includes("index")
    ) {
      userMessage =
        "Knowledge base is currently unavailable. Please try again later.";
    } else if (
      error.message?.includes("quota") ||
      error.message?.includes("limit") ||
      error.message?.includes("429")
    ) {
      userMessage =
        "Service usage limit reached. Please try again in a few minutes.";
    }

    return json.errorResponse(res, userMessage, 500);
  }
};

/**
 * Clear entire knowledge base
 */
o.clearKnowledgeBase = async function (req, res, next) {
  try {
    const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
    const index = pinecone.Index(PINECONE_INDEX || "carmate");

    // Delete all vectors
    await index.deleteAll();

    console.log("[KnowledgeBase] Cleared entire knowledge base");

    return json.successResponse(res, {}, 200);
  } catch (error) {
    console.error("[KnowledgeBase] Clear error:", error);

    // User-friendly error messages
    let userMessage = "Failed to clear knowledge base. Please try again.";

    if (
      error.message?.includes("API key") ||
      error.message?.includes("authentication") ||
      error.message?.includes("401")
    ) {
      userMessage = "Service authentication issue. Please contact support.";
    } else if (
      error.message?.includes("network") ||
      error.message?.includes("ECONNREFUSED") ||
      error.message?.includes("ETIMEDOUT")
    ) {
      userMessage =
        "Network connection error. Please check your internet connection and try again.";
    } else if (
      error.message?.includes("Pinecone") ||
      error.message?.includes("index")
    ) {
      userMessage =
        "Knowledge base is currently unavailable. Please try again later.";
    } else if (
      error.message?.includes("quota") ||
      error.message?.includes("limit") ||
      error.message?.includes("429")
    ) {
      userMessage =
        "Service usage limit reached. Please try again in a few minutes.";
    } else if (
      error.message?.includes("permission") ||
      error.message?.includes("forbidden") ||
      error.message?.includes("403")
    ) {
      userMessage =
        "You don't have permission to clear the knowledge base. Please contact support.";
    }

    return json.errorResponse(res, userMessage, 500);
  }
};

/**
 * Add quick documents (FAQ, Troubleshooting, etc.)
 */
o.addQuickDocument = async function (req, res, next) {
  try {
    const { type } = req.body;

    if (!type) {
      return json.errorResponse(res, "Document type is required", 400);
    }

    const quickDocs = {
      faq: {
        content: `# Carmate Frequently Asked Questions

## How do I create an account?
Go to the registration page and fill in your details including name, email, and password. You'll receive a verification email to confirm your account.

## How do I list a vehicle for sale?
After logging in, go to "Sell Your Car" and fill in the vehicle details including make, model, year, price, condition, and upload photos. Your listing will be reviewed before going live.

## How can I contact a dealer?
Click on any dealer's profile and use the "Contact" button to send a message or view their phone number and address.

## What payment methods are accepted?
We support credit/debit cards, bank transfers, and digital wallets through our secure payment gateway.

## How do I schedule a test drive?
On any vehicle listing, click "Request Test Drive" and choose your preferred date and time. The dealer will confirm the appointment.

## Is my personal information secure?
Yes, we use industry-standard encryption and security measures to protect your data.

## How do reviews work?
After a transaction, you can rate and review dealers and vehicles. Reviews help build trust in our community.

## Can I delete my account?
Yes, go to Settings > Account > Delete Account. Note that this action is permanent.`,
        category: "faq",
        source: "quick-add",
      },
      troubleshooting: {
        content: `# Carmate Troubleshooting Guide

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
If issues persist, email support@carmate.com or call our helpline.`,
        category: "troubleshooting",
        source: "quick-add",
      },
    };

    const docData = quickDocs[type.toLowerCase()];
    if (!docData) {
      return json.errorResponse(res, "Invalid document type", 400);
    }

    // Use the addDocument logic
    const { category, source, content } = docData;

    const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
    const index = pinecone.Index(PINECONE_INDEX || "carmate");

    const embeddings = new OpenAIEmbeddings({
      model: "text-embedding-3-large",
      apiKey: OPENAI_API_KEY,
    });

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const doc = new Document({
      pageContent: content,
      metadata: {
        category,
        source,
        fileName: `${type}_${Date.now()}`,
        uploadedAt: new Date().toISOString(),
      },
    });

    const chunks = await splitter.splitDocuments([doc]);
    const texts = chunks.map((chunk) => chunk.pageContent);
    const vectors = await embeddings.embedDocuments(texts);

    const fileId = `quick_${type}_${Date.now()}`;
    const records = chunks.map((chunk, idx) => ({
      id: `${fileId}_chunk_${idx}`,
      values: vectors[idx],
      metadata: {
        text: chunk.pageContent,
        category,
        source,
        fileName: fileId,
        fileId,
        chunkIndex: idx,
        uploadedAt: chunk.metadata.uploadedAt,
      },
    }));

    await index.upsert(records);

    console.log(`[KnowledgeBase] Added quick document: ${type}`);

    return json.successResponse(
      res,
      {
        fileId,
        chunks: chunks.length,
      },
      200
    );
  } catch (error) {
    console.error("[KnowledgeBase] Add quick document error:", error);

    // User-friendly error messages
    let userMessage =
      "Failed to add quick document to knowledge base. Please try again.";

    if (
      error.message?.includes("API key") ||
      error.message?.includes("authentication") ||
      error.message?.includes("401")
    ) {
      userMessage = "Service authentication issue. Please contact support.";
    } else if (
      error.message?.includes("network") ||
      error.message?.includes("ECONNREFUSED") ||
      error.message?.includes("ETIMEDOUT")
    ) {
      userMessage =
        "Network connection error. Please check your internet connection and try again.";
    } else if (
      error.message?.includes("OpenAI") ||
      error.message?.includes("embedding")
    ) {
      userMessage =
        "Document processing service is currently unavailable. Please try again in a few moments.";
    } else if (
      error.message?.includes("Pinecone") ||
      error.message?.includes("index")
    ) {
      userMessage =
        "Knowledge base storage is currently unavailable. Please try again later.";
    } else if (
      error.message?.includes("quota") ||
      error.message?.includes("limit") ||
      error.message?.includes("429")
    ) {
      userMessage =
        "Service usage limit reached. Please try again in a few minutes.";
    }

    return json.errorResponse(res, userMessage, 500);
  }
};

/**
 * Get FAQs for chatbot
 * Fetches FAQ content from Pinecone with FAQ category
 */
o.getFAQs = async function (req, res, next) {
  try {
    const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
    const index = pinecone.Index(PINECONE_INDEX || "carmate");

    const embeddings = new OpenAIEmbeddings({
      model: "text-embedding-3-large",
      apiKey: OPENAI_API_KEY,
    });

    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex: index,
    });

    // Pull many vectors; filter manually
    const allResults = await vectorStore.similaritySearchWithScore("faq", 200);

    const faqResults = allResults.filter(([doc]) => {
      return doc.metadata?.category === "faq";
    });

    const faqMap = new Map();

    faqResults.forEach(([doc, score]) => {
      const content = doc.pageContent;
      if (!content) return;

      const lines = content.split("\n").filter((line) => line.trim());

      lines.forEach((line) => {
        if (
          line.match(/^##\s+/) ||
          line.match(/^\d+\.\s+/) ||
          line.includes("?")
        ) {
          const question = line
            .replace(/^##\s+/, "")
            .replace(/^\d+\.\s+/, "")
            .trim();

          if (question && question.length > 10 && question.length < 200) {
            faqMap.set(question, {
              question,
              category: "faq",
              score,
            });
          }
        }
      });
    });

    const faqs = Array.from(faqMap.values()).slice(0, 50);

    return json.successResponse(res, faqs, 200);
  } catch (error) {
    console.error("[KnowledgeBase] Get FAQs error:", error);

    const defaultFAQs = [
      /* ... */
    ];
    return json.successResponse(res, defaultFAQs, 200);
  }
};

module.exports = o;
