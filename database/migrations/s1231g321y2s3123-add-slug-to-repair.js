"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Dealers", "slug", {
      type: Sequelize.STRING,
      unique: true,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Dealers", "slug");
  },
};
