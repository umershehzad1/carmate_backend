"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if Notification table exists before renaming
    const tables = await queryInterface.showAllTables();
    if (tables.includes("Notification")) {
      await queryInterface.renameTable("Notification", "notifications");
    }
    // If notifications table already exists, skip this migration
  },

  async down(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    if (tables.includes("notifications")) {
      await queryInterface.renameTable("notifications", "Notification");
    }
  },
};
