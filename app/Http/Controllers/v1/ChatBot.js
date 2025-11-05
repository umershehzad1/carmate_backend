// Controller for AI-enabled chatbot for vehicle search, dealers, repairs, insurance
const axios = require("axios");
const { Sequelize } = require("sequelize");
const json = require("../../../Traits/ApiResponser");
const db = require("../../../Models/index");
const Contact = db.Contact;
const User = db.User;
const Vehicle = db.Vehicle;
const Advertisement = db.Advertisement;
const Dealer = db.Dealer;
const Repair = db.Repair;
const Insurance = db.Insurance;
let o = {};
o.chatbot = async function (req, res) {
  try {
    const { userId, message, conversationHistory = [] } = req.body;

    if (!userId) {
      return json.errorResponse(res, "Missing userId");
    }

    // If no message and no conversation history, return greeting and menu
    if (!message && conversationHistory.length === 0) {
      return json.successResponse(res, {
        messages: [
          {
            type: "bot",
            content:
              "👋 Welcome to Carmate! I'm your AI assistant, here to help you with everything automotive.",
          },
          {
            type: "bot",
            content:
              "How can I assist you today?\n\n1️⃣ 🚗 **Find Vehicles** - Search for cars based on your preferences\n2️⃣ 🏪 **Find Dealers** - Locate nearby car dealerships\n3️⃣ 🔧 **Find Repairs** - Find repair shops and mechanics\n4️⃣ 🛡️ **Find Insurance** - Get insurance recommendations\n\nJust let me know what you're looking for!",
          },
        ],
        conversationHistory: [],
        sessionStart: true,
      });
    }

    if (!message) {
      return json.errorResponse(res, "Missing message");
    }

    // Correct spelling in the message
    const correctedMessage = await correctSpelling(message);
    console.log("Original message:", message);
    console.log("Corrected message:", correctedMessage);

    // Analyze user intent using AI
    const userMessageLower = correctedMessage.toLowerCase();
    let intent = await analyzeUserIntent(userMessageLower);

    // Check if user explicitly mentions what they want (vehicle, dealer, repair, insurance)
    const hasExplicitIntent =
      /\b(vehicle|vehicles|car|cars|auto|automobile|dealer|dealers|dealership|dealerships|showroom|showrooms|repair|repairs|mechanic|mechanics|service|fix|maintenance|insurance|coverage|policy|policies)\b/i.test(
        userMessageLower
      );

    // Check if message is just about changing location (e.g., "now in Calgary")
    // This pattern suggests continuing the previous search type with a new location
    // BUT only if user didn't explicitly mention what they want
    const locationChangePattern =
      /\b(now|also|what about|how about)\b.*\b(in|at|near|around|for)\s+[a-z\s]+/i;
    const justLocationPattern =
      /^\b(in|at|near|around|for)\s+[a-z\s]+\b(now|today|please)?$/i;

    if (
      !hasExplicitIntent && // Only maintain context if user didn't explicitly say what they want
      (locationChangePattern.test(userMessageLower) ||
        justLocationPattern.test(userMessageLower))
    ) {
      // Check previous 3 messages for context to maintain search type
      const recentMessages = conversationHistory.slice(-6); // Last 6 messages (3 user + 3 bot)

      for (let i = recentMessages.length - 1; i >= 0; i--) {
        const historyMsg = recentMessages[i];
        if (historyMsg.role === "user" || historyMsg.role === "bot") {
          // Check what the previous conversation was about
          if (/dealer|dealership|showroom/i.test(historyMsg.content)) {
            console.log(
              "Maintaining dealer search context from previous messages"
            );
            intent = {
              category: "dealer_search",
              type: "dealer_search",
              confidence: 0.95,
            };
            break;
          } else if (
            /repair|mechanic|service|fix|maintenance/i.test(historyMsg.content)
          ) {
            console.log(
              "Maintaining repair search context from previous messages"
            );
            intent = {
              category: "repair_search",
              type: "repair_search",
              confidence: 0.95,
            };
            break;
          } else if (/insurance|coverage|policy/i.test(historyMsg.content)) {
            console.log(
              "Maintaining insurance search context from previous messages"
            );
            intent = {
              category: "insurance_search",
              type: "insurance_search",
              confidence: 0.95,
            };
            break;
          }
        }
      }
    }

    // Check if user is just providing location/details without specifying what they're looking for
    // Look at last 1-3 messages to understand context
    if (intent.category === "general_help" || intent.confidence < 0.7) {
      const locationOnlyPattern =
        /\b(in|at|near|around|for|find)\s+[a-z\s]+\b(now|today|please)?\b/i;
      const simpleLocationPattern = /^[a-z\s]+(now|today|please)?$/i;

      if (
        locationOnlyPattern.test(userMessageLower) ||
        simpleLocationPattern.test(userMessageLower)
      ) {
        // Check previous 3 messages for context
        const recentMessages = conversationHistory.slice(-6); // Last 6 messages (3 user + 3 bot)

        for (let i = recentMessages.length - 1; i >= 0; i--) {
          const historyMsg = recentMessages[i];
          if (historyMsg.role === "user" || historyMsg.role === "bot") {
            // Check what the previous conversation was about
            if (/dealer|dealership|showroom/i.test(historyMsg.content)) {
              intent = {
                category: "dealer_search",
                type: "dealer_search",
                confidence: 0.9,
              };
              console.log("Detected dealer search from context");
              break;
            } else if (
              /repair|mechanic|service|fix|maintenance/i.test(
                historyMsg.content
              )
            ) {
              intent = {
                category: "repair_search",
                type: "repair_search",
                confidence: 0.9,
              };
              console.log("Detected repair search from context");
              break;
            } else if (/insurance|coverage|policy/i.test(historyMsg.content)) {
              intent = {
                category: "insurance_search",
                type: "insurance_search",
                confidence: 0.9,
              };
              console.log("Detected insurance search from context");
              break;
            }
          }
        }
      }
    }

    // FINAL OVERRIDE: Check if user explicitly mentions what they want
    // This takes ABSOLUTE priority over AI classification and conversation context
    // Must be checked LAST to ensure it overrides everything else
    if (
      /\b(vehicle|vehicles|car|cars|auto|automobile)\b/i.test(userMessageLower)
    ) {
      console.log(
        "🚗 Explicit VEHICLE search detected - FORCING vehicle_search"
      );
      intent = {
        category: "vehicle_search",
        type: "vehicle_search",
        confidence: 1.0,
      };
    } else if (
      /\b(dealer|dealers|dealership|dealerships|showroom|showrooms)\b/i.test(
        userMessageLower
      )
    ) {
      console.log("🏪 Explicit DEALER search detected - FORCING dealer_search");
      intent = {
        category: "dealer_search",
        type: "dealer_search",
        confidence: 1.0,
      };
    } else if (
      /\b(repair|repairs|mechanic|mechanics|garage|garages)\b/i.test(
        userMessageLower
      )
    ) {
      console.log("🔧 Explicit REPAIR search detected - FORCING repair_search");
      intent = {
        category: "repair_search",
        type: "repair_search",
        confidence: 1.0,
      };
    } else if (
      /\b(insurance|coverage|policy|policies)\b/i.test(userMessageLower)
    ) {
      console.log(
        "🛡️ Explicit INSURANCE search detected - FORCING insurance_search"
      );
      intent = {
        category: "insurance_search",
        type: "insurance_search",
        confidence: 1.0,
      };
    }

    console.log(
      "Final intent decision:",
      intent.category,
      "- Confidence:",
      intent.confidence
    );

    let botResponse = {};
    let contextData = {
      intent: intent.type,
      category: intent.category,
    };

    switch (intent.category) {
      case "vehicle_search":
        botResponse = await handleVehicleSearch(
          correctedMessage,
          conversationHistory
        );
        break;

      case "dealer_search":
        botResponse = await handleDealerSearch(
          correctedMessage,
          conversationHistory
        );
        break;

      case "repair_search":
        botResponse = await handleRepairSearch(
          correctedMessage,
          conversationHistory
        );
        break;

      case "insurance_search":
        botResponse = await handleInsuranceSearch(
          correctedMessage,
          conversationHistory
        );
        break;

      case "general_help":
      default:
        botResponse = await generateAIResponse(
          correctedMessage,
          conversationHistory,
          intent
        );
    }

    // Add user message to history
    const updatedHistory = [
      ...conversationHistory,
      { role: "user", content: message },
    ];

    return json.successResponse(res, {
      message: botResponse.content || botResponse.bot,
      type: botResponse.type || "text",
      data: botResponse.data || null,
      contextData,
      conversationHistory: updatedHistory,
    });
  } catch (err) {
    console.error("Chatbot error:", err);
    return json.errorResponse(res, "Unable to process your request");
  }
};

