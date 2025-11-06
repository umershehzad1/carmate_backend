# 🤖 Carmate Production Chatbot - Complete Guide

## 🎯 Overview

The Carmate Chatbot is a production-grade AI assistant powered by GPT-4o-mini with tool calling capabilities. It combines:

- **Knowledge Base (Pinecone RAG)**: Answers FAQs and platform questions
- **Database Search (PostgreSQL)**: Finds vehicles, dealers, repair shops, and insurance
- **Intent Detection**: Smart routing to appropriate tools
- **Session Management**: Maintains conversation context

## 🚀 Features

### 1. **Knowledge Base Queries**

- Answers questions about Carmate platform
- Features, how-to guides, policies, FAQs
- Powered by Pinecone vector database

### 2. **Vehicle Search**

- Search by make, model, year, price range, city
- Returns up to 5 matching advertisements
- Includes contact information

### 3. **Dealer Search**

- Find verified car dealers by city
- Shows ratings, contact info, address

### 4. **Repair Shop Search**

- Locate auto repair services by city
- Lists available services

### 5. **Insurance Search**

- Find insurance providers by city
- Shows provider types and contact info

## 📋 API Endpoint

### POST `/api/v1/chatbot`

**Request Body:**

```json
{
  "session_id": "user_12345",
  "message": "I want to buy a Toyota Camry"
}
```

**Response:**

```json
{
  "reply": "Found 3 vehicle(s):\n\n1. Toyota Camry (2022)...",
  "intent": "buying",
  "session_id": "user_12345"
}
```

## 🔧 Configuration

### Environment Variables (.env)

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key

# Pinecone Configuration
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_INDEX=carmate

# Database (already configured in your app)
# Uses Sequelize models: Vehicle, Advertisement, Dealer, Repair, Insurance
```

## 🛠️ How It Works

### Intent Detection Flow

```
User Message
    ↓
Intent Detection (GPT-4o-mini)
    ↓
┌─────────────────┬──────────┬─────────┬─────────┬──────────────┐
│   Knowledge     │  Buying  │ Dealer  │ Repair  │  Insurance   │
└─────────────────┴──────────┴─────────┴─────────┴──────────────┘
         ↓              ↓          ↓         ↓          ↓
    Pinecone       Database   Database  Database   Database
       RAG          Search     Search    Search     Search
```

### Tool Calling Architecture

Each intent maps to a specific tool:

1. **`search_knowledge_base`**: Queries Pinecone → GPT-4o-mini for answer
2. **`search_vehicle_ads`**: Queries Advertisement + Vehicle tables
3. **`search_dealers`**: Queries Dealer table filtered by city
4. **`search_repair_shops`**: Queries Repair table filtered by city
5. **`search_insurance`**: Queries Insurance table filtered by city

## 📝 Intent Examples

### Knowledge Intent

- "What is Carmate?"
- "How do I register?"
- "What features are available?"
- "Tell me about the platform"

### Buying Intent

- "I want to buy a car"
- "Show me Toyota vehicles"
- "Looking for Honda Civic under $20000"
- "Cars available in New York"

### Dealer Intent

- "Find dealers in Los Angeles"
- "Show me car dealers near me in Chicago"
- "Where can I find a dealership in Miami?"

### Repair Intent

- "I need a repair shop in Boston"
- "Auto mechanic in Seattle"
- "Car service centers in Dallas"

### Insurance Intent

- "Car insurance in Phoenix"
- "Find insurance providers in Denver"
- "Where can I get vehicle insurance?"

## 🧪 Testing

### 1. Test Pinecone Setup

```bash
node scripts/testPinecone.js
```

### 2. Test Chatbot (when server is running)

```bash
node scripts/testChatbot.js
```

### 3. Manual Testing with cURL

```bash
# Knowledge Base Query
curl -X POST http://localhost:3000/api/v1/chatbot \
  -H "Content-Type: application/json" \
  -d '{"session_id":"test123","message":"What is Carmate?"}'

# Vehicle Search
curl -X POST http://localhost:3000/api/v1/chatbot \
  -H "Content-Type: application/json" \
  -d '{"session_id":"test123","message":"I want a Toyota Camry"}'

