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
      keyBenifits: DataTypes.ARRAY(DataTypes.STRING),
      speciality: DataTypes.ARRAY(DataTypes.STRING),
      claimProcess: DataTypes.ARRAY(DataTypes.STRING),
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
      openingTime: {
        type: DataTypes.TIME,
        allowNull: true,
      },
      closingTime: {
        type: DataTypes.TIME,
        allowNull: true,
      },
      faqs: DataTypes.ARRAY(DataTypes.JSON),
    },
    {
      sequelize,
      modelName: "Insurance",
    }
  );
  return Insurance;
};