// Correct spelling mistakes in user message
async function correctSpelling(message) {
  try {
    const correctionPrompt = `Correct any spelling mistakes in this message. Keep the same meaning and tone. Only fix spelling errors, don't change the wording.
    
    Message: "${message}"
    
    Return ONLY the corrected message text, nothing else.`;

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: correctionPrompt }],
        max_tokens: 150,
        temperature: 0.1,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const corrected = response.data.choices[0].message.content.trim();
    // Remove quotes if AI wrapped the response in quotes
    return corrected.replace(/^["']|["']$/g, "");
  } catch (err) {
    console.error("Spell correction error:", err);
    // If spell correction fails, return original message
    return message;
  }
}

// Analyze user intent using AI
async function analyzeUserIntent(message) {
  try {
    const systemPrompt = `You are an intent classifier for a car marketplace chatbot. Classify the user's message into one of these categories:
    
    1. "vehicle_search" - User wants to find, search, or browse vehicles/cars
    2. "dealer_search" - User wants to find dealerships, showrooms, or sellers
    3. "repair_search" - User wants to find repair shops, mechanics, or maintenance services
    4. "insurance_search" - User wants insurance information or recommendations
    5. "general_help" - General questions or other inquiries
    
    Respond ONLY with valid JSON in this format:
    {"category": "vehicle_search|dealer_search|repair_search|insurance_search|general_help", "confidence": 0.95}`;

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        max_tokens: 100,
        temperature: 0.3,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    let content = response.data.choices[0].message.content.trim();

    // Remove markdown code blocks if present
    if (content.startsWith("```json")) {
      content = content.replace(/```json\s*/g, "").replace(/```\s*$/g, "");
    } else if (content.startsWith("```")) {
      content = content.replace(/```\s*/g, "");
    }

    const parsed = JSON.parse(content);

    return {
      type: parsed.category,
      category: parsed.category,
      confidence: parsed.confidence,
    };
  } catch (err) {
    console.error("Intent analysis error:", err);
    return { type: "general_help", category: "general_help", confidence: 0 };
  }
}

// Handle vehicle search
async function handleVehicleSearch(message, conversationHistory) {
  try {
    // Extract vehicle preferences using AI
    const extractionPrompt = `Extract vehicle preferences from this message. Return JSON with these fields (use null if not mentioned):
    {"make": "brand or null", "model": "model or null", "maxPrice": "number or null", "minPrice": "number or null", "city": "city or null", "bodyType": "SUV|Sedan|Truck or null", "year": "year or null"}
    
    User message: "${message}"
    
    Return ONLY valid JSON.`;

    const extractionResponse = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: extractionPrompt }],
        max_tokens: 200,
        temperature: 0.3,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    let preferences;
    try {
      let content = extractionResponse.data.choices[0].message.content.trim();

      // Remove markdown code blocks if present
      if (content.startsWith("```json")) {
        content = content.replace(/```json\s*/g, "").replace(/```\s*$/g, "");
      } else if (content.startsWith("```")) {
        content = content.replace(/```\s*/g, "");
      }

      preferences = JSON.parse(content);
    } catch (jsonErr) {
      console.error(
        "Vehicle search: Failed to parse preferences JSON:",
        extractionResponse.data.choices[0].message.content
      );
      throw jsonErr;
    }

    // Check if we have enough info - at least ONE search criterion is required
    const hasAtLeastOneCriteria =
      preferences.make ||
      preferences.model ||
      preferences.maxPrice ||
      preferences.minPrice ||
      preferences.city ||
      preferences.bodyType ||
      preferences.year;

    if (!hasAtLeastOneCriteria) {
      // Generate varied follow-up messages asking for search criteria
      const followUpMessages = [
        "I'd love to help you find a vehicle! Could you tell me what kind of car you're looking for? For example, the make, model, price range, or location?",
        "Great! Let me help you search for vehicles. What are you interested in? You can tell me the brand, budget, or city where you're looking.",
        "I'm here to help! To find the perfect vehicle for you, could you share some details? Like the make, price range, or which city you're searching in?",
        "Sure! To get started with your vehicle search, please tell me more - what's your budget, preferred brand, or location?",
        "I can help you find vehicles! Please share at least one preference: make/model, price range, city, body type, or year.",
      ];

      const randomMessage =
        followUpMessages[Math.floor(Math.random() * followUpMessages.length)];

      return {
        content: randomMessage,
        type: "follow_up",
        data: { preferences, needsMoreInfo: true },
      };
    }

    // Build database query for vehicles (searches via ads)
    const vehicleWhere = {};

    if (preferences.make) {
      vehicleWhere.make = { [Sequelize.Op.iLike]: `%${preferences.make}%` };
    }
    if (preferences.model) {
      vehicleWhere.model = { [Sequelize.Op.iLike]: `%${preferences.model}%` };
    }
    if (preferences.city) {
      vehicleWhere.city = { [Sequelize.Op.iLike]: `%${preferences.city}%` };
    }
    if (preferences.bodyType) {
      vehicleWhere.bodyType = preferences.bodyType;
    }

    // Note: Price filtering will be done after fetching since price might be stored as string
    // We'll filter in JavaScript to ensure proper numeric comparison

    if (preferences.year) {
      vehicleWhere.year = preferences.year.toString();
    }

    // Debug: Log preferences and where clause
    console.log("Vehicle search preferences:", preferences);
    console.log("Vehicle search where clause:", vehicleWhere);

    // Query advertisements with running status and include associated vehicle
    let advertisements;
    try {
      advertisements = await Advertisement.findAll({
        where: {
          status: "running",
        },
        include: [
          {
            model: Vehicle,
            as: "vehicle",
            where: vehicleWhere,
            required: true,
          },
        ],
        limit: 20, // Increased limit since we'll filter by price in JavaScript
        order: [["createdAt", "DESC"]],
      });
    } catch (dbErr) {
      console.error("Vehicle search DB error:", dbErr);
      throw dbErr;
    }

    // Filter by price in JavaScript to handle string/number comparison correctly
    if (
      advertisements &&
      advertisements.length > 0 &&
      (preferences.maxPrice || preferences.minPrice)
    ) {
      advertisements = advertisements.filter((ad) => {
        const vehiclePrice = parseFloat(ad.vehicle.price);

        // Skip if price is not a valid number
        if (isNaN(vehiclePrice)) {
          console.log(
            `Skipping vehicle with invalid price: ${ad.vehicle.price}`
          );
          return false;
        }

        // Check max price
        if (
          preferences.maxPrice &&
          vehiclePrice > parseFloat(preferences.maxPrice)
        ) {
          console.log(
            `Vehicle price ${vehiclePrice} exceeds max ${preferences.maxPrice}`
          );
          return false;
        }

        // Check min price
        if (
          preferences.minPrice &&
          vehiclePrice < parseFloat(preferences.minPrice)
        ) {
          console.log(
            `Vehicle price ${vehiclePrice} below min ${preferences.minPrice}`
          );
          return false;
        }

        console.log(`Vehicle price ${vehiclePrice} matches criteria`);
        return true;
      });
    }

    // Limit to top 5 results after price filtering
    if (advertisements.length > 5) {
      advertisements = advertisements.slice(0, 5);
    }

    if (!advertisements || advertisements.length === 0) {
      // Generate empathetic no-results message
      const noResultsMessages = [
        `I couldn't find any ${preferences.make || "vehicles"} matching your criteria${preferences.city ? ` in ${preferences.city}` : ""}. Would you like to try different search criteria?`,
        `Sorry, no ${preferences.make || "vehicles"} available${preferences.city ? ` in ${preferences.city}` : ""} at the moment. Can I help you search for something else?`,
        `Unfortunately, I don't see any ${preferences.make || "vehicles"} that match your requirements${preferences.city ? ` in ${preferences.city}` : ""}. Try adjusting your budget or location?`,
      ];

      const randomNoResultMessage =
        noResultsMessages[Math.floor(Math.random() * noResultsMessages.length)];

      return {
        content: randomNoResultMessage,
        type: "no_results",
        data: { vehicles: [], preferences },
      };
    }

    // Format vehicle results with vehicle names like "2020 Range Rover"
    const formattedVehicles = advertisements.map((ad) => {
      const v = ad.vehicle;
      const vehicleName =
        `${v.year || ""} ${v.make || ""} ${v.model || ""}`.trim();

      // Create a short description (max 100 chars)
      let shortDescription = v.description || "";
      if (shortDescription.length > 100) {
        shortDescription = shortDescription.substring(0, 100) + "...";
      }

      // Generate a brief auto-description if no description exists
      if (!shortDescription) {
        const features = [];
        if (v.mileage) features.push(`${v.mileage} km`);
        if (v.transmission) features.push(v.transmission);
        if (v.fuelType) features.push(v.fuelType);
        if (v.condition) features.push(v.condition);

        shortDescription = features.join(" • ") || "Great vehicle available";
      }

      return {
        id: v.id,
        adId: ad.id,
        slug: v.slug,
        vehicleName: vehicleName,
        make: v.make,
        model: v.model,
        year: v.year,
        price: v.price,
        city: v.city,
        bodyType: v.bodyType,
        mileage: v.mileage,
        transmission: v.transmission,
        fuelType: v.fuelType,
        condition: v.condition,
        image:
          Array.isArray(v.images) && v.images.length > 0 ? v.images[0] : null,
        description: v.description,
        shortDescription: shortDescription,
        detailsUrl: `/car-details/${v.slug}?adId=${ad.id}`,
      };
    });

    // Build context message based on search criteria
    let contextParts = [];
    if (preferences.city) contextParts.push(`in ${preferences.city}`);
    if (preferences.make) contextParts.push(`for ${preferences.make}`);
    if (preferences.minPrice && preferences.maxPrice) {
      contextParts.push(
        `within $${preferences.minPrice} - $${preferences.maxPrice}`
      );
    } else if (preferences.maxPrice) {
      contextParts.push(`under $${preferences.maxPrice}`);
    } else if (preferences.minPrice) {
      contextParts.push(`above $${preferences.minPrice}`);
    }
    if (preferences.bodyType) contextParts.push(`${preferences.bodyType} type`);
    if (preferences.year) contextParts.push(`${preferences.year} model`);

    const contextMessage =
      contextParts.length > 0 ? ` ${contextParts.join(", ")}` : "";

    // Generate introduction message with varied responses
    const introMessages = [
      `I have found ${formattedVehicles.length} vehicle${formattedVehicles.length > 1 ? "s" : ""} for you${contextMessage}:`,
      `Great! I found ${formattedVehicles.length} vehicle${formattedVehicles.length > 1 ? "s" : ""}${contextMessage}:`,
      `Perfect! Here ${formattedVehicles.length > 1 ? "are" : "is"} ${formattedVehicles.length} vehicle${formattedVehicles.length > 1 ? "s" : ""}${contextMessage}:`,
    ];

    const randomIntroMessage =
      introMessages[Math.floor(Math.random() * introMessages.length)];

    // Create structured vehicle list for frontend rendering
    const vehicleListItems = formattedVehicles.map((v, index) => {
      const formattedPrice = v.price
        ? `$${parseInt(v.price).toLocaleString()}`
        : "Price on request";

      return {
        number: index + 1,
        name: v.vehicleName,
        price: formattedPrice,
        description: v.shortDescription,
        url: v.detailsUrl,
        image: v.image,
        slug: v.slug,
        adId: v.adId,
      };
    });

    // Build HTML message content for frontend rendering
    let htmlContent = `<p>${randomIntroMessage}</p><br/>`;

    vehicleListItems.forEach((vehicle) => {
      htmlContent += `<div style="margin-bottom: 20px;">`;
      htmlContent += `<p><strong>${vehicle.number}. ${vehicle.name}</strong> - ${vehicle.price}</p>`;
      htmlContent += `<p style="margin: 5px 0;">${vehicle.description}</p>`;
      htmlContent += `<a href="/car-details/${vehicle.slug}?adId=${vehicle.adId}" style="color: #2563eb; text-decoration: none; cursor: pointer;">View Details</a>`;
      htmlContent += `</div>`;
    });

    return {
      content: htmlContent,
      type: "vehicle_results",
      isHtml: true,
      data: {
        vehicles: formattedVehicles,
        vehicleList: vehicleListItems,
        count: formattedVehicles.length,
        preferences,
      },
    };
  } catch (err) {
    console.error("Vehicle search error:", err);
    return {
      content:
        "I encountered an issue while searching for vehicles. Please try again.",
      type: "error",
    };
  }
}

// Handle dealer search
async function handleDealerSearch(message, conversationHistory) {
  try {
    // Check only the last 1-2 messages for city context related to dealers
    let cityFromHistory = null;
    const recentMessages = conversationHistory.slice(-4); // Last 4 messages (2 user + 2 bot)

    for (let i = recentMessages.length - 1; i >= 0; i--) {
      const historyMsg = recentMessages[i];
      if (historyMsg.role === "user") {
        // Only use city from history if the previous message was also about dealers
        const isDealerRelated = /dealer|dealership|showroom|seller/i.test(
          historyMsg.content
        );
        if (isDealerRelated) {
          const cityMatch = historyMsg.content.match(
            /\b(toronto|calgary|vancouver|montreal|ottawa|edmonton|winnipeg|quebec|hamilton|kitchener|london|victoria|halifax|oshawa|windsor|saskatoon|regina|barrie|kelowna|abbotsford|kingston)\b/i
          );
          if (cityMatch) {
            cityFromHistory = cityMatch[1];
            break;
          }
        }
      }
    }

    // Extract location from current message
    const locationPrompt = `Extract the city or location from this message. Return JSON: {"city": "city name or null"}
    Message: "${message}"
    Return ONLY valid JSON.`;

    const locationResponse = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: locationPrompt }],
        max_tokens: 50,
        temperature: 0.3,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    let content = locationResponse.data.choices[0].message.content.trim();

    // Remove markdown code blocks if present
    if (content.startsWith("```json")) {
      content = content.replace(/```json\s*/g, "").replace(/```\s*$/g, "");
    } else if (content.startsWith("```")) {
      content = content.replace(/```\s*/g, "");
    }

    const location = JSON.parse(content);

    // Only use city from current message, don't fall back to history automatically
    let searchCity = location.city;

    // Check if user mentioned a country instead of a city
    const isCountryMention = /\b(canada|canadian)\b/i.test(message);

    if (!searchCity && isCountryMention) {
      // User mentioned Canada but no specific city - show all dealers
      console.log(
        "User mentioned Canada without specific city - showing all dealers"
      );

      const allDealers = await Dealer.findAll({
        where: {
          status: "verified",
        },
        limit: 10,
        order: [["createdAt", "DESC"]],
      });

      if (!allDealers || allDealers.length === 0) {
        return {
          content: `Sorry, I couldn't find any verified dealers at the moment. Please try again later.`,
          type: "no_results",
          data: { dealers: [], location: "Canada" },
        };
      }

      // Format dealer results
      const formattedDealers = allDealers.map((d) => ({
        id: d.id,
        location: d.location,
        image: d.image,
        status: d.status,
        availableCarListing: d.availableCarListing,
        openingTime: d.openingTime,
        closingTime: d.closingTime,
        analytics: d.analytics,
        slug: d.slug,
      }));

      // Create intro message
      const introMessage = `I found ${allDealers.length} verified dealers across Canada:`;

      // Build HTML content for dealers
      let htmlContent = `<p>${introMessage}</p><br/>`;

      formattedDealers.forEach((dealer, index) => {
        htmlContent += `<div style="margin-bottom: 20px;">`;
        htmlContent += `<p><strong>${index + 1}. ${dealer.location || "Dealer"}</strong></p>`;
        if (dealer.openingTime && dealer.closingTime) {
          htmlContent += `<p style="margin: 5px 0;">Hours: ${dealer.openingTime} - ${dealer.closingTime}</p>`;
        }
        htmlContent += `<a href="/dealer-details/${dealer.slug}" style="color: #2563eb; text-decoration: none; cursor: pointer;">View Dealer</a>`;
        htmlContent += `</div>`;
      });

      return {
        content: htmlContent,
        type: "dealer_results",
        isHtml: true,
        data: {
          dealers: formattedDealers,
          dealerList: formattedDealers.map((d, index) => ({
            number: index + 1,
            location: d.location,
            availableCarListing: d.availableCarListing,
            openingTime: d.openingTime,
            closingTime: d.closingTime,
            slug: d.slug,
            url: `/dealer-details/${d.slug}`,
          })),
          count: allDealers.length,
          location: "Canada",
        },
      };
    }

    if (!searchCity) {
      return {
        content:
          "I'd love to help you find dealers! Could you please tell me which city you're looking for dealers in? For example: Toronto, Calgary, Vancouver, Montreal, etc.",
        type: "follow_up",
        data: { needsCity: true },
      };
    }

    console.log("Searching for dealers in:", searchCity);

    // Query dealers from database
    const dealers = await Dealer.findAll({
      where: {
        location: { [Sequelize.Op.iLike]: `%${searchCity}%` },
        status: "verified",
      },
      limit: 10,
      order: [["createdAt", "DESC"]],
    });

    console.log("Found dealers:", dealers.length);

    if (!dealers || dealers.length === 0) {
      // Variable messages for no results
      const noResultMessages = [
        `Sorry, I couldn't find any dealers in ${searchCity}. Please try searching in a different city.`,
        `Unfortunately, I don't have any dealer listings for ${searchCity} at the moment. Would you like to try another location?`,
        `I wasn't able to find any dealers in ${searchCity}. You might want to check nearby cities.`,
        `No dealers found in ${searchCity}. Please try a different city or check back later.`,
      ];

      const randomNoResultMessage =
        noResultMessages[Math.floor(Math.random() * noResultMessages.length)];

      return {
        content: randomNoResultMessage,
        type: "no_results",
        data: { dealers: [], location: searchCity },
      };
    }

    // Format dealer results
    const formattedDealers = dealers.map((d) => ({
      id: d.id,
      location: d.location,
      image: d.image,
      status: d.status,
      availableCarListing: d.availableCarListing,
      openingTime: d.openingTime,
      closingTime: d.closingTime,
      analytics: d.analytics,
      slug: d.slug,
    }));

    // Create intro message
    const introMessages = [
      `I found ${dealers.length} verified dealer${dealers.length > 1 ? "s" : ""} in ${searchCity}:`,
      `Great! Here ${dealers.length > 1 ? "are" : "is"} ${dealers.length} dealer${dealers.length > 1 ? "s" : ""} in ${searchCity}:`,
      `Perfect! I found ${dealers.length} dealer${dealers.length > 1 ? "s" : ""} for you in ${searchCity}:`,
    ];

    const randomIntroMessage =
      introMessages[Math.floor(Math.random() * introMessages.length)];

    // Build HTML content for dealers
    let htmlContent = `<p>${randomIntroMessage}</p><br/>`;

    formattedDealers.forEach((dealer, index) => {
      htmlContent += `<div style="margin-bottom: 20px;">`;
      htmlContent += `<p><strong>${index + 1}. ${dealer.location || "Dealer"}</strong></p>`;
      if (dealer.openingTime && dealer.closingTime) {
        htmlContent += `<p style="margin: 5px 0;">Hours: ${dealer.openingTime} - ${dealer.closingTime}</p>`;
      }
      htmlContent += `<a href="/dealer-details/${dealer.slug}" style="color: #2563eb; text-decoration: none; cursor: pointer;">View Dealer</a>`;
      htmlContent += `</div>`;
    });

    return {
      content: htmlContent,
      type: "dealer_results",
      isHtml: true,
      data: {
        dealers: formattedDealers,
        dealerList: formattedDealers.map((d, index) => ({
          number: index + 1,
          location: d.location,
          openingTime: d.openingTime,
          closingTime: d.closingTime,
          slug: d.slug,
          url: `/dealer-details/${d.slug}`,
        })),
        count: dealers.length,
        location: searchCity,
      },
    };
  } catch (err) {
    console.error("Dealer search error:", err);
    console.error("Error stack:", err.stack);
    return {
      content: `I encountered an issue while searching for dealers: ${err.message}. Please try again or contact support.`,
      type: "error",
    };
  }
}

