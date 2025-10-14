module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Contacts", {
      id: {
        type: Sequelize.INTEGER,

        allowNull: false,

        primaryKey: true,

        autoIncrement: true,
      },

      firstName: {
        type: Sequelize.STRING,
      },

      lastName: {
        type: Sequelize.STRING,
      },

      email: {
        type: Sequelize.STRING,
      },

      phone: {
        type: Sequelize.STRING,
      },

      message: {
        type: Sequelize.STRING,
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
    await queryInterface.dropTable("Contacts");
  },
};

