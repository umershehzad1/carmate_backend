"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Dealers", "openingTime", {
      type: Sequelize.TIME,
      allowNull: true,
    });
    await queryInterface.addColumn("Dealers", "closingTime", {
      type: Sequelize.TIME,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Dealers", "openingTime");
    await queryInterface.removeColumn("Dealers", "closingTime");
  },
};
