"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class ReportedContent extends Model {
    static associate(models) {
      ReportedContent.belongsTo(models.Vehicle, {
        foreignKey: "vehicleId",
        as: "vehicle",
        onDelete: "CASCADE",
      });

      ReportedContent.belongsTo(models.User, {
        foreignKey: "userId",
        as: "user",
        onDelete: "CASCADE",
      });
    }
  }

  ReportedContent.init(
    {
      vehicleId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Vehicles", key: "id" },
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
      },
      reports: {
        type: DataTypes.INTEGER,
      },
      reportReason: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "ReportedContent",
      timestamps: true,
    }
  );

  return ReportedContent;
};
