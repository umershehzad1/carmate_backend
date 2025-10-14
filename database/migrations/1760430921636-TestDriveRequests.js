module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("TestDriveRequests", {
      id: {
        type: Sequelize.INTEGER,

        allowNull: false,

        primaryKey: true,

        autoIncrement: true,
      },

      userId: {
        type: Sequelize.INTEGER,

        allowNull: false,

        references: {
          model: "Users",
          key: "id",
        },
      },

      vehicleId: {
        type: Sequelize.INTEGER,

        allowNull: false,

        references: {
          model: "Vehicles",
          key: "id",
        },
      },

      requestedDate: {
        type: Sequelize.DATE,

        allowNull: false,
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
    await queryInterface.dropTable("TestDriveRequests");
  },
};

