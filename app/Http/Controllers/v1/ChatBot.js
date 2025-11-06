// Production-grade AI chatbot with agent-based tool calling
const { ChatOpenAI } = require("@langchain/openai");
const { OpenAIEmbeddings } = require("@langchain/openai");
const { Pinecone } = require("@pinecone-database/pinecone");
const { PineconeStore } = require("@langchain/pinecone");
const { DynamicStructuredTool } = require("@langchain/core/tools");
const {
  ChatPromptTemplate,
  MessagesPlaceholder,
} = require("@langchain/core/prompts");
const { HumanMessage, AIMessage } = require("@langchain/core/messages");
const { z } = require("zod");
const { Op } = require("sequelize");
const db = require("../../../Models/index");
const User = db.User;
const Vehicle = db.Vehicle;
const Advertisement = db.Advertisement;
const Dealer = db.Dealer;
const Repair = db.Repair;
const Insurance = db.Insurance;
const ChatbotLog = db.ChatbotLog;

const { OPENAI_API_KEY, PINECONE_API_KEY, PINECONE_INDEX } = process.env;

/* ---------- CONFIGURATION ---------- */
const llm = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
  apiKey: OPENAI_API_KEY,
  maxTokens: 2000, // Increase max tokens to allow longer responses
  modelKwargs: {
    response_format: { type: "text" },
  },
});

// Session management with chat history
const sessions = new Map();
function getSession(id) {
  if (!sessions.has(id)) {
    sessions.set(id, {
      chatHistory: [],
      metadata: {},
      lastSearch: {
        type: null, // 'vehicles', 'dealers', 'repairs', 'insurance'
        criteria: {},
        offset: 0,
        totalResults: 0,
      },
    });
  }
  return sessions.get(id);
}

/* ---------- PINECONE RAG SETUP ---------- */
let vectorStore = null;
let retriever = null;

async function initializeRAG() {
  if (vectorStore) return;

  try {
    const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
    const pineconeIndex = pinecone.Index(PINECONE_INDEX || "carmate");
    const embeddings = new OpenAIEmbeddings({
      model: "text-embedding-3-large",
      apiKey: OPENAI_API_KEY,
    });

    vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex,
    });
    retriever = vectorStore.asRetriever({ k: 3 });
    console.log("[Chatbot] RAG initialized successfully");
  } catch (error) {
    console.error("[Chatbot] RAG initialization error:", error);
    throw error;
  }
}

/* ---------- TOOLS DEFINITION ---------- */

/**
 * Tool: Search Knowledge Base (Pinecone + RAG)
 */
const searchKnowledgeBaseTool = new DynamicStructuredTool({
  name: "search_knowledge_base",
  description:
    "Search the Carmate knowledge base to answer questions about the platform, features, FAQs, how-to guides, policies, and general information. Use this when users ask 'What is Carmate?', 'How do I...?', 'What features...?', etc.",
  schema: z.object({
    query: z
      .string()
      .describe("The user's question to search in the knowledge base"),
  }),
  func: async ({ query }) => {
    try {
      await initializeRAG();
      const docs = await retriever.invoke(query);

      if (!docs || docs.length === 0) {
        return "I couldn't find specific information about that in my knowledge base. Could you rephrase your question or ask about something else?";
      }

      const context = docs
        .map((d, i) => `[Source ${i + 1}]\n${d.pageContent}`)
        .join("\n\n");

      const answerPrompt = `You are a helpful Carmate assistant. Answer the user's question using ONLY the provided context from the knowledge base.

Question: ${query}

Context from Knowledge Base:
${context}

Instructions:
- Provide a clear, concise, and helpful answer
- Only use information from the context above
- If the context doesn't contain the answer, say "I don't have that information in my knowledge base"
- Be friendly and professional
- Format your response in a readable way

Answer:`;

      const response = await llm.invoke(answerPrompt);
      return response.content;
    } catch (error) {
      console.error("[Tool] Knowledge base search error:", error);
      return "I'm having trouble accessing the knowledge base right now. Please try again in a moment.";
    }
  },
});

/**
 * Tool: Search Vehicle Advertisements
 */
