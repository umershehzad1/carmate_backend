# 🚀 Carmate Chatbot - PDF Knowledge Base Setup

This script initializes your Pinecone vector database with knowledge from your PDF file.

## 📋 Prerequisites

1. **API Keys**:
   - OpenAI API key (for embeddings)
   - Pinecone API key (for vector storage)

2. **PDF File**:
   - `CarMate_Knowledge_Base.pdf` must be in the `scripts/` folder ✅

## ⚙️ Configuration

Add these to your `.env` file in the root `carmate` directory:

```env
OPENAI_API_KEY=sk-your-openai-api-key-here
PINECONE_API_KEY=your-pinecone-api-key-here
PINECONE_INDEX=carmate
```

## 🎯 Usage

### Step 1: Run the initialization script

```bash
node scripts/initializePinecone.js
```

This will:

- ✅ Create a Pinecone index named "carmate" (if it doesn't exist)
- ✅ Load your PDF file (`CarMate_Knowledge_Base.pdf`)
- ✅ Split the PDF into chunks
- ✅ Generate embeddings using OpenAI
- ✅ Upload everything to Pinecone

**First run takes 1-2 minutes** (waiting for index to be ready)

### Step 2: Test the setup (optional)

```bash
node scripts/testPinecone.js
```

This verifies that:

- Connection to Pinecone works
- Index has data
- Queries return results

### Step 3: Use your chatbot!

Your chatbot API endpoint will now use the PDF knowledge base to answer questions.

## 📊 Expected Output

```
🚀 Starting Pinecone initialization from PDF...

🔌 Initializing Pinecone client...
📊 Checking if index "carmate" exists...
✅ Index already exists!
📚 Loading PDF knowledge base...
   File: C:\...\scripts\CarMate_Knowledge_Base.pdf
✅ Loaded PDF with 25 pages
✂️  Splitting documents into chunks...
✅ Created 150 chunks
🚀 Generating embeddings and uploading to Pinecone...
  Processing batch 1/2 (100 chunks)...
  ✅ Uploaded batch 1/2
  Processing batch 2/2 (50 chunks)...
  ✅ Uploaded batch 2/2
✅ All chunks uploaded successfully!

📊 Index Statistics:
  Total vectors: 150
  Dimension: 3072

🎉 Pinecone initialization complete!

💡 Your chatbot can now query the knowledge base using index: "carmate"
```

## 🔧 Configuration Options

Edit `scripts/initializePinecone.js` if you need to change:

```javascript
const CONFIG = {
  indexName: "carmate", // Pinecone index name
  pdfPath: "...", // Path to your PDF
  chunkSize: 1000, // Characters per chunk
  chunkOverlap: 200, // Overlap between chunks
  batchSize: 100, // Vectors per upload batch
};
```

## 🐛 Troubleshooting

### "OPENAI_API_KEY is not set"

- Make sure you have a `.env` file in the `carmate` directory (not in `scripts/`)
- Check that your API key starts with `sk-`

### "PINECONE_API_KEY is not set"

- Get your API key from https://www.pinecone.io/
- Add it to your `.env` file

### "Error loading PDF"

- Verify `CarMate_Knowledge_Base.pdf` exists in the `scripts/` folder
- Make sure the PDF is not corrupted

### Index creation timeout

- First-time setup takes ~60 seconds for the index to be ready
- This is normal - the script waits automatically

## 💰 Cost Estimate

**One-time setup:**

- ~$0.50-$2.00 depending on PDF size
- Based on OpenAI embedding costs

**Per query:**

- ~$0.0001-$0.0005 per user question
- Very affordable!

## 📖 What Happens Next?

Once initialized, your chatbot in `ChatBot.js` will:

1. Receive user questions
2. Query the Pinecone index for relevant content
3. Use GPT to generate answers based on your PDF
4. Return accurate, context-aware responses

## ✅ You're Done!

The chatbot is now powered by your PDF knowledge base! 🎉
