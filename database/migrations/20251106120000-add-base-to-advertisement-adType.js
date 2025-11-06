"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // First, change the column type to allow the new enum value
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_Advertisements_adType" ADD VALUE IF NOT EXISTS 'base';
    `);

    // Update the column default value to 'base'
    await queryInterface.changeColumn("Advertisements", "adType", {
      type: Sequelize.ENUM("featured", "sponsored", "base"),
      allowNull: false,
      defaultValue: "base",
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Note: PostgreSQL doesn't easily allow removing enum values
    // We can only change the default back to 'featured'
    await queryInterface.changeColumn("Advertisements", "adType", {
      type: Sequelize.ENUM("featured", "sponsored", "base"),
      allowNull: false,
      defaultValue: "featured",
    });
  },
};