function createSearchVehiclesTool(sessionId) {
  return new DynamicStructuredTool({
    name: "search_vehicles",
    description:
      "Search for vehicle advertisements in the database. Use this ONLY after collecting search criteria from the user. Required information: city/location and price range. Optional: make (brand), model, year. If user says 'show more', set showMore to true to see next page of results. DO NOT call this tool until you have at least city and price information from the user.",
    schema: z.object({
      make: z
        .string()
        .optional()
        .describe("Vehicle make/brand (e.g., Toyota, Honda, Range Rover)"),
      model: z
        .string()
        .optional()
        .describe("Vehicle model (e.g., Camry, Civic, Mustang)"),
      minPrice: z.number().optional().describe("Minimum price in dollars"),
      maxPrice: z.number().optional().describe("Maximum price in dollars"),
      year: z
        .number()
        .optional()
        .describe("Manufacturing year (e.g., 2020, 2021)"),
      city: z
        .string()
        .optional()
        .describe("City location (e.g., Toronto, Vancouver, New York)"),
      showMore: z
        .boolean()
        .optional()
        .describe(
          "Set to true if user wants to see more results from previous search"
        ),
    }),
    func: async ({ make, model, minPrice, maxPrice, year, city, showMore }) => {
      try {
        const session = getSession(sessionId);
        let offset = 0;

        // If user wants to show more, use previous search criteria
        if (showMore && session.lastSearch.type === "vehicles") {
          offset = session.lastSearch.offset + 5;
          make = session.lastSearch.criteria.make;
          model = session.lastSearch.criteria.model;
          minPrice = session.lastSearch.criteria.minPrice;
          maxPrice = session.lastSearch.criteria.maxPrice;
          year = session.lastSearch.criteria.year;
          city = session.lastSearch.criteria.city;
        } else {
          // New search - reset offset
          offset = 0;
        }

        // Build where clause for Advertisement and Vehicle
        const advertisementWhereClause = { status: "running" };
        const vehicleWhereClause = { status: "live" };

        if (make) vehicleWhereClause.make = { [Op.iLike]: `%${make}%` };
        if (model) vehicleWhereClause.model = { [Op.iLike]: `%${model}%` };
        if (year) vehicleWhereClause.year = year.toString();
        if (city) vehicleWhereClause.city = { [Op.iLike]: `%${city}%` };

        // Add price filtering with CAST to handle string price column
        if (minPrice !== undefined && maxPrice !== undefined) {
          // Both min and max price specified
          vehicleWhereClause[Op.and] = db.sequelize.where(
            db.sequelize.cast(db.sequelize.col("vehicle.price"), "DECIMAL"),
            { [Op.between]: [minPrice, maxPrice] }
          );
        } else if (minPrice !== undefined) {
          // Only minimum price specified
          vehicleWhereClause[Op.and] = db.sequelize.where(
            db.sequelize.cast(db.sequelize.col("vehicle.price"), "DECIMAL"),
            { [Op.gte]: minPrice }
          );
        } else if (maxPrice !== undefined) {
          // Only maximum price specified
          vehicleWhereClause[Op.and] = db.sequelize.where(
            db.sequelize.cast(db.sequelize.col("vehicle.price"), "DECIMAL"),
            { [Op.lte]: maxPrice }
          );
        }

        // Count total results from Advertisement table
        const totalCount = await Advertisement.count({
          where: advertisementWhereClause,
          include: [
            {
              model: Vehicle,
              as: "vehicle",
              where: vehicleWhereClause,
              required: true,
            },
          ],
          distinct: true,
        });

        // Search from Advertisement table and include Vehicle data
        const advertisements = await Advertisement.findAll({
          where: advertisementWhereClause,
          include: [
            {
              model: Vehicle,
              as: "vehicle",
              where: vehicleWhereClause,
              required: true,
              include: [
                {
                  model: User,
                  as: "user",
                  attributes: ["id", "fullname", "email", "phone"],
                },
              ],
            },
          ],
          limit: 5,
          offset: offset,
          order: [["createdAt", "DESC"]],
          distinct: true,
        });

        // Store search info for pagination
        session.lastSearch = {
          type: "vehicles",
          criteria: { make, model, minPrice, maxPrice, year, city },
          offset: offset,
          totalResults: totalCount,
        };

        if (!advertisements || advertisements.length === 0) {
          if (offset > 0) {
            return "No more vehicles found. That's all the results I have for your search.";
          }

          const criteria = [];
          if (make) criteria.push(`make: ${make}`);
          if (model) criteria.push(`model: ${model}`);
          if (minPrice || maxPrice)
            criteria.push(`price: $${minPrice || 0} - $${maxPrice || "any"}`);
          if (year) criteria.push(`year: ${year}`);
          if (city) criteria.push(`city: ${city}`);

          return `I couldn't find any vehicles${
            criteria.length > 0 ? ` matching (${criteria.join(", ")})` : ""
          }. 

Try:
- Searching in a different city
- Adjusting your price range
- Looking for a different make or model`;
        }

        const results = advertisements
          .map((ad, idx) => {
            const vehicle = ad.vehicle;
            const slug =
              vehicle.slug ||
              `${vehicle.make}-${vehicle.model}-${vehicle.year}`
                .toLowerCase()
                .replace(/\s+/g, "-");
            const adId = ad.id;
            const link = `[View Details](/car-details/${slug}?adId=${adId})`;

            return `🚗 ${offset + idx + 1}. ${vehicle.make || "N/A"} ${
              vehicle.model || "N/A"
            } (${vehicle.year || "N/A"})
   💰 Price: $${vehicle.price || "N/A"}
   📏 Mileage: ${vehicle.mileage || "N/A"} km
   ⚙️ Transmission: ${vehicle.transmission || "N/A"}
   ✨ Condition: ${vehicle.condition || "N/A"}
   📍 Location: ${vehicle.city || "N/A"}${
     vehicle.province ? `, ${vehicle.province}` : ""
   }
   👤 Seller: ${vehicle.user?.fullname || "Dealer"}
   ${link}`;
          })
          .join("\n\n");

        // Build search description
        const searchParts = [];
        if (make) searchParts.push(make);
        if (model) searchParts.push(model);
        if (year) searchParts.push(`(${year})`);
        if (city) searchParts.push(`in ${city}`);
        if (minPrice || maxPrice) {
          searchParts.push(
            `priced $${minPrice || 0} - $${maxPrice || "unlimited"}`
          );
        }

        const searchDescription =
          searchParts.length > 0
            ? `I found ${totalCount} ${searchParts.join(" ")} vehicle${
                totalCount !== 1 ? "s" : ""
              }`
            : `I found ${totalCount} vehicle${totalCount !== 1 ? "s" : ""}`;

        const showing = `${searchDescription}. Showing ${offset + 1}-${
          offset + advertisements.length
        }:`;
        const moreInfo =
          offset + advertisements.length < totalCount
            ? "\n\nWant to see more? Just say 'show more vehicles' or 'more'!"
            : "\n\nThat's all the vehicles matching your search.";

        return `${showing}\n\n${results}${moreInfo}`;
      } catch (error) {
        console.error("[Tool] Vehicle search error:", error);
        return "I encountered an error while searching for vehicles. Please try again.";
      }
    },
  });
}

