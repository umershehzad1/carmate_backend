"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      User.hasOne(models.Repair, {
        // or hasMany if multiple repairs allowed
        foreignKey: "userId",
        as: "repair",
        onDelete: "CASCADE",
      });
      User.hasOne(models.Dealer, {
        foreignKey: "userId",
        as: "dealer",
        onDelete: "CASCADE",
      });
      User.hasOne(models.Insurance, {
        foreignKey: "userId",
        as: "insurance",
        onDelete: "CASCADE",
      });
      User.hasOne(models.Subscription, {
        foreignKey: "userId",
        as: "subscription",
        onDelete: "CASCADE",
      });
      // 🔹 Messaging relationships
      User.hasMany(models.Message, {
        as: "sentMessages",
        foreignKey: "senderId",
      });
      User.hasMany(models.Message, {
        as: "receivedMessages",
        foreignKey: "receiverId",
      });

      // 🔹 Conversation relationships
      User.hasMany(models.Conversation, {
        as: "user1Conversations",
        foreignKey: "user1Id",
      });
      User.hasMany(models.Conversation, {
        as: "user2Conversations",
        foreignKey: "user2Id",
      });
      User.hasMany(models.Advertisement, {
        foreignKey: "dealerId",
        as: "advertisement",
      });
      User.hasMany(models.Referral, {
        foreignKey: "customerId",
        as: "Referrals",
      });
      User.hasMany(models.TestDriveRequest, {
        foreignKey: "userId",
        as: "testDriveRequests",
      });
      User.hasMany(models.Notifications, {
        foreignKey: "userId",
        as: "notifications",
      });
    }
  }
  User.init(
    {
      email: { type: DataTypes.STRING, unique: true, allowNull: false },
      password: { type: DataTypes.STRING },
      fullname: DataTypes.STRING,
      username: DataTypes.STRING,
      phone: DataTypes.STRING,
      image: DataTypes.STRING,
      role: {
        type: DataTypes.ENUM("user", "admin", "repair", "insurance", "dealer"),
        defaultValue: "user",
      },
      resetPasswordCode: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "User",
    }
  );
  return User;
};
