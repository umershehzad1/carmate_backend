"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Vehicle extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
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
        references: {
          model: "Users",
          key: "id",
        },
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
      make: DataTypes.STRING,
      model: DataTypes.STRING,
      mileage: DataTypes.STRING,
      transmission: DataTypes.STRING,
      fuelType: DataTypes.STRING,
      registerIn: DataTypes.STRING,
      assemblyIn: DataTypes.STRING,
      bodyType: DataTypes.STRING,
      color: DataTypes.STRING,
      engineCapacity: DataTypes.STRING,
      interiorDetails: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      exteriorDetails: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      safetyFeatures: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      specifications: {
        type: DataTypes.JSON,
        allowNull: true,
      },
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