/**
 * Tool: Search Dealers
 */
const searchDealersTool = new DynamicStructuredTool({
  name: "search_dealers",
  description:
    "Search for car dealers and showrooms by location. Use this when users want to find dealers, showrooms, or car selling locations. The 'location' parameter is optional - if not provided, return general dealer information.",
  schema: z.object({
    location: z
      .string()
      .optional()
      .describe(
        "City/location name to search for dealers (e.g., Toronto, Vancouver)"
      ),
  }),
  func: async ({ location }) => {
    try {
      const whereClause = { status: "verified" };
      if (location) {
        whereClause.location = { [Op.iLike]: `%${location}%` };
      }

      const dealers = await Dealer.findAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: "user",
            attributes: ["fullname", "email", "phone"],
          },
        ],
        limit: 5,
        order: [["createdAt", "DESC"]],
      });

      if (!dealers || dealers.length === 0) {
        return location
          ? `No verified dealers found in ${location}. Try:\n- Searching in nearby cities\n- Checking the spelling\n- Browsing all dealer listings`
          : "No dealers found. Please check back later.";
      }

      const results = dealers
        .map((dealer, idx) => {
          const slug = dealer.slug || `dealer-${dealer.id}`;
          const link = `[View Profile](/dealer-details/${slug})`;

          return `🏢 ${idx + 1}. Dealer in ${dealer.location || "N/A"}
   👤 Contact: ${dealer.user?.fullname || "N/A"}${dealer.user?.phone ? ` - ${dealer.user.phone}` : ""}
   📧 Email: ${dealer.user?.email || "N/A"}
   🕐 Hours: ${dealer.openingTime || "N/A"} - ${dealer.closingTime || "N/A"}
   ✓ Verified
   ${link}`;
        })
        .join("\n\n");

      return `Found ${dealers.length} verified dealer(s)${location ? ` in ${location}` : ""}:\n\n${results}`;
    } catch (error) {
      console.error("[Tool] Dealer search error:", error);
      return "I encountered an error while searching for dealers. Please try again.";
    }
  },
});

