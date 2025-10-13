'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Vehicle extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
       Vehicle.belongsTo(models.Dealer, {
        foreignKey: 'dealerId',
        as: 'dealer',
        onDelete: 'CASCADE',
      });
      Vehicle.hasMany(models.Advertisement, {
  foreignKey: 'vehicleId',
  as: 'advertisement',
  onDelete: 'CASCADE'
});
Vehicle.hasMany(models.TestDriveRequest, {
  foreignKey: 'vehicleId',
  as: 'testDriveRequests'
});

    }
  }
  Vehicle.init({
     dealerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true, 
        references: {
          model: 'Dealers',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
    name: DataTypes.STRING,
    slug: DataTypes.STRING,
    images: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: false,
},
    model: DataTypes.STRING,
    mileage: DataTypes.STRING,
    transmission: DataTypes.STRING,
    fuelType: DataTypes.STRING,
    registerIn: DataTypes.STRING,
    Assembly: DataTypes.STRING,
    BodyType: DataTypes.STRING,
    color: DataTypes.STRING,
    engineCapacity: DataTypes.STRING,
     interiorDetails: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    exteriorDetails: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    safetyFeatures: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    specifications: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    status: {type: DataTypes.ENUM( 'none','featured','sposored'), defaultValue: 'none'}
  }, {
    sequelize,
    modelName: 'Vehicle',
  });
  return Vehicle;
};