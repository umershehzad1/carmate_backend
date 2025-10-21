"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Review extends Model {
    static associate(models) {
      // Reviewer (the one who gave the review)
      Review.belongsTo(models.User, {
        foreignKey: "reviewerId",
        as: "reviewer",
        onDelete: "CASCADE",
      });

      // Reviewed user (the one who received the review)
      Review.belongsTo(models.User, {
        foreignKey: "reviewedUserId",
        as: "reviewedUser",
        onDelete: "CASCADE",
      });
    }
  }

  Review.init(
    {
      reviewerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onDelete: "CASCADE",
      },
      reviewedUserId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onDelete: "CASCADE",
      },
      rating: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { min: 1, max: 5 },
      },
      text: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "Review",
    }
  );

  return Review;
};
