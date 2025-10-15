module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Referrals", {
      id: {
        type: Sequelize.INTEGER,

        allowNull: false,

        primaryKey: true,

        autoIncrement: true,
      },

      customerId: {
        type: Sequelize.INTEGER,

        allowNull: false,

        references: {
          model: "Users",
          key: "id",
        },
      },

      jobType: {
        type: Sequelize.ENUM("repair", "insurance"),

        allowNull: false,
      },

      status: {
        type: Sequelize.ENUM("inprogress", "completed"),

        allowNull: false,

        defaultValue: "inprogress",
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
    await queryInterface.dropTable("Referrals");
  },
};
