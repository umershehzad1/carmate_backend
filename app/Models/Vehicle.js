"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Vehicle extends Model {
    static associate(models) {
      Vehicle.belongsTo(models.User, {
        foreignKey: "dealerId",
        as: "user",
        onDelete: "CASCADE",
      });
      Vehicle.hasMany(models.Advertisement, {
        foreignKey: "vehicleId",
        as: "advertisement",
        onDelete: "CASCADE",
      });
      Vehicle.hasMany(models.TestDriveRequest, {
        foreignKey: "vehicleId",
        as: "testDriveRequests",
      });
    }
  }

  Vehicle.init(
    {
      dealerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onDelete: "CASCADE",
      },
      name: DataTypes.STRING,
      slug: { type: DataTypes.STRING, unique: true },
      images: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: false,
      },
      price: DataTypes.STRING,
      city: DataTypes.STRING,
      province: DataTypes.STRING,
      make: DataTypes.STRING,
      model: DataTypes.STRING,
      modelCategory: DataTypes.STRING,
      mileage: DataTypes.STRING,
      doors: DataTypes.INTEGER,
      transmission: DataTypes.STRING,
      fuelType: DataTypes.STRING,
      registerIn: DataTypes.STRING,
      assemblyIn: DataTypes.STRING,
      bodyType: DataTypes.STRING,
      color: DataTypes.STRING,
      engineCapacity: DataTypes.STRING,
      interiorDetails: { type: DataTypes.JSON, allowNull: true },
      exteriorDetails: { type: DataTypes.JSON, allowNull: true },
      safetyFeatures: { type: DataTypes.JSON, allowNull: true },
      specifications: { type: DataTypes.JSON, allowNull: true },
      status: {
        type: DataTypes.ENUM("live", "draft", "sold"),
        allowNull: false,
        defaultValue: "live",
      },
    },
    {
      sequelize,
      modelName: "Vehicle",
    }
  );

  return Vehicle;
};
