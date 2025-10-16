"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Referral extends Model {
    static associate(models) {
      // Each repair referral belongs to a customer
      Referral.belongsTo(models.User, {
        foreignKey: "customerId",
        as: "customer",
        onDelete: "CASCADE",
      });

      // Each repair referral belongs to a vehicle
      Referral.belongsTo(models.Vehicle, {
        foreignKey: "vehicleId",
        as: "vehicle",
        onDelete: "CASCADE",
      });
      Referral.hasMany(models.Notifications, {
        foreignKey: "referralId",
        as: "notifications",
      });
    }
  }

  Referral.init(
    {
      customerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
      },
      jobType: {
        type: DataTypes.ENUM("repair", "insurance"),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("inprogress", "completed"),
        defaultValue: "inprogress",
        allowNull: false,
      },
      vehicleId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Vehicles", key: "id" },
      },
      requestedDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "Referral",
      timestamps: true,
    }
  );

  return Referral;
};
