# 🚀 Quick Start - Carmate Chatbot

## ✅ Setup Complete!

Your production-grade chatbot is ready to use. Here's what's been implemented:

## 🎯 What the Chatbot Does

### 1. **Answers FAQs** (Knowledge Base)

Uses Pinecone + your PDF to answer questions about Carmate:

- "What is Carmate?"
- "How do I register?"
- "What features are available?"

### 2. **Finds Vehicles** (Database Search)

Searches advertisements based on:

- Make (Toyota, Honda, etc.)
- Model (Camry, Civic, etc.)
- Price range
- Year
- City
  Returns up to 5 matching vehicles with contact info.

### 3. **Finds Dealers** (Database Search)

Searches for car dealers by city:

- Shows verified dealers
- Includes ratings, address, phone

### 4. **Finds Repair Shops** (Database Search)

Locates auto repair services by city:

- Lists available services
- Shows contact information

### 5. **Finds Insurance** (Database Search)

Searches insurance providers by city:

- Shows provider types
- Includes contact details

## 🔥 How to Use

### API Endpoint

```
POST http://localhost:3000/api/v1/chatbot
```

### Request

```json
{
  "session_id": "unique_user_id",
  "message": "Your question here"
}
```

### Response

```json
{
  "reply": "The chatbot's answer",
  "intent": "knowledge/buying/dealer/repair/insurance",
  "session_id": "unique_user_id"
}
```

## 📝 Example Requests

### 1. Knowledge Base Question

```bash
curl -X POST http://localhost:3000/api/v1/chatbot \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "user123",
    "message": "What is Carmate?"
  }'
```

### 2. Search for Vehicles

```bash
curl -X POST http://localhost:3000/api/v1/chatbot \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "user123",
    "message": "I want to buy a Toyota Camry under $25000"
  }'
```

### 3. Find Dealers

```bash
curl -X POST http://localhost:3000/api/v1/chatbot \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "user123",
    "message": "Show me dealers in New York"
  }'
```

### 4. Find Repair Shops

```bash
curl -X POST http://localhost:3000/api/v1/chatbot \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "user123",
    "message": "I need a repair shop in Los Angeles"
  }'
```

### 5. Find Insurance

```bash
curl -X POST http://localhost:3000/api/v1/chatbot \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "user123",
    "message": "Where can I get insurance in Chicago?"
  }'
```

## 🧠 How It Works

```
User Message → Intent Detection → Tool Selection → Response
```

**Intent Detection** uses GPT-4o-mini to understand what the user wants:

- Knowledge questions → Search Pinecone knowledge base
- Buying vehicles → Search Advertisement database
- Finding dealers → Search Dealer database
- Finding repairs → Search Repair database
- Finding insurance → Search Insurance database

**Smart Parameter Extraction**:

- For vehicles: Extracts make, model, price, year, city
- For services: Extracts city name
- Handles incomplete info gracefully (asks follow-up questions)

## ⚙️ Environment Setup

Make sure your `.env` has:

```env
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=...
PINECONE_INDEX=carmate
```

## 📊 Database Models Used

- **Advertisement** + **Vehicle**: For vehicle searches
- **Dealer**: For dealer searches
- **Repair**: For repair shop searches
- **Insurance**: For insurance searches
- **User**: For contact information

## 🧪 Testing

### Before Testing

1. Make sure Pinecone is initialized:

   ```bash
   node scripts/initializePinecone.js
   ```

2. Start your server:
   ```bash
   npm start
   ```

### Run Tests

```bash
node scripts/testChatbot.js
```

## 🎨 Frontend Integration

### JavaScript/React Example

```javascript
async function sendMessage(message) {
  const sessionId =
    localStorage.getItem("chatSessionId") || `session_${Date.now()}`;

  const response = await fetch("http://localhost:3000/api/v1/chatbot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId,
      message: message,
    }),
  });

  const data = await response.json();
  return data.reply;
}
```

### Next.js Example

```javascript
"use client";
import { useState } from "react";

export default function ChatBot() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sessionId] = useState(`session_${Date.now()}`);

  const sendMessage = async () => {
    const userMessage = { role: "user", content: input };
    setMessages([...messages, userMessage]);

    const res = await fetch("/api/chatbot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        message: input,
      }),
    });

    const data = await res.json();
    setMessages([
      ...messages,
      userMessage,
      {
        role: "assistant",
        content: data.reply,
      },
    ]);
    setInput("");
  };

  return (
    <div className="chat-container">
      {messages.map((msg, i) => (
        <div key={i} className={`message ${msg.role}`}>
          {msg.content}
        </div>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={(e) => e.key === "Enter" && sendMessage()}
      />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
}
```

## 🔧 Customization

### Change Response Limit

In `ChatBot.js`, change `limit: 5` in any tool's `findAll()`:

```javascript
limit: 10; // Show 10 results instead of 5
```

### Modify Intent Detection

Edit the `detectIntent()` function prompt to add/change intents.

### Add New Tools

Create a new `DynamicStructuredTool` and add it to the `tools` array.

## 🐛 Common Issues

### "No vehicles found"

- Check that Advertisement and Vehicle tables have data
- Verify your search criteria isn't too specific

### "No dealers found in [city]"

- Make sure Dealer table has entries for that city
- City search is case-insensitive and uses partial matching

### "Knowledge base returns generic answer"

- Ensure Pinecone index has data (run initializePinecone.js)
- Check that your PDF has relevant information

### Intent detection seems off

- GPT-4o-mini naturally understands intent
- The system handles edge cases gracefully
- Can be fine-tuned by adjusting the detectIntent prompt

## 📈 Performance Tips

1. **Session IDs**: Use persistent session IDs per user
2. **Caching**: Consider caching common queries
3. **Database Indexes**: Ensure indexes on city, make, model columns
4. **Rate Limiting**: Implement rate limiting for production
5. **Monitoring**: Log all requests for analytics

## 🎉 You're Ready!

The chatbot is production-ready and handles:

- ✅ Intent detection
- ✅ Tool calling
- ✅ Knowledge base queries (Pinecone)
- ✅ Database searches (PostgreSQL)
- ✅ Error handling
- ✅ Session management
- ✅ Graceful fallbacks

Start testing with the examples above! 🚀
