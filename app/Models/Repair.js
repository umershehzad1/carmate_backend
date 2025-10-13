'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Repair extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
       Repair.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user',
        onDelete: 'CASCADE',
      });
    }
  }
  Repair.init({
    name: DataTypes.STRING,
    userId: {type: DataTypes.INTEGER, allowNull: false, references: {model: 'Users', key: 'id'}, onDelete: 'CASCADE'},
    email: DataTypes.STRING,
    phone: DataTypes.STRING,
    location: DataTypes.STRING,
    experience: DataTypes.STRING,
    specialty: DataTypes.STRING,
    servicesOffer: DataTypes.STRING,
    AboutUs: DataTypes.STRING,
    gallery: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: true,
    defaultValue: [],
},
    status: {type: DataTypes.ENUM('nonverified', 'verified'), defaultValue: 'nonverified'},
    image: DataTypes.STRING,
    reviews: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {
        totalReview: 0,
        userReviews: []
      },
    },
    CustomerInsigts: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {
          totalJobsCompleted: 0,
          AverageJobValue: 0,
          TotalAppointments: 0,
          AppointmentsConversionRate: 0
        }
      },
      LeadToAppointments: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {
          incomingLeads: 0,
          quoteRequests: 0,
          bookedAppointments: 0
        }
      },
      MostInDemandServices: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {
          totalJobsCompleted: "NIL",
          AverageJobValue: "NIL",
          TotalAppointments: "NIL",
          AppointmentsConversionRate: "NIL"
        }
      }

  }, {
    sequelize,
    modelName: 'Repair',
  });
  return Repair;
};