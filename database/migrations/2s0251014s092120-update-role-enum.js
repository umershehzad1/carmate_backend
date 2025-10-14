"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_Users_role" ADD VALUE IF NOT EXISTS 'repair';
    `);
  },

  async down(queryInterface, Sequelize) {
    // PostgreSQL does not allow removing ENUM values directly,
    // but you could recreate the type if needed.
  },
};
