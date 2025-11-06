const { Op, fn, col, literal } = require("sequelize");
const db = require("../../../Models/index");
const ChatbotLog = db.ChatbotLog;
const User = db.User;

/* ---------- ANALYTICS CONTROLLER ---------- */

/**
 * Get top searched makes/models
 */
exports.getTopSearches = async (req, res) => {
  try {
    const { days = 30, limit = 10 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get logs with search_cars intent
    const logs = await ChatbotLog.findAll({
      where: {
        intent: "search_cars",
        created_at: {
          [Op.gte]: startDate,
        },
      },
      attributes: ["message", "context"],
    });

    // Extract search terms from messages and context
    const searchTerms = {};

    logs.forEach((log) => {
      const message = log.message.toLowerCase();

      // Extract from context if available
      if (log.context && log.context.tool_calls) {
        log.context.tool_calls.forEach((toolCall) => {
          if (toolCall.args) {
            if (toolCall.args.make) {
              searchTerms[toolCall.args.make] =
                (searchTerms[toolCall.args.make] || 0) + 1;
            }
            if (toolCall.args.model) {
              searchTerms[toolCall.args.model] =
                (searchTerms[toolCall.args.model] || 0) + 1;
            }
          }
        });
      }

      // Extract common car brands from message
      const brands = [
        "honda",
        "toyota",
        "ford",
        "chevrolet",
        "bmw",
        "mercedes",
        "audi",
        "nissan",
        "hyundai",
        "kia",
        "mazda",
        "volkswagen",
        "subaru",
        "lexus",
        "tesla",
      ];
      brands.forEach((brand) => {
        if (message.includes(brand)) {
          searchTerms[brand] = (searchTerms[brand] || 0) + 1;
        }
      });
    });

    // Sort and get top results
    const topSearches = Object.entries(searchTerms)
      .sort((a, b) => b[1] - a[1])
      .slice(0, parseInt(limit))
      .map(([term, count]) => ({
        search_term: term,
        count: count,
      }));

    return res.json({
      success: true,
      data: topSearches,
      period_days: parseInt(days),
    });
  } catch (error) {
    console.error("[Analytics] Error getting top searches:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to fetch top searches",
      success: false,
    });
  }
};

/**
 * Get city-wise repair/insurance requests
 */
exports.getCityWiseRequests = async (req, res) => {
  try {
    const { days = 30, type = "all" } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const whereClause = {
      created_at: {
        [Op.gte]: startDate,
      },
    };

    // Filter by intent type
    if (type === "repair") {
      whereClause.intent = "repair_request";
    } else if (type === "insurance") {
      whereClause.intent = "insurance_request";
    } else {
      whereClause.intent = {
        [Op.in]: ["repair_request", "insurance_request"],
      };
    }

    const logs = await ChatbotLog.findAll({
      where: whereClause,
      attributes: ["intent", "context"],
    });

    // Extract cities from context
    const cityCounts = {};

    logs.forEach((log) => {
      if (log.context && log.context.tool_calls) {
        log.context.tool_calls.forEach((toolCall) => {
          if (toolCall.args && toolCall.args.city) {
            const key = `${toolCall.args.city}_${log.intent}`;
            cityCounts[key] = cityCounts[key] || {
              city: toolCall.args.city,
              intent: log.intent,
              count: 0,
            };
            cityCounts[key].count++;
          }
        });
      }
    });

    const cityData = Object.values(cityCounts).sort(
      (a, b) => b.count - a.count
    );

    return res.json({
      success: true,
      data: cityData,
      period_days: parseInt(days),
    });
  } catch (error) {
    console.error("[Analytics] Error getting city-wise requests:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to fetch city-wise requests",
      success: false,
    });
  }
};

/**
 * Get chatbot satisfaction metrics
 */
