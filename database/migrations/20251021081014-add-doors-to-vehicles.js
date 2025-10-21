"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Vehicles", "doors", {
      type: Sequelize.INTEGER,
      allowNull: true, // match the model
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Vehicles", "doors");
  },
};