# Find Dealers
curl -X POST http://localhost:3000/api/v1/chatbot \
  -H "Content-Type: application/json" \
  -d '{"session_id":"test123","message":"Show dealers in New York"}'
```

## 🔍 Database Schema Requirements

### Advertisement Model

```javascript
{
  id: UUID,
  price: Number,
  city: String,
  vehicle: Vehicle (association),
  user: User (association)
}
```

### Vehicle Model

```javascript
{
  make: String,
  model: String,
  year: Number,
  price: Number,
  mileage: Number,
  condition: String,
  city: String
}
```

### Dealer Model

```javascript
{
  business_name: String,
  city: String,
  address: String,
  phone: String,
  rating: Number,
  verified: Boolean,
  user: User (association)
}
```

### Repair Model

```javascript
{
  shop_name: String,
  city: String,
  address: String,
  phone: String,
  services: Array<String>
}
```

### Insurance Model

```javascript
{
  provider_name: String,
  type: String,
  city: String,
  contact_info: String
}
```

## 🎨 Production Best Practices

### 1. **Error Handling**

- All tools wrapped in try-catch
- Graceful fallbacks for missing data
- User-friendly error messages

### 2. **Session Management**

- Sessions stored in memory Map
- History limited to 20 messages
- Automatic cleanup prevents memory leaks

### 3. **Performance**

- Lazy initialization of Pinecone (first use only)
- Database queries optimized with limits
- Efficient intent detection

### 4. **Security**

- Input validation
- Sanitized responses
- No exposure of internal errors in production

### 5. **Scalability**

- Stateless design (sessions can be moved to Redis)
- Tool-based architecture (easy to add new tools)
- Modular code structure

## 🚨 Troubleshooting

### Issue: "Pinecone index not found"

**Solution**: Run `node scripts/initializePinecone.js` first

### Issue: "No vehicles found"

**Solution**: Ensure Advertisement and Vehicle tables have data

### Issue: "No dealers found in [city]"

**Solution**: Check Dealer table has entries for that city

### Issue: Intent detection wrong

**Solution**: Intent detection uses GPT-4o-mini's natural understanding. May vary slightly. The system handles edge cases gracefully.

### Issue: Session not maintaining context

**Solution**: Use the same `session_id` across requests

## 📊 Monitoring & Logging

The chatbot logs important events:

```javascript
console.log(
  `[Chatbot] Session: ${session_id}, Intent: ${intent}, Message: ${message}`
);
```

Monitor these in production:

- Intent distribution
- Tool usage frequency
- Error rates
- Response times

## 🔄 Extending the Chatbot

### Adding a New Tool

```javascript
const myNewTool = new DynamicStructuredTool({
  name: "my_tool",
  description: "What this tool does",
  schema: z.object({
    param: z.string().describe("Parameter description"),
  }),
  func: async ({ param }) => {
    // Your logic here
    return "Result";
  },
});

// Add to tools array
const tools = [...existingTools, myNewTool];
```

### Adding a New Intent

1. Update `detectIntent()` prompt
2. Add handling in main controller
3. Map to appropriate tool

## 💡 Tips for Best Results

1. **Knowledge Base**: Keep PDF updated with latest FAQs
2. **Data Quality**: Ensure clean, complete data in database
3. **Testing**: Test with real user queries regularly
4. **Monitoring**: Track which intents are most common
5. **Feedback**: Collect user feedback to improve responses

## 📈 Next Steps

- [ ] Add Redis for session storage (scalability)
- [ ] Implement conversation memory (multi-turn)
- [ ] Add sentiment analysis
- [ ] Create admin dashboard for monitoring
- [ ] A/B test different prompts
- [ ] Add multilingual support

## ✅ Checklist Before Going Live

- [x] Pinecone index created and populated
- [x] Database models properly associated
- [x] Environment variables configured
- [ ] Test with real user data
- [ ] Load testing completed
- [ ] Error monitoring setup
- [ ] Rate limiting implemented
- [ ] API documentation published

---

**Built with ❤️ using LangChain, OpenAI GPT-4o-mini, and Pinecone**
