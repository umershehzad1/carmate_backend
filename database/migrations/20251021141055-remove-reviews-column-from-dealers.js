"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Dealers", "reviews");
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn("Dealers", "reviews", {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: {
        totalReview: 0,
        userReviews: [],
      },
    });
  },
};
