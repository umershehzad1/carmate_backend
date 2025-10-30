"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Remove unique constraint from userId column
    await queryInterface.changeColumn("Subscriptions", "userId", {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "Users",
        key: "id",
      },
      onDelete: "CASCADE",
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert by adding the unique constraint back
    await queryInterface.changeColumn("Subscriptions", "userId", {
      type: Sequelize.INTEGER,
      allowNull: false,
      unique: true,
      references: {
        model: "Users",
        key: "id",
      },
      onDelete: "CASCADE",
    });
  },
};
