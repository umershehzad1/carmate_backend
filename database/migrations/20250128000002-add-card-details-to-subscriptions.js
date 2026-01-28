'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('subscriptions', 'cardLast4', {
      type: Sequelize.STRING(4),
      allowNull: true
    });

    await queryInterface.addColumn('subscriptions', 'cardBrand', {
      type: Sequelize.STRING(20),
      allowNull: true
    });

    await queryInterface.addColumn('subscriptions', 'cardExpMonth', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    await queryInterface.addColumn('subscriptions', 'cardExpYear', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    await queryInterface.addColumn('subscriptions', 'paymentMethodId', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('subscriptions', 'cardHolderName', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('subscriptions', 'billingAddress', {
      type: Sequelize.JSON,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('subscriptions', 'cardLast4');
    await queryInterface.removeColumn('subscriptions', 'cardBrand');
    await queryInterface.removeColumn('subscriptions', 'cardExpMonth');
    await queryInterface.removeColumn('subscriptions', 'cardExpYear');
    await queryInterface.removeColumn('subscriptions', 'paymentMethodId');
    await queryInterface.removeColumn('subscriptions', 'cardHolderName');
    await queryInterface.removeColumn('subscriptions', 'billingAddress');
  }
};