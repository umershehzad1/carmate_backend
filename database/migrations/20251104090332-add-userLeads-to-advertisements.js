"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Advertisements", "userLeads", {
      type: Sequelize.JSONB,
      defaultValue: [],
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Advertisements", "userLeads");
  },
};
