"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if table and column exist before renaming
    const tables = await queryInterface.showAllTables();
    if (tables.includes("Notifications")) {
      const tableDefinition = await queryInterface.describeTable("Notifications");
      if (tableDefinition.repairreferralId) {
        await queryInterface.renameColumn(
          "Notifications",
          "repairreferralId",
          "referralId"
        );
      }
    }
  },

  async down(queryInterface, Sequelize) {
    // Check if table exists before rollback
    const tables = await queryInterface.showAllTables();
    if (tables.includes("Notifications")) {
      const tableDefinition = await queryInterface.describeTable("Notifications");
      if (tableDefinition.referralId) {
        await queryInterface.renameColumn(
          "Notifications",
          "referralId",
          "repairreferralId"
        );
      }
    }
  },
};
