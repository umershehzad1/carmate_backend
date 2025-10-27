"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Referrals", "jobCategory", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("Referrals", "jobDescription", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Referrals", "jobCategory");
    await queryInterface.removeColumn("Referrals", "jobDescription");
  },
};
