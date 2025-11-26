"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Package extends Model {
    static associate(models) {
      // Define associations here if needed
      // Example: Package.hasMany(models.Subscription);
    }
  }

  Package.init(
    {
      package: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      price: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      description: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      vehicleCount: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      stripeProductId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      stripePriceId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      packageCategory: {
        type: DataTypes.ENUM("dealer", "insurance", "repair", "detailer"),
        allowNull: false,
        defaultValue: "dealer",
      },
      features: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: false,
        defaultValue: [],
      },
    },
    {
      sequelize,
      modelName: "Package",
    }
  );

  return Package;
};
