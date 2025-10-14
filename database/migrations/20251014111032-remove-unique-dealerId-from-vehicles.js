"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Remove unique constraint on dealerId
    await queryInterface
      .removeConstraint("Vehicles", "Vehicles_dealerId_key")
      .catch(() => {
        console.log(
          "No existing unique constraint found on dealerId, skipping..."
        );
      });
  },

  async down(queryInterface, Sequelize) {
    // Re-add unique constraint if you ever rollback
    await queryInterface.addConstraint("Vehicles", {
      fields: ["dealerId"],
      type: "unique",
      name: "Vehicles_dealerId_key",
    });
  },
};