/**
 * Tool: Search Repair Shops
 */
const searchRepairShopsTool = new DynamicStructuredTool({
  name: "search_repair_shops",
  description:
    "Search for auto repair shops and maintenance service centers by location. Use this when users need vehicle repairs, maintenance, or mechanic services. Location parameter is optional.",
  schema: z.object({
    location: z
      .string()
      .optional()
      .describe(
        "City/location name to search for repair shops (e.g., Toronto)"
      ),
  }),
  func: async ({ location }) => {
    try {
      const whereClause = { status: "verified" };
      if (location) {
        whereClause.location = { [Op.iLike]: `%${location}%` };
      }

      const repairs = await Repair.findAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: "user",
            attributes: ["fullname", "email", "phone"],
          },
        ],
        limit: 5,
        order: [["createdAt", "DESC"]],
      });

      if (!repairs || repairs.length === 0) {
        return location
          ? `No repair shops found in ${location}. Try nearby cities or check spelling.`
          : "No repair shops found.";
      }

      const results = repairs
        .map((shop, idx) => {
          const specialty =
            shop.specialty && Array.isArray(shop.specialty)
              ? shop.specialty.join(", ")
              : "General repairs";

          const slug = shop.slug || `repair-${shop.id}`;
          const link = `[View Details](/repair-details/${slug})`;

          return `🔧 ${idx + 1}. Repair Shop in ${shop.location || "N/A"}
   🛠️ Specialty: ${specialty}
   💼 Experience: ${shop.experience || "N/A"} years
   👤 Contact: ${shop.user?.fullname || "N/A"}${shop.user?.phone ? ` - ${shop.user.phone}` : ""}
   🕐 Hours: ${shop.openingTime || "N/A"} - ${shop.closingTime || "N/A"}
   ${link}`;
        })
        .join("\n\n");

      return `Found ${repairs.length} repair shop(s)${location ? ` in ${location}` : ""}:\n\n${results}`;
    } catch (error) {
      console.error("[Tool] Repair shop search error:", error);
      return "I encountered an error while searching for repair shops. Please try again.";
    }
  },
});

/**
 * Tool: Search Insurance Providers
 */
