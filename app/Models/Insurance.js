"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Insurance extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Insurance.belongsTo(models.User, {
        foreignKey: "userId",
        as: "user",
        onDelete: "CASCADE",
      });
    }
  }
  Insurance.init(
    {
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onDelete: "CASCADE",
      },

      location: DataTypes.STRING,
      experience: DataTypes.STRING,
      keyBenifits: DataTypes.STRING,
      speciality: DataTypes.STRING,
      aboutUs: DataTypes.STRING,
      status: {
        type: DataTypes.ENUM("nonverified", "verified"),
        defaultValue: "nonverified",
      },
      image: DataTypes.STRING,
      slug: {
        type: DataTypes.STRING,
        unique: true,
      },

      analytics: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {
          quoteRequests: 0,
          policiesSold: 0,
          costPerLead: 0,
          roi: 0,
        },
      },
    },
    {
      sequelize,
      modelName: "Insurance",
    }
  );
  return Insurance;
};
