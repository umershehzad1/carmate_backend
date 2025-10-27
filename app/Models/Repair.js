"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Repair extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Repair.belongsTo(models.User, {
        foreignKey: "userId",
        as: "user",
        onDelete: "CASCADE",
      });
    }
  }
  Repair.init(
    {
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onDelete: "CASCADE",
      },

      location: DataTypes.STRING,
      experience: DataTypes.STRING,
      specialty: DataTypes.ARRAY(DataTypes.STRING),
      servicesOffer: DataTypes.ARRAY(DataTypes.STRING),
      AboutUs: DataTypes.STRING,
      gallery: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true,
        defaultValue: [],
      },
      status: {
        type: DataTypes.ENUM("nonverified", "verified"),
        defaultValue: "nonverified",
      },
      image: DataTypes.STRING,
      slug: {
        type: DataTypes.STRING,
        unique: true,
      },
      openingTime: {
        type: DataTypes.TIME,
        allowNull: true,
      },
      closingTime: {
        type: DataTypes.TIME,
        allowNull: true,
      },
      CustomerInsigts: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {
          totalJobsCompleted: 0,
          AverageJobValue: 0,
          TotalAppointments: 0,
          AppointmentsConversionRate: 0,
        },
      },
      LeadToAppointments: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {
          incomingLeads: 0,
          quoteRequests: 0,
          bookedAppointments: 0,
        },
      },
      MostInDemandServices: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {
          totalJobsCompleted: "NIL",
          AverageJobValue: "NIL",
          TotalAppointments: "NIL",
          AppointmentsConversionRate: "NIL",
        },
      },
    },
    {
      sequelize,
      modelName: "Repair",
    }
  );
  return Repair;
};