// Handle repair search
async function handleRepairSearch(message, conversationHistory) {
  try {
    // Extract location from message
    const locationPrompt = `Extract the city or location from this message. Also identify repair type if mentioned (general repair, oil change, transmission, etc). 
    Return JSON: {"city": "city or null", "repairType": "repair type or null"}
    Message: "${message}"
    Return ONLY valid JSON.`;

    const locationResponse = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: locationPrompt }],
        max_tokens: 100,
        temperature: 0.3,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    let content = locationResponse.data.choices[0].message.content.trim();

    // Remove markdown code blocks if present
    if (content.startsWith("```json")) {
      content = content.replace(/```json\s*/g, "").replace(/```\s*$/g, "");
    } else if (content.startsWith("```")) {
      content = content.replace(/```\s*/g, "");
    }

    const location = JSON.parse(content);

    // Check if user mentioned a country instead of a city
    const isCountryMention = /\b(canada|canadian)\b/i.test(message);

    if (!location.city && !isCountryMention) {
      return {
        content:
          "I'd be happy to help you find a repair shop! Which city or area are you in? For example: Toronto, Calgary, Vancouver, Montreal, etc.",
        type: "follow_up",
        data: { needsCity: true },
      };
    }

    // Query repair shops
    const where = {
      status: "verified",
    };

    // Only add city filter if a specific city was mentioned (not just "Canada")
    if (location.city && !isCountryMention) {
      where.location = { [Sequelize.Op.iLike]: `%${location.city}%` };
    }

    if (location.repairType) {
      where.servicesOffer = {
        [Sequelize.Op.iLike]: `%${location.repairType}%`,
      };
    }

    const repairs = await Repair.findAll({
      where,
      limit: 10,
      order: [["createdAt", "DESC"]],
    });

    if (!repairs || repairs.length === 0) {
      const locationText = isCountryMention
        ? "across Canada"
        : `in ${location.city}`;

      const serviceType = location.repairType
        ? ` specializing in ${location.repairType}`
        : "";

      // Variable messages for no results
      const noResultMessages = [
        `Sorry, I couldn't find any repair shops ${locationText}${serviceType}. Please try a different location.`,
        `Unfortunately, I don't have any repair shop listings ${locationText}${serviceType} at the moment. Would you like to try another city?`,
        `I wasn't able to find any repair shops ${locationText}${serviceType}. You might want to check nearby areas.`,
        `No repair shops found ${locationText}${serviceType}. Please try a different city or check back later.`,
      ];

      const randomNoResultMessage =
        noResultMessages[Math.floor(Math.random() * noResultMessages.length)];

      return {
        content: randomNoResultMessage,
        type: "repair_results",
        data: { repairList: [] },
      };
    }

    const formattedRepairs = repairs.map((r) => ({
      id: r.id,
      location: r.location,
      experience: r.experience,
      specialty: r.specialty,
      servicesOffer: r.servicesOffer,
      AboutUs: r.AboutUs,
      gallery: r.gallery,
      status: r.status,
      image: r.image,
      slug: r.slug,
      openingTime: r.openingTime,
      closingTime: r.closingTime,
      CustomerInsigts: r.CustomerInsigts,
      LeadToAppointments: r.LeadToAppointments,
      MostInDemandServices: r.MostInDemandServices,
    }));

    // Create intro message
    const locationText = isCountryMention
      ? "across Canada"
      : `in ${location.city}`;

    const introMessages = [
      `I found ${repairs.length} verified repair shop${repairs.length > 1 ? "s" : ""} ${locationText}:`,
      `Great! Here ${repairs.length > 1 ? "are" : "is"} ${repairs.length} repair shop${repairs.length > 1 ? "s" : ""} ${locationText}:`,
      `Perfect! I found ${repairs.length} verified repair shop${repairs.length > 1 ? "s" : ""} for you ${locationText}:`,
    ];

    const randomIntroMessage =
      introMessages[Math.floor(Math.random() * introMessages.length)];

    // Build HTML content for repair shops
    let htmlContent = `<p>${randomIntroMessage}</p><br/>`;

    formattedRepairs.forEach((repair, index) => {
      htmlContent += `<div style="margin-bottom: 20px;">`;
      htmlContent += `<p><strong>${index + 1}. ${repair.location || "Repair Shop"}</strong></p>`;
      if (repair.specialty) {
        htmlContent += `<p style="margin: 5px 0;">Specialty: ${repair.specialty}</p>`;
      }
      if (repair.experience) {
        htmlContent += `<p style="margin: 5px 0;">Experience: ${repair.experience} years</p>`;
      }
      if (repair.openingTime && repair.closingTime) {
        htmlContent += `<p style="margin: 5px 0;">Hours: ${repair.openingTime} - ${repair.closingTime}</p>`;
      }
      htmlContent += `<a href="/repair-details/${repair.slug}" style="color: #2563eb; text-decoration: none; cursor: pointer;">View Details</a>`;
      htmlContent += `</div>`;
    });

    return {
      content: htmlContent,
      type: "repair_results",
      isHtml: true,
      data: {
        repairs: formattedRepairs,
        repairList: formattedRepairs.map((r, index) => ({
          number: index + 1,
          location: r.location,
          specialty: r.specialty,
          experience: r.experience,
          openingTime: r.openingTime,
          closingTime: r.closingTime,
          slug: r.slug,
          url: `/repair-details/${r.slug}`,
        })),
        count: repairs.length,
        location: location.city,
      },
    };
  } catch (err) {
    console.error("Repair search error:", err);
    return {
      content: "I had trouble finding repair shops. Please try again.",
      type: "error",
    };
  }
}

