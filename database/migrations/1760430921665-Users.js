module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Users", {
      id: {
        type: Sequelize.INTEGER,

        allowNull: false,

        primaryKey: true,

        autoIncrement: true,
      },

      email: {
        type: Sequelize.STRING,

        allowNull: false,

        unique: true,
      },

      password: {
        type: Sequelize.STRING,

        allowNull: false,
      },

      fullname: {
        type: Sequelize.STRING,
      },

      username: {
        type: Sequelize.STRING,
      },

      phone: {
        type: Sequelize.STRING,
      },

      image: {
        type: Sequelize.STRING,
      },

      role: {
        type: Sequelize.ENUM("user", "admin", "repair", "insurance", "dealer"),

        defaultValue: "user",
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
    await queryInterface.dropTable("Users");
  },
};
