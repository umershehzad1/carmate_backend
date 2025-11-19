'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Rename notifications table to Notifications
    const tables = await queryInterface.showAllTables();
    if (tables.includes('notifications')) {
      await queryInterface.renameTable('notifications', 'Notifications');
    }

    // Remove unnecessary columns from Subscriptions table
    const subscriptionsTable = await queryInterface.describeTable('Subscriptions');
    
    if (subscriptionsTable.type) {
      await queryInterface.removeColumn('Subscriptions', 'type');
      // Drop the enum type
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_Subscriptions_type";'
      );
    }
    
    if (subscriptionsTable.description) {
      await queryInterface.removeColumn('Subscriptions', 'description');
    }
    
    if (subscriptionsTable.features) {
      await queryInterface.removeColumn('Subscriptions', 'features');
    }
    
    if (subscriptionsTable.carListing) {
      await queryInterface.removeColumn('Subscriptions', 'carListing');
    }
  },

  async down (queryInterface, Sequelize) {
    // Rename back to notifications
    const tables = await queryInterface.showAllTables();
    if (tables.includes('Notifications')) {
      await queryInterface.renameTable('Notifications', 'notifications');
    }

    // Add back the removed columns
    await queryInterface.addColumn('Subscriptions', 'type', {
      type: Sequelize.ENUM('dealer', 'repair', 'insurance'),
      allowNull: true,
    });
    
    await queryInterface.addColumn('Subscriptions', 'description', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    
    await queryInterface.addColumn('Subscriptions', 'features', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: [],
    });
    
    await queryInterface.addColumn('Subscriptions', 'carListing', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  }
};
