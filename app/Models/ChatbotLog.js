"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class ChatbotLog extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Associate with User model
      ChatbotLog.belongsTo(models.User, {
        foreignKey: "user_id",
        as: "user",
      });
    }
  }

  ChatbotLog.init(
    {
      session_id: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: "session_id",
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "user_id",
      },
      intent: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      response: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      context: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      feedback: {
        type: DataTypes.ENUM("positive", "negative", "neutral"),
        allowNull: true,
        defaultValue: "neutral",
      },
    },
    {
      sequelize,
      modelName: "ChatbotLog",
      tableName: "chatbot_logs",
      underscored: true,
    }
  );

  return ChatbotLog;
};
