"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add "status" column
    await queryInterface.addColumn("Vehicles", "status", {
      type: Sequelize.ENUM("live", "draft", "sold"),
      allowNull: false,
      defaultValue: "live",
    });

    // Add unique constraint on slug
    await queryInterface.addConstraint("Vehicles", {
      fields: ["slug"],
      type: "unique",
      name: "unique_slug_constraint",
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove unique constraint from slug
    await queryInterface.removeConstraint("Vehicles", "unique_slug_constraint");

    // Remove the status column
    await queryInterface.removeColumn("Vehicles", "status");

    // Drop ENUM type (important for Postgres)
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_Vehicles_status";'
    );
  },
};
