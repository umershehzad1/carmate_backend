"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Vehicles", "description", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn("Vehicles", "tags", {
      type: Sequelize.ARRAY(Sequelize.STRING),
      allowNull: true,
      defaultValue: [],
    });

    await queryInterface.addColumn("Vehicles", "condition", {
      type: Sequelize.ENUM("used", "new", "certified"),
      allowNull: false,
      defaultValue: "used",
    });

    await queryInterface.addColumn("Vehicles", "exteriorColor", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("Vehicles", "year", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("Vehicles", "drive", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("Vehicles", "location", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Vehicles", "description");
    await queryInterface.removeColumn("Vehicles", "tags");
    await queryInterface.removeColumn("Vehicles", "condition");
    await queryInterface.removeColumn("Vehicles", "exteriorColor");
    await queryInterface.removeColumn("Vehicles", "year");
    await queryInterface.removeColumn("Vehicles", "drive");
    await queryInterface.removeColumn("Vehicles", "location");
  },
};