const searchInsuranceTool = new DynamicStructuredTool({
  name: "search_insurance",
  description:
    "Search for vehicle insurance providers by location. Use this when users are looking for car insurance, auto insurance quotes, or insurance providers. Location parameter is optional.",
  schema: z.object({
    location: z
      .string()
      .optional()
      .describe(
        "City/location name to search for insurance providers (e.g., Toronto)"
      ),
  }),
  func: async ({ location }) => {
    try {
      const whereClause = { status: "verified" };
      if (location) {
        whereClause.location = { [Op.iLike]: `%${location}%` };
      }

      const insurances = await Insurance.findAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: "user",
            attributes: ["fullname", "email", "phone"],
          },
        ],
        limit: 5,
        order: [["createdAt", "DESC"]],
      });

      if (!insurances || insurances.length === 0) {
        return location
          ? `No insurance providers found in ${location}. Try nearby cities or check spelling.`
          : "No insurance providers found.";
      }

      const results = insurances
        .map((ins, idx) => {
          const speciality =
            ins.speciality && Array.isArray(ins.speciality)
              ? ins.speciality.join(", ")
              : "Auto insurance";

          const slug = ins.slug || `insurance-${ins.id}`;
          const link = `[View Details](/insurance-details/${slug})`;

          return `🛡️ ${idx + 1}. Insurance Provider in ${ins.location || "N/A"}
   📋 Speciality: ${speciality}
   💼 Experience: ${ins.experience || "N/A"} years
   👤 Contact: ${ins.user?.fullname || "N/A"}${ins.user?.phone ? ` - ${ins.user.phone}` : ""}
   🕐 Hours: ${ins.openingTime || "N/A"} - ${ins.closingTime || "N/A"}
   ${link}`;
        })
        .join("\n\n");

      return `Found ${insurances.length} insurance provider(s)${location ? ` in ${location}` : ""}:\n\n${results}`;
    } catch (error) {
      console.error("[Tool] Insurance search error:", error);
      return "I encountered an error while searching for insurance providers. Please try again.";
    }
  },
});

/* ---------- AGENT SETUP ---------- */

async function initializeAgent(sessionId) {
  // Create session-aware tools
  const tools = [
    searchKnowledgeBaseTool,
    createSearchVehiclesTool(sessionId),
    searchDealersTool,
    searchRepairShopsTool,
    searchInsuranceTool,
  ];

  // System prompt for the agent
  const systemPrompt = `You are Carmate Assistant, a helpful and friendly AI assistant for the Carmate vehicle marketplace platform.

**Your Role:**
- Help users find vehicles, dealers, repair shops, and insurance providers
- Answer questions about the Carmate platform using the knowledge base
- Be conversational, friendly, and professional
- Provide accurate information using the available tools
- Collect all necessary search criteria before performing a search

**Available Tools:**
1. search_knowledge_base: Answer questions about Carmate platform, features, FAQs, policies
2. search_vehicles: Find vehicles for sale (search by make, model, price, year, city - all optional). If user says "show more", set showMore to true.
3. search_dealers: Find car dealers in a specific location
4. search_repair_shops: Find auto repair shops in a specific location
5. search_insurance: Find insurance providers in a specific city

**Guidelines for Vehicle Search:**
- When users want to search for cars, ask for important details BEFORE calling the search tool:
  * What city/location are they looking in?
  * Do they have a preferred make/brand? (e.g., Toyota, Honda, BMW)
  * Do they have a preferred model? (optional)
  * What's their budget/price range?
  * Any preference for year? (optional)
- Ask these questions in a friendly, conversational way
- Collect at least city and price range before searching
- Example: "I'd be happy to help you find a car! To show you the best options, could you tell me: 1) Which city are you looking in? 2) What's your budget range?"
- Only call search_vehicles tool AFTER you have collected the necessary information
- If user says "show more", "more results", "next", set showMore parameter to true in the search tool

**Guidelines for Other Searches:**
- For greetings, respond warmly and mention what you can help with
- Extract search parameters intelligently from user messages
- If a tool returns no results, suggest alternatives
- Always be helpful and guide users to the right information
- Keep responses clear, concise, and well-formatted

**Important:**
- ALWAYS return the COMPLETE tool response to the user - don't summarize or truncate it
- When a tool returns vehicle listings, show ALL of them in your response
- Don't call search_vehicles until you have at least city and price information from the user
- If you don't know something, check the knowledge base first
- When user says "show more", use the same tool with showMore=true
- The tool response already includes a properly formatted introduction - just pass it through
- Never cut off or summarize the vehicle listings - show the complete tool output

Remember: Ask for details first, then search with complete criteria and return the FULL tool response!`;

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", systemPrompt],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
  ]);

  // Bind tools to the model for function calling
  const modelWithTools = llm.bindTools(tools);

  // Return executor with tools
  return {
    modelWithTools,
    tools,
    prompt,
  };
}

