module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("chatbot_logs", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      session_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: "Frontend-generated session identifier",
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: "User ID if logged in, null if guest",
      },
      intent: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment:
          "Detected intent: search_cars, repair_request, insurance_request, faq, general",
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: "User's message/query",
      },
      response: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: "Bot's response",
      },
      context: {
        type: Sequelize.JSON,
        allowNull: true,
        comment:
          "Additional context: search filters, location, Pinecone matches, etc.",
      },
      feedback: {
        type: Sequelize.ENUM("positive", "negative", "neutral"),
        allowNull: true,
        defaultValue: "neutral",
        comment: "User satisfaction feedback (thumbs up/down)",
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    // Add indexes for better query performance
    await queryInterface.addIndex("chatbot_logs", ["session_id"]);
    await queryInterface.addIndex("chatbot_logs", ["user_id"]);
    await queryInterface.addIndex("chatbot_logs", ["intent"]);
    await queryInterface.addIndex("chatbot_logs", ["created_at"]);
    await queryInterface.addIndex("chatbot_logs", ["feedback"]);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("chatbot_logs");
  },
};
