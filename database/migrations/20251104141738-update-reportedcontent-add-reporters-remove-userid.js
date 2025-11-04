"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Remove userId column
    await queryInterface.removeColumn("ReportedContents", "userId");

    // Add reporters column
    await queryInterface.addColumn("ReportedContents", "reporters", {
      type: Sequelize.ARRAY(Sequelize.INTEGER),
      allowNull: false,
      defaultValue: [],
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert: remove reporters column
    await queryInterface.removeColumn("ReportedContents", "reporters");

    // Revert: add userId column
    await queryInterface.addColumn("ReportedContents", "userId", {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "Users",
        key: "id",
      },
      onDelete: "CASCADE",
    });
  },
};