/* ---------- HELPER FUNCTIONS FOR LOGGING ---------- */
/**
 * Detect intent from user message and tool calls
 */
function detectIntent(message, toolCalls, toolResults) {
  const lowerMessage = message.toLowerCase();

  // Check tool calls first (most reliable)
  if (toolCalls && toolCalls.length > 0) {
    const toolName = toolCalls[0].name;
    if (toolName === "search_vehicles") return "search_cars";
    if (toolName === "search_repair_shops") return "repair_request";
    if (toolName === "search_insurance_providers") return "insurance_request";
  }

  // Keyword-based detection
  if (
    lowerMessage.match(
      /\b(car|vehicle|buy|price|make|model|honda|toyota|ford|suv|sedan)\b/i
    )
  ) {
    return "search_cars";
  }
  if (
    lowerMessage.match(/\b(repair|mechanic|fix|garage|service|maintenance)\b/i)
  ) {
    return "repair_request";
  }
  if (lowerMessage.match(/\b(insurance|insure|coverage|policy)\b/i)) {
    return "insurance_request";
  }
  if (
    lowerMessage.match(
      /\b(how|what|when|where|can i|help|guide|post|ad|advertisement)\b/i
    )
  ) {
    return "faq";
  }

  return "general";
}

/**
 * Extract context from tool calls and results
 */
function extractContext(message, toolCalls, toolResults, ragUsed) {
  const context = {
    rag_used: ragUsed || false,
    tool_calls: [],
  };

  if (toolCalls && toolCalls.length > 0) {
    toolCalls.forEach((toolCall, idx) => {
      context.tool_calls.push({
        tool: toolCall.name,
        args: toolCall.args,
        result_preview:
          toolResults && toolResults[idx]
            ? toolResults[idx].substring(0, 200) + "..."
            : null,
      });
    });
  }

  return context;
}

/**
 * Log chatbot conversation asynchronously (non-blocking)
 */
async function logConversation(
  sessionId,
  userId,
  message,
  response,
  intent,
  context
) {
  // Run asynchronously without blocking the response
  setImmediate(async () => {
    try {
      await ChatbotLog.create({
        session_id: sessionId,
        user_id: userId || null,
        intent: intent || "general",
        message: message,
        response: response,
        context: context || {},
        feedback: "neutral",
      });
      console.log(`[ChatbotLog] Logged conversation for session: ${sessionId}`);
    } catch (logError) {
      console.error("[ChatbotLog] Error logging conversation:", logError);
      // Don't throw - logging failures shouldn't affect user experience
    }
  });
}

