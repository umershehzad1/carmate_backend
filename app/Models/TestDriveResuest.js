'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class TestDriveRequest extends Model {
    static associate(models) {
      // Each test drive request belongs to a customer (user)
      TestDriveRequest.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'customer',
        onDelete: 'CASCADE'
      });

      // Each test drive request belongs to a vehicle
      TestDriveRequest.belongsTo(models.Vehicle, {
        foreignKey: 'vehicleId',
        as: 'vehicle',
        onDelete: 'CASCADE'
      });
      TestDriveRequest.hasMany(models.Notifications, {
  foreignKey: 'testDriveRequestId',
  as: 'notifications'
});

    }
  }

  TestDriveRequest.init(
    {
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' }
      },
      vehicleId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'Vehicles', key: 'id' }
      },
      requestedDate: {
        type: DataTypes.DATE,
        allowNull: false
      }
    },
    {
      sequelize,
      modelName: 'TestDriveRequest',
      timestamps: true
    }
  );

  return TestDriveRequest;
};
