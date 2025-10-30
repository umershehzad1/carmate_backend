"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Step 1: Remove ENUM type (PostgreSQL requires dropping ENUM type manually)
    // Step 2: Change the column type to STRING

    await queryInterface.changeColumn("Subscriptions", "plan", {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert back to ENUM if needed
    await queryInterface.changeColumn("Subscriptions", "plan", {
      type: Sequelize.ENUM("basic", "pro", "premium"),
      allowNull: false,
    });
  },
};
