"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Notifications extends Model {
    static associate(models) {
      // Each notification has a sender (user who triggered the notification)
      Notifications.belongsTo(models.User, {
        foreignKey: "senderId",
        as: "sender",
        onDelete: "CASCADE",
      });

      // Each notification has a receiver (user who receives the notification)
      Notifications.belongsTo(models.User, {
        foreignKey: "receiverId",
        as: "receiver",
        onDelete: "CASCADE",
      });

      // Optional associations for different notification types
      Notifications.belongsTo(models.Message, {
        foreignKey: "messageId",
        as: "message",
        onDelete: "CASCADE",
      });

      Notifications.belongsTo(models.TestDriveRequest, {
        foreignKey: "testDriveRequestId",
        as: "testDriveRequest",
        onDelete: "CASCADE",
      });

      Notifications.belongsTo(models.Referral, {
        foreignKey: "referralId",
        as: "referral",
        onDelete: "CASCADE",
      });
    }
  }

  Notifications.init(
    {
      senderId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
      },
      receiverId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
      },
      type: {
        type: DataTypes.ENUM("message", "test_drive", "repair", "admin_alert"),
        allowNull: false,
      },
      messageId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Messages", key: "id" },
      },
      testDriveRequestId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "TestDriveRequests", key: "id" },
      },
      referralId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Referrals", key: "id" },
      },
      content: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      isRead: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: "Notifications",
      timestamps: true,
    }
  );

  return Notifications;
};