exports.getSatisfactionMetrics = async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const feedbackStats = await ChatbotLog.findAll({
      where: {
        created_at: {
          [Op.gte]: startDate,
        },
        feedback: {
          [Op.ne]: "neutral",
        },
      },
      attributes: ["feedback", [fn("COUNT", col("id")), "count"]],
      group: ["feedback"],
    });

    const stats = {
      positive: 0,
      negative: 0,
      total: 0,
      satisfaction_rate: 0,
    };

    feedbackStats.forEach((stat) => {
      const count = parseInt(stat.dataValues.count);
      stats[stat.feedback] = count;
      stats.total += count;
    });

    if (stats.total > 0) {
      stats.satisfaction_rate = ((stats.positive / stats.total) * 100).toFixed(
        2
      );
    }

    return res.json({
      success: true,
      data: stats,
      period_days: parseInt(days),
    });
  } catch (error) {
    console.error("[Analytics] Error getting satisfaction metrics:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to fetch satisfaction metrics",
      success: false,
    });
  }
};

/**
 * Get message volume per day
 */
exports.getMessageVolume = async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const volumeData = await ChatbotLog.findAll({
      where: {
        created_at: {
          [Op.gte]: startDate,
        },
      },
      attributes: [
        [fn("DATE", col("created_at")), "date"],
        [fn("COUNT", col("id")), "message_count"],
      ],
      group: [fn("DATE", col("created_at"))],
      order: [[fn("DATE", col("created_at")), "ASC"]],
    });

    const formattedData = volumeData.map((item) => ({
      date: item.dataValues.date,
      count: parseInt(item.dataValues.message_count),
    }));

    return res.json({
      success: true,
      data: formattedData,
      period_days: parseInt(days),
    });
  } catch (error) {
    console.error("[Analytics] Error getting message volume:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to fetch message volume",
      success: false,
    });
  }
};

/**
 * Get FAQ hits vs GPT responses
 */
exports.getIntentDistribution = async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const intentStats = await ChatbotLog.findAll({
      where: {
        created_at: {
          [Op.gte]: startDate,
        },
      },
      attributes: ["intent", [fn("COUNT", col("id")), "count"]],
      group: ["intent"],
    });

    const distribution = intentStats.map((stat) => ({
      intent: stat.intent || "general",
      count: parseInt(stat.dataValues.count),
    }));

    // Calculate FAQ vs GPT ratio
    const faqCount = distribution.find((d) => d.intent === "faq")?.count || 0;
    const totalCount = distribution.reduce((sum, d) => sum + d.count, 0);
    const gptCount = totalCount - faqCount;

    return res.json({
      success: true,
      data: {
        distribution: distribution,
        summary: {
          faq_hits: faqCount,
          gpt_responses: gptCount,
          total: totalCount,
          faq_percentage:
            totalCount > 0 ? ((faqCount / totalCount) * 100).toFixed(2) : 0,
        },
      },
      period_days: parseInt(days),
    });
  } catch (error) {
    console.error("[Analytics] Error getting intent distribution:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to fetch intent distribution",
      success: false,
    });
  }
};

/**
 * Get overall dashboard stats
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Total messages
    const totalMessages = await ChatbotLog.count({
      where: {
        created_at: {
          [Op.gte]: startDate,
        },
      },
    });

    // Unique sessions
    const uniqueSessions = await ChatbotLog.count({
      distinct: true,
      col: "session_id",
      where: {
        created_at: {
          [Op.gte]: startDate,
        },
      },
    });

    // Active users (logged in)
    const activeUsers = await ChatbotLog.count({
      distinct: true,
      col: "user_id",
      where: {
        created_at: {
          [Op.gte]: startDate,
        },
        user_id: {
          [Op.ne]: null,
        },
      },
    });

    // Average messages per session
    const avgMessagesPerSession =
      uniqueSessions > 0 ? (totalMessages / uniqueSessions).toFixed(2) : 0;

    return res.json({
      success: true,
      data: {
        total_messages: totalMessages,
        unique_sessions: uniqueSessions,
        active_users: activeUsers,
        avg_messages_per_session: parseFloat(avgMessagesPerSession),
      },
      period_days: parseInt(days),
    });
  } catch (error) {
    console.error("[Analytics] Error getting dashboard stats:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to fetch dashboard stats",
      success: false,
    });
  }
};