// Handle insurance search
async function handleInsuranceSearch(message, conversationHistory) {
  try {
    // Extract insurance preferences
    const extractionPrompt = `Extract insurance preferences from this message. Return JSON:
    {"insuranceType": "comprehensive|third-party|both or null", "coverage": "amount or null", "vehicleType": "car type or null", "city": "city or null"}
    Message: "${message}"
    Return ONLY valid JSON.`;

    const extractionResponse = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: extractionPrompt }],
        max_tokens: 100,
        temperature: 0.3,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    let content = extractionResponse.data.choices[0].message.content.trim();

    // Remove markdown code blocks if present
    if (content.startsWith("```json")) {
      content = content.replace(/```json\s*/g, "").replace(/```\s*$/g, "");
    } else if (content.startsWith("```")) {
      content = content.replace(/```\s*/g, "");
    }

    const preferences = JSON.parse(content);

    // Check if user mentioned a country instead of a city
    const isCountryMention = /\b(canada|canadian)\b/i.test(message);

    if (!preferences.city && !isCountryMention) {
      return {
        content:
          "I can help you find insurance options! Which city are you located in? For example: Toronto, Calgary, Vancouver, Montreal, etc.",
        type: "follow_up",
        data: { preferences, needsCity: true },
      };
    }

    // Query insurance providers
    const where = {
      status: "verified",
    };

    // Only add city filter if a specific city was mentioned (not just "Canada")
    if (preferences.city && !isCountryMention) {
      where.location = { [Sequelize.Op.iLike]: `%${preferences.city}%` };
    }

    // No coverageType in Insurance model

    const insuranceProviders = await Insurance.findAll({
      where,
      limit: 10,
      // No rating field in Insurance model
    });

    if (!insuranceProviders || insuranceProviders.length === 0) {
      const locationText = isCountryMention
        ? "across Canada"
        : `in ${preferences.city}`;

      // Variable messages for no results
      const noResultMessages = [
        `Sorry, I couldn't find any insurance providers ${locationText}. Please try a different location.`,
        `Unfortunately, I don't have any insurance provider listings ${locationText} at the moment. Would you like to try another city?`,
        `I wasn't able to find any insurance providers ${locationText}. You might want to check nearby areas.`,
        `No insurance providers found ${locationText}. Please try a different city or check back later.`,
      ];

      const randomNoResultMessage =
        noResultMessages[Math.floor(Math.random() * noResultMessages.length)];

      return {
        content: randomNoResultMessage,
        type: "insurance_results",
        data: { insuranceList: [] },
      };
    }

    const formattedInsurance = insuranceProviders.map((i) => ({
      id: i.id,
      location: i.location,
      experience: i.experience,
      keyBenifits: i.keyBenifits,
      speciality: i.speciality,
      claimProcess: i.claimProcess,
      aboutUs: i.aboutUs,
      status: i.status,
      image: i.image,
      slug: i.slug,
      openingTime: i.openingTime,
      closingTime: i.closingTime,
      faqs: i.faqs,
    }));

    // Create intro message
    const locationText = isCountryMention
      ? "across Canada"
      : `in ${preferences.city}`;

    const introMessages = [
      `I found ${insuranceProviders.length} verified insurance provider${insuranceProviders.length > 1 ? "s" : ""} ${locationText}:`,
      `Great! Here ${insuranceProviders.length > 1 ? "are" : "is"} ${insuranceProviders.length} insurance provider${insuranceProviders.length > 1 ? "s" : ""} ${locationText}:`,
      `Perfect! I found ${insuranceProviders.length} verified insurance provider${insuranceProviders.length > 1 ? "s" : ""} for you ${locationText}:`,
    ];

    const randomIntroMessage =
      introMessages[Math.floor(Math.random() * introMessages.length)];

    // Build HTML content for insurance providers
    let htmlContent = `<p>${randomIntroMessage}</p><br/>`;

    formattedInsurance.forEach((insurance, index) => {
      htmlContent += `<div style="margin-bottom: 20px;">`;
      htmlContent += `<p><strong>${index + 1}. ${insurance.location || "Insurance Provider"}</strong></p>`;
      if (insurance.speciality) {
        htmlContent += `<p style="margin: 5px 0;">Specialty: ${insurance.speciality}</p>`;
      }
      if (insurance.experience) {
        htmlContent += `<p style="margin: 5px 0;">Experience: ${insurance.experience} years</p>`;
      }
      if (insurance.openingTime && insurance.closingTime) {
        htmlContent += `<p style="margin: 5px 0;">Hours: ${insurance.openingTime} - ${insurance.closingTime}</p>`;
      }
      htmlContent += `<a href="/insurance-details/${insurance.slug}" style="color: #2563eb; text-decoration: none; cursor: pointer;">View Details</a>`;
      htmlContent += `</div>`;
    });

    return {
      content: htmlContent,
      type: "insurance_results",
      isHtml: true,
      data: {
        insurance: formattedInsurance,
        insuranceList: formattedInsurance.map((i, index) => ({
          number: index + 1,
          location: i.location,
          speciality: i.speciality,
          experience: i.experience,
          openingTime: i.openingTime,
          closingTime: i.closingTime,
          slug: i.slug,
          url: `/insurance-details/${i.slug}`,
        })),
        count: insuranceProviders.length,
        location: preferences.city,
      },
    };
  } catch (err) {
    console.error("Insurance search error:", err);
    return {
      content: "I had trouble finding insurance options. Please try again.",
      type: "error",
    };
  }
}

