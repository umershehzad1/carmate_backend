"use strict";
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Vehicles", {
      id: {
        type: Sequelize.INTEGER,

        allowNull: false,

        primaryKey: true,

        autoIncrement: true,
      },

      dealerId: {
        type: Sequelize.INTEGER,

        allowNull: false,

        unique: true,

        references: {
          model: "Users",
          key: "id",
        },
      },

      name: {
        type: Sequelize.STRING,
      },

      slug: {
        type: Sequelize.STRING,
      },

      images: {
        type: Sequelize.ARRAY(Sequelize.STRING),

        allowNull: false,
      },

      model: {
        type: Sequelize.STRING,
      },

      mileage: {
        type: Sequelize.STRING,
      },

      transmission: {
        type: Sequelize.STRING,
      },

      fuelType: {
        type: Sequelize.STRING,
      },

      registerIn: {
        type: Sequelize.STRING,
      },

      assemblyIn: {
        type: Sequelize.STRING,
      },

      bodyType: {
        type: Sequelize.STRING,
      },

      color: {
        type: Sequelize.STRING,
      },

      engineCapacity: {
        type: Sequelize.STRING,
      },

      interiorDetails: {
        type: Sequelize.JSON,

        allowNull: true,
      },

      exteriorDetails: {
        type: Sequelize.JSON,

        allowNull: true,
      },

      safetyFeatures: {
        type: Sequelize.JSON,

        allowNull: true,
      },

      specifications: {
        type: Sequelize.JSON,

        allowNull: true,
      },

      createdAt: {
        type: Sequelize.DATE,

        allowNull: false,
      },

      updatedAt: {
        type: Sequelize.DATE,

        allowNull: false,
      },
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("Vehicles");
  },
};
