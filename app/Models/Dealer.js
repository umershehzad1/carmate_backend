"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Dealer extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Dealer.belongsTo(models.User, {
        foreignKey: "userId",
        as: "user",
        onDelete: "CASCADE",
      });
    }
  }
  Dealer.init(
    {
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onDelete: "CASCADE",
      },
      location: DataTypes.STRING,
      status: {
        type: DataTypes.ENUM("nonverified", "verified"),
        defaultValue: "nonverified",
      },
      image: DataTypes.STRING,
      analytics: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {
          totalViews: 0,
          totalClicks: 0,
          conversionRate: 0,
          competitorInsights: 0,
        },
      },
      slug: {
        type: DataTypes.STRING,
        unique: true,
      },

      availableCarListing: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      openingTime: {
        type: DataTypes.TIME,
        allowNull: true,
      },
      closingTime: {
        type: DataTypes.TIME,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "Dealer",
    }
  );
  return Dealer;
};
