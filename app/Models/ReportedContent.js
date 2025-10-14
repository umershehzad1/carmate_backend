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
    }
  }

  ReportedContent.init(
    {
      vehicleId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Vehicles", key: "id" },
      },
      reports: {
        type: DataTypes.INTEGER,
      },
    },
    {
      sequelize,
      modelName: "ReportedContent",
      timestamps: true,
    }
  );

  return ReportedContent;
};