/* ---------- MAIN CHATBOT CONTROLLER ---------- */
exports.chatbot = async (req, res) => {
  try {
    const { session_id, message, stream = true } = req.body;

    // Validation
    if (!session_id || !message) {
      return res.status(400).json({
        error: "Missing required fields",
        message:
          "I'm unable to connect. Please refresh the page and try again.",
        success: false,
      });
    }

    if (typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({
        error: "Invalid message",
        message: "Please enter a valid message and try again.",
        success: false,
      });
    }

    // Get user ID from request (if authenticated)
    const userId = req.user?.id || null;

    // Initialize systems
    await initializeRAG();
    const executor = await initializeAgent(session_id);

    // Get session
    const session = getSession(session_id);

    // Prepare chat history for the agent
    const chatHistory = session.chatHistory
      .slice(-10)
      .map((msg) =>
        msg.role === "user"
          ? new HumanMessage(msg.content)
          : new AIMessage(msg.content)
      );

    console.log(`[Chatbot] Session: ${session_id}, Message: "${message}"`);

    // Execute agent with manual tool calling
    const messages = await executor.prompt.formatMessages({
      input: message,
      chat_history: chatHistory,
    });

    // Get response from model with tools
    const aiMessage = await executor.modelWithTools.invoke(messages);

    // Check if model wants to call tools
    let finalResponse = aiMessage.content;
    let toolCallsData = aiMessage.tool_calls || [];
    let toolResults = [];

    if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
      // Execute tool calls
      for (const toolCall of aiMessage.tool_calls) {
        const tool = executor.tools.find((t) => t.name === toolCall.name);
        if (tool) {
          try {
            const toolResult = await tool.invoke(toolCall.args);
            toolResults.push(toolResult);
            // For now, use the tool result as the final response
            // In a more complex setup, you'd feed this back to the model
            finalResponse = toolResult;
          } catch (toolError) {
            console.error(`[Chatbot] Tool execution error:`, toolError);
            finalResponse =
              "I encountered an error while searching. Please try again.";
          }
        }
      }
    }

    const response = finalResponse;

    // Detect intent and extract context for logging
    const intent = detectIntent(message, toolCallsData, toolResults);
    const context = extractContext(message, toolCallsData, toolResults, true);

    // Log conversation asynchronously (non-blocking)
    logConversation(session_id, userId, message, response, intent, context);

    // Update session history
    session.chatHistory.push(
      { role: "user", content: message },
      { role: "assistant", content: response }
    );

    // Limit history size
    if (session.chatHistory.length > 20) {
      session.chatHistory = session.chatHistory.slice(-20);
    }

    console.log(`[Chatbot] Response generated (${response.length} chars)`);

    // If streaming is enabled, stream the response
    if (stream) {
      // Set headers for Server-Sent Events
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Stream the response word by word or character by character
      const words = response.split(" ");

      for (let i = 0; i < words.length; i++) {
        const word = words[i] + (i < words.length - 1 ? " " : "");

        // Send chunk
        res.write(
          `data: ${JSON.stringify({
            chunk: word,
            done: false,
            session_id,
          })}\n\n`
        );

        // Add small delay between words for streaming effect (adjust for speed)
        await new Promise((resolve) => setTimeout(resolve, 30));
      }

      // Send final message
      res.write(
        `data: ${JSON.stringify({
          chunk: "",
          done: true,
          session_id,
          fullMessage: response,
        })}\n\n`
      );

      res.end();
    } else {
      // Non-streaming response (backward compatibility)
      return res.json({
        reply: response,
        session_id,
        success: true,
      });
    }
  } catch (error) {
    console.error("[Chatbot] Error:", error);

    // User-friendly error message
    let errorMessage =
      "I'm having trouble responding right now. Please try again.";

    if (error.message?.includes("API key")) {
      errorMessage =
        "I'm unable to connect. Please refresh the page and try again.";
    } else if (error.message?.includes("rate limit")) {
      errorMessage =
        "I'm receiving too many requests right now. Please try again in a moment.";
    } else if (error.message?.includes("session")) {
      errorMessage =
        "I'm unable to connect. Please refresh the page and try again.";
    }

    return res.status(500).json({
      error: "Internal server error",
      message: errorMessage,
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
      success: false,
    });
  }
};

/* ---------- FEEDBACK ENDPOINT ---------- */
exports.submitFeedback = async (req, res) => {
  try {
    const { session_id, message_index, feedback } = req.body;

    // Validation
    if (!session_id || feedback === undefined) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "session_id and feedback are required",
      });
    }

    if (!["positive", "negative"].includes(feedback)) {
      return res.status(400).json({
        error: "Invalid feedback",
        message: "Feedback must be 'positive' or 'negative'",
      });
    }

    // Find the most recent log entry for this session and message
    // If message_index is provided, we can use it to identify the specific message
    const whereClause = {
      session_id: session_id,
    };

    // Update the most recent matching log
    const updated = await ChatbotLog.update(
      { feedback: feedback },
      {
        where: whereClause,
        order: [["created_at", "DESC"]],
        limit: 1,
      }
    );

    if (updated[0] === 0) {
      return res.status(404).json({
        error: "Log not found",
        message: "No chatbot log found for this session",
        success: false,
      });
    }

    console.log(
      `[ChatbotLog] Feedback '${feedback}' recorded for session: ${session_id}`
    );

    return res.json({
      success: true,
      message: "Feedback recorded successfully",
    });
  } catch (error) {
    console.error("[ChatbotLog] Error recording feedback:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to record feedback",
      success: false,
    });
  }
};