// Generate AI response for general queries
async function generateAIResponse(message, conversationHistory, intent) {
  try {
    const messages = [
      {
        role: "system",
        content: `You are Carmate's AI assistant. You help users with:
        - Finding vehicles (cars, motorcycles, etc.)
        - Locating dealerships and sellers
        - Finding repair shops and mechanics
        - Getting insurance recommendations
        - General platform support
        
        Be friendly, helpful, and conversational. If unsure, ask clarifying questions.`,
      },
      ...conversationHistory.slice(-4), // Include last 4 messages for context
      { role: "user", content: message },
    ];

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages,
        max_tokens: 300,
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return {
      content: response.data.choices[0].message.content,
      type: "general",
    };
  } catch (err) {
    console.error("AI response error:", err);
    return {
      content:
        "I'm having trouble processing your request. Could you rephrase that?",
      type: "error",
    };
  }
}

// Helper function to generate AI message
async function generateAIMessage(prompt) {
  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 150,
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.choices[0].message.content;
  } catch (err) {
    console.error("Generate AI message error:", err);
    return "Here are the results we found for you.";
  }
}

// Helper function to get nearby cities
async function getNearbyCities(city) {
  try {
    // This should query your database for nearby cities
    // For now, return the same city
    const nearbyCities = await City.findAll({
      where: {
        name: { [Sequelize.Op.iLike]: `%${city}%` },
      },
      attributes: ["name"],
      raw: true,
    });

    return nearbyCities.map((c) => c.name);
  } catch (err) {
    console.error("Get nearby cities error:", err);
    return [city];
  }
}

module.exports = o;
