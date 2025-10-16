"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if the column "referralId" exists before renaming
    const tableDefinition = await queryInterface.describeTable("notifications");

    if (tableDefinition.repairreferralId) {
      await queryInterface.renameColumn(
        "notifications",
        "repairreferralId",
        "referralId"
      );
    }
  },

  async down(queryInterface, Sequelize) {
    // Rollback: rename column back to "referralId" if needed
    const tableDefinition = await queryInterface.describeTable("notifications");

    if (tableDefinition.referralId) {
      await queryInterface.renameColumn(
        "notifications",
        "referralId",
        "repairreferralId"
      );
    }
  },
};
