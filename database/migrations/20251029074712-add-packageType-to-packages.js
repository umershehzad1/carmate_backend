"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Packages", "packageCategory", {
      type: Sequelize.ENUM("dealer", "insurance", "repair"),
      allowNull: false,
      defaultValue: "dealer",
      comment: "Defines which business category this package belongs to",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Packages", "packageCategory");

    if (queryInterface.sequelize.getDialect() === "postgres") {
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_Packages_packageCategory";'
      );
    }
  },
};
