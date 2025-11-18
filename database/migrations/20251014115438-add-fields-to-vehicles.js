"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Vehicles", "price", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("Vehicles", "city", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("Vehicles", "make", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Vehicles", "price");
    await queryInterface.removeColumn("Vehicles", "city");
    await queryInterface.removeColumn("Vehicles", "make");
  },
};
