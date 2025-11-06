# Pinecone Knowledge Base Setup

This directory contains scripts to initialize and manage your Carmate chatbot's knowledge base in Pinecone.

## Prerequisites

1. **Environment Variables**: Make sure your `.env` file contains:

   ```env
   OPENAI_API_KEY=your_openai_api_key
   PINECONE_API_KEY=your_pinecone_api_key
   PINECONE_INDEX=carmate-knowledge
   PINECONE_ENV=your_pinecone_environment
   ```

2. **Dependencies**: Already installed in your project (langchain, openai, pinecone)

## Scripts

### 1. Initialize Pinecone Index (`initializePinecone.js`)

This is the **main script** to run first. It will:

- Create a Pinecone index (if it doesn't exist)
- Load documentation from various sources (README, docs, custom content)
- Split documents into chunks
- Generate embeddings using OpenAI
- Upload everything to Pinecone

**Usage:**

```bash
node scripts/initializePinecone.js
```

**What it indexes:**

- `README.md` - General app information
- `docs/api/**` - API documentation
- `package.json` - Dependencies and configuration
- Custom knowledge about Carmate features, API endpoints, and database schema

**Expected output:**

```
🚀 Starting Pinecone initialization...
🔌 Initializing Pinecone client...
📊 Checking if index "carmate-knowledge" exists...
✅ Index already exists!
📚 Loading knowledge base documents...
✅ Loaded 6 documents
✂️  Splitting documents into chunks...
✅ Created 45 chunks
🚀 Generating embeddings and uploading to Pinecone...
  Processing batch 1/1 (45 chunks)...
  ✅ Uploaded batch 1/1
✅ All chunks uploaded successfully!

📊 Index Statistics:
  Total vectors: 45
  Dimension: 3072

🎉 Pinecone initialization complete!
```

### 2. Add Knowledge Document (`addKnowledgeDocument.js`)

Use this script to add individual documents or update existing knowledge.

**Interactive Mode:**

```bash
node scripts/addKnowledgeDocument.js
```

Then follow the prompts to enter:

- Category (e.g., api, features, faq)
- Source name
- Document content (type END when done)

**Quick Add FAQ:**

```bash
node scripts/addKnowledgeDocument.js faq
```

**Quick Add Troubleshooting Guide:**

```bash
node scripts/addKnowledgeDocument.js troubleshooting
```

**Add All Quick Docs:**

```bash
node scripts/addKnowledgeDocument.js all-quick
```

## Step-by-Step Setup

### Step 1: Get Pinecone API Key

1. Go to [Pinecone.io](https://www.pinecone.io/)
2. Sign up or log in
3. Create a new project (if needed)
4. Copy your API key from the console
5. Note your environment (e.g., `us-east-1-aws`)

### Step 2: Get OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in
3. Go to API Keys section
4. Create a new API key
5. Copy and save it securely

### Step 3: Configure Environment

Update your `.env` file:

```env
OPENAI_API_KEY=sk-...your-key...
PINECONE_API_KEY=...your-key...
PINECONE_INDEX=carmate-knowledge
PINECONE_ENV=us-east-1
```

### Step 4: Run Initialization

```bash
# From the carmate directory
node scripts/initializePinecone.js
```

**Note:** First run may take 1-2 minutes as it creates the index and waits for it to be ready.

### Step 5: Verify

The script will show statistics at the end. You should see:

- Total vectors uploaded
- Index dimension (should be 3072)
- Success message

### Step 6: Test the Chatbot

Your chatbot is now ready to answer questions! Test it with queries like:

- "How do I register a new user?"
- "What are the vehicle API endpoints?"
- "Tell me about the database schema"
- "How do I schedule a test drive?"

## Customizing Knowledge Base

### Add Custom Content

Edit `initializePinecone.js` and add to the `KNOWLEDGE_SOURCES` array:

```javascript
{
  type: 'custom',
  content: `
# Your Custom Knowledge

Your content here...
  `,
  metadata: { category: 'your-category', source: 'custom' }
}
```

### Add More Files

```javascript
{
  type: 'file',
  path: 'path/to/your/file.md',
  metadata: { category: 'documentation', source: 'custom-file' }
}
```

### Add Entire Directories

```javascript
{
  type: 'directory',
  path: 'path/to/docs',
  pattern: /\.(md|txt)$/,
  metadata: { category: 'docs', source: 'directory' }
}
```

## Configuration Options

In `initializePinecone.js`, you can modify the `CONFIG` object:

```javascript
const CONFIG = {
  indexName: "carmate-knowledge", // Pinecone index name
  dimension: 3072, // Embedding dimension (text-embedding-3-large)
  metric: "cosine", // Similarity metric
  chunkSize: 1000, // Characters per chunk
  chunkOverlap: 200, // Overlap between chunks
  batchSize: 100, // Vectors per batch upload
};
```

## Troubleshooting

### "Index not found" Error

- Wait 60 seconds after creation
- Check your PINECONE_INDEX name in .env
- Verify in Pinecone console that index exists

### "Rate limit exceeded"

- The script includes delays between batches
- If using free tier, you may need to increase delays
- Reduce `batchSize` in CONFIG

### "Invalid API key"

- Double-check your .env file
- Ensure no extra spaces in API keys
- Verify keys are active in OpenAI/Pinecone consoles

### Embeddings are expensive

- Free tier OpenAI has limits
- Each chunk costs tokens to embed
- Monitor usage in OpenAI dashboard

## Updating Knowledge Base

To update existing knowledge:

1. **Add new documents**: Use `addKnowledgeDocument.js`
2. **Replace all**: Re-run `initializePinecone.js` (will add to existing index)
3. **Delete and recreate**: Delete index in Pinecone console, then run init script

## NPM Scripts (Optional)

You can add these to `package.json` scripts section:

```json
{
  "scripts": {
    "pinecone:init": "node scripts/initializePinecone.js",
    "pinecone:add": "node scripts/addKnowledgeDocument.js",
    "pinecone:faq": "node scripts/addKnowledgeDocument.js all-quick"
  }
}
```

Then run with:

```bash
npm run pinecone:init
npm run pinecone:add
npm run pinecone:faq
```

## Support

For issues or questions:

- Check Pinecone docs: https://docs.pinecone.io/
- Check OpenAI docs: https://platform.openai.com/docs
- Check LangChain docs: https://js.langchain.com/docs/
