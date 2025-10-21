"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Remove the "year" column
    await queryInterface.removeColumn("Vehicles", "year");
  },

  async down(queryInterface, Sequelize) {
    // Re-add the "year" column in case of rollback
    await queryInterface.addColumn("Vehicles", "year", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },
};
