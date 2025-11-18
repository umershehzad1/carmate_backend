module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Advertisements", {
      id: {
        type: Sequelize.INTEGER,

        allowNull: false,

        primaryKey: true,

        autoIncrement: true,
      },

      dealerId: {
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

      status: {
        type: Sequelize.ENUM("running", "stopped"),

        allowNull: false,

        defaultValue: "running",
      },

      adType: {
        type: Sequelize.ENUM("featured", "sponsored"),

        allowNull: false,

        defaultValue: "featured",
      },

      views: {
        type: Sequelize.INTEGER,

        defaultValue: 0,
      },

      clicks: {
        type: Sequelize.INTEGER,

        defaultValue: 0,
      },

      leads: {
        type: Sequelize.INTEGER,

        defaultValue: 0,
      },

      amountSpent: {
        type: Sequelize.DECIMAL,

        defaultValue: 0,
      },

      dailyBudget: {
        type: Sequelize.DECIMAL,

        defaultValue: 0,
      },

      duration: {
        type: Sequelize.INTEGER,

        defaultValue: 0,
      },

      startDate: {
        type: Sequelize.DATE,

        defaultValue: {},
      },

      endDate: {
        type: Sequelize.DATE,

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
    await queryInterface.dropTable("Advertisements");
  },
};
