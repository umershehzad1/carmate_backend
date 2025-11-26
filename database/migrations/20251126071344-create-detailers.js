"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Detailers", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },

      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },

      location: {
        type: Sequelize.STRING,
      },

      experience: {
        type: Sequelize.STRING,
      },

      specialty: {
        type: Sequelize.ARRAY(Sequelize.STRING),
      },

      servicesOffer: {
        type: Sequelize.ARRAY(Sequelize.STRING),
      },

      AboutUs: {
        type: Sequelize.STRING,
      },

      gallery: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: true,
        defaultValue: [],
      },

      status: {
        type: Sequelize.ENUM("nonverified", "verified"),
        defaultValue: "nonverified",
      },

      image: {
        type: Sequelize.STRING,
      },

      slug: {
        type: Sequelize.STRING,
        unique: true,
      },

      openingTime: {
        type: Sequelize.TIME,
        allowNull: true,
      },

      closingTime: {
        type: Sequelize.TIME,
        allowNull: true,
      },

      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },

      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("Detailers");
  },
};
