"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Referral extends Model {
    static associate(models) {
      // Customer who made the referral
      Referral.belongsTo(models.User, {
        foreignKey: "customerId",
        as: "customer",
        onDelete: "CASCADE",
      });

      // User assigned to handle the referral
      Referral.belongsTo(models.User, {
        foreignKey: "assignedToId",
        as: "assignedTo",
        onDelete: "SET NULL",
      });

      // Notifications related to this referral
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
      assignedToId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
      },
      jobType: {
        type: DataTypes.ENUM("repair", "insurance"),
        allowNull: false,
      },
      jobCategory: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      // 👇 New: description or details about the job
      jobDescription: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("new", "inprogress", "completed"),
        defaultValue: "new",
        allowNull: false,
      },
      vehicleName: {
        type: DataTypes.STRING,
        allowNull: false,
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
