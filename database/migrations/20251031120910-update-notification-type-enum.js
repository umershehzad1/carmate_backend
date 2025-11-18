"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // 1. Rename old enum type
      await queryInterface.sequelize.query(
        `ALTER TYPE enum_notifications_type RENAME TO enum_notifications_type_old;`,
        { transaction }
      );

      // 2. Create the new enum type
      await queryInterface.sequelize.query(
        `CREATE TYPE enum_notifications_type AS ENUM ('message', 'test_drive', 'admin_alert', 'referral');`,
        { transaction }
      );

      // 3. Alter the column to use the new enum type
      await queryInterface.sequelize.query(
        `
        ALTER TABLE "notifications"
        ALTER COLUMN "type"
        TYPE enum_notifications_type
        USING "type"::text::enum_notifications_type;
        `,
        { transaction }
      );

      // 4. Drop the old enum type
      await queryInterface.sequelize.query(
        `DROP TYPE enum_notifications_type_old;`,
        { transaction }
      );

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Reverse process: restore the old ENUM with "repair"
      await queryInterface.sequelize.query(
        `ALTER TYPE enum_notifications_type RENAME TO enum_notifications_type_old;`,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `CREATE TYPE enum_notifications_type AS ENUM ('message', 'test_drive', 'repair', 'admin_alert');`,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `
        ALTER TABLE "notifications"
        ALTER COLUMN "type"
        TYPE enum_notifications_type
        USING "type"::text::enum_notifications_type;
        `,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `DROP TYPE enum_notifications_type_old;`,
        { transaction }
      );

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },
};
