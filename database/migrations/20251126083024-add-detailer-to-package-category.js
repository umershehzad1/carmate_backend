"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // For PostgreSQL: add new value to ENUM
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_Packages_packageCategory" 
      ADD VALUE IF NOT EXISTS 'detailer';
    `);
  },

  async down(queryInterface, Sequelize) {
    // Sequelize/Postgres cannot easily remove ENUM values.
    // This is intentionally left empty because rolling back
    // ENUM value removal is unsafe and not supported directly.
  },
};
