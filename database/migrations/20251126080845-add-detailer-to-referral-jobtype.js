"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_Referrals_jobType" ADD VALUE IF NOT EXISTS 'detailer';
    `);
  },

  async down(queryInterface, Sequelize) {
    // Postgres does not safely support removing enum values
  },
};
