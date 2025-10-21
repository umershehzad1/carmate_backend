"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Vehicles", "province", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn("Vehicles", "year", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn("Vehicles", "modelCategory", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Vehicles", "province");
    await queryInterface.removeColumn("Vehicles", "year");
    await queryInterface.removeColumn("Vehicles", "modelCategory");
  },
};
