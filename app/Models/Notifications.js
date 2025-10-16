"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Notifications extends Model {
    static associate(models) {
      // Each notification belongs to a user (recipient)
      Notifications.belongsTo(models.User, {
        foreignKey: "userId",
        as: "recipient",
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
        as: "Referral",
        onDelete: "CASCADE",
      });
    }
  }

  Notifications.init(
    {
      userId: {
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
      tableName: "notifications",
      timestamps: true,
    }
  );

  return Notifications;
};
