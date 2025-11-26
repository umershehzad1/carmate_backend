"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // For PostgreSQL
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_Users_role" ADD VALUE IF NOT EXISTS 'detailer';
    `);
  },

  async down(queryInterface, Sequelize) {
    // Sequelize/Postgres does not support removing enum values safely
    // This is intentionally left empty
  },
};
