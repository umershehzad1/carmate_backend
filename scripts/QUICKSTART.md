# 🚀 Quick Start Guide - Carmate Chatbot with Pinecone

This guide will help you set up your Carmate chatbot's knowledge base using Pinecone vector database.

## ✅ Prerequisites Checklist

- [ ] Node.js installed (v12+)
- [ ] OpenAI API account with credits
- [ ] Pinecone account (free tier works)
- [ ] Dependencies installed (`npm install` already done)

## 📋 Setup Steps

### 1. Get Your API Keys

#### OpenAI API Key

1. Go to https://platform.openai.com/
2. Sign in or create account
3. Navigate to API Keys
4. Click "Create new secret key"
5. Copy and save the key (starts with `sk-`)

#### Pinecone API Key

1. Go to https://www.pinecone.io/
2. Sign in or create account
3. Create a new project (if needed)
4. Click on "API Keys" in the left sidebar
5. Copy your API key
6. Note your environment (e.g., `us-east-1`)

### 2. Configure Environment Variables

Add these to your `.env` file in the `carmate` directory:

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-your-actual-key-here

# Pinecone Configuration
PINECONE_API_KEY=your-actual-pinecone-key-here
PINECONE_INDEX=carmate-knowledge
PINECONE_ENV=us-east-1

# PostgreSQL (optional - for partner search)
POSTGRES_DSN=postgresql://user:password@localhost:5432/carmate
```

### 3. Initialize Pinecone

Run the initialization script to create your index and upload knowledge:

```bash
node scripts/initializePinecone.js
```

**Expected output:**

```
🚀 Starting Pinecone initialization...
🔌 Initializing Pinecone client...
📊 Checking if index "carmate-knowledge" exists...
🏗️  Creating new index "carmate-knowledge"...
⏳ Waiting for index to be ready...
✅ Index created successfully!
📚 Loading knowledge base documents...
✅ Loaded 6 documents
✂️  Splitting documents into chunks...
✅ Created ~45 chunks
🚀 Generating embeddings and uploading to Pinecone...
✅ All chunks uploaded successfully!

📊 Index Statistics:
  Total vectors: 45
  Dimension: 3072

🎉 Pinecone initialization complete!
```

⏱️ **First run takes 1-2 minutes** (index creation + waiting for readiness)

### 4. Test Your Setup

Verify everything is working:

```bash
node scripts/testPinecone.js
```

This will:

- ✅ Test Pinecone connection
- ✅ Verify index has data
- ✅ Test document retrieval
- ✅ Run sample RAG queries

### 5. Use Your Chatbot

Your chatbot API is now ready! Test it with:

```bash
curl -X POST http://localhost:3000/api/v1/chatbot \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "test123",
    "message": "What is Carmate?"
  }'
```

## 🛠️ Available Scripts

### Main Scripts

| Command                                 | Description                                             |
| --------------------------------------- | ------------------------------------------------------- |
| `node scripts/initializePinecone.js`    | Initial setup - creates index and uploads all knowledge |
| `node scripts/testPinecone.js`          | Test your Pinecone setup                                |
| `node scripts/addKnowledgeDocument.js`  | Add individual documents (interactive)                  |
| `node scripts/managePinecone.js stats`  | View index statistics                                   |
| `node scripts/managePinecone.js search` | Interactive semantic search                             |

### Quick Add Documents

```bash
# Add FAQ document
node scripts/addKnowledgeDocument.js faq

# Add troubleshooting guide
node scripts/addKnowledgeDocument.js troubleshooting

# Add all quick docs
node scripts/addKnowledgeDocument.js all-quick

# Interactive mode
node scripts/addKnowledgeDocument.js
```

### Management Commands

```bash
# View statistics
node scripts/managePinecone.js stats

# Search your knowledge base
node scripts/managePinecone.js search

# Clear all vectors (⚠️ destructive)
node scripts/managePinecone.js clear

# Delete entire index (⚠️ destructive)
node scripts/managePinecone.js delete
```

## 📚 What Gets Indexed

The initialization script indexes:

1. **README.md** - General Carmate information
2. **API Documentation** - From `docs/api/` folder
3. **Package info** - Dependencies and configuration
4. **Custom Knowledge** - Hardcoded information about:
   - Carmate features overview
   - API endpoints reference
   - Database schema
   - And more...

## 🧪 Testing Queries

Try these sample queries with your chatbot:

**General Questions:**

- "What is Carmate?"
- "What features does Carmate have?"
- "Tell me about the app"

**API Questions:**

- "How do I register a user?"
- "What are the vehicle endpoints?"
- "Show me dealer API routes"

**Technical Questions:**

- "What's in the database schema?"
- "What tables are in the database?"
- "How do conversations work?"

**User Questions:**

- "How do I create an account?"
- "How can I schedule a test drive?"
- "What payment methods are supported?"

## 🔧 Customization

### Add Your Own Knowledge

Edit `scripts/initializePinecone.js` and add to `KNOWLEDGE_SOURCES`:

```javascript
{
  type: 'custom',
  content: `
# Your Custom Knowledge

Your documentation here...
  `,
  metadata: { category: 'custom', source: 'manual' }
}
```

### Change Chunk Settings

In `scripts/initializePinecone.js`, modify the `CONFIG` object:

```javascript
const CONFIG = {
  indexName: "carmate-knowledge",
  chunkSize: 1000, // Increase for longer chunks
  chunkOverlap: 200, // Overlap between chunks
  batchSize: 100, // Vectors per upload batch
};
```

## 🐛 Troubleshooting

### "Index not found"

- Wait 60 seconds after creation
- Check PINECONE_INDEX name in .env
- Verify in Pinecone console

### "Rate limit exceeded"

- Free tier has limits
- Script includes delays
- Reduce `batchSize` if needed

### "Invalid API key"

- Check .env file for typos
- No extra spaces in keys
- Verify keys are active

### Empty Index (0 vectors)

- Run `node scripts/initializePinecone.js`
- Check for errors during upload
- Verify OpenAI API has credits

### Chatbot Not Answering

- Check index has vectors: `node scripts/managePinecone.js stats`
- Test retrieval: `node scripts/testPinecone.js`
- Verify ChatBot.js uses correct index name

## 💰 Cost Estimate

**Free Tier:**

- Pinecone: 1 index, up to 100K vectors (enough for this project)
- OpenAI: ~$0.50-$1.00 for initial indexing (~45 chunks)
- OpenAI: ~$0.0001 per query

**Ongoing:**

- Each user query costs ~$0.0001-$0.0005
- Very affordable for moderate usage

## 📖 Next Steps

1. ✅ Complete setup (steps 1-4 above)
2. 🧪 Test with sample queries
3. 📝 Add your own custom knowledge
4. 🚀 Deploy your chatbot
5. 📊 Monitor usage in Pinecone dashboard

## 🆘 Need Help?

Check the detailed documentation:

- `scripts/README.md` - Full documentation
- Pinecone docs: https://docs.pinecone.io/
- OpenAI docs: https://platform.openai.com/docs
- LangChain docs: https://js.langchain.com/docs/

## 🎉 You're Ready!

Once setup is complete, your chatbot will intelligently answer questions about:

- Carmate features and functionality
- API endpoints and usage
- Database schema
- User guides and FAQs
- Troubleshooting help

The chatbot uses RAG (Retrieval-Augmented Generation) to find relevant information from your knowledge base and generate accurate, contextual responses.

Happy chatting! 🤖
