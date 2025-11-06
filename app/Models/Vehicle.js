"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Vehicle extends Model {
    static associate(models) {
      Vehicle.belongsTo(models.User, {
        foreignKey: "dealerId",
        as: "user",
        onDelete: "CASCADE",
      });
      Vehicle.hasMany(models.Advertisement, {
        foreignKey: "vehicleId",
        as: "advertisement",
        onDelete: "CASCADE",
      });
      Vehicle.hasMany(models.TestDriveRequest, {
        foreignKey: "vehicleId",
        as: "testDriveRequests",
      });
    }
  }

  Vehicle.init(
    {
      dealerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onDelete: "CASCADE",
      },
      name: DataTypes.STRING,
      slug: { type: DataTypes.STRING, unique: true },
      images: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: false,
      },
      price: DataTypes.STRING,
      city: DataTypes.STRING,
      province: DataTypes.STRING,
      make: DataTypes.STRING,
      model: DataTypes.STRING,
      modelCategory: DataTypes.STRING,
      mileage: DataTypes.STRING,
      doors: DataTypes.INTEGER,
      transmission: DataTypes.STRING,
      fuelType: DataTypes.STRING,
      registerIn: DataTypes.STRING,
      assemblyIn: DataTypes.STRING,
      bodyType: DataTypes.STRING,
      color: DataTypes.STRING,
      engineCapacity: DataTypes.STRING,
      interiorDetails: { type: DataTypes.JSON, allowNull: true },
      exteriorDetails: { type: DataTypes.JSON, allowNull: true },
      safetyFeatures: { type: DataTypes.JSON, allowNull: true },
      specifications: { type: DataTypes.JSON, allowNull: true },
      status: {
        type: DataTypes.ENUM("live", "draft", "sold"),
        allowNull: false,
        defaultValue: "live",
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      tags: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true,
        defaultValue: [],
      },
      condition: {
        type: DataTypes.ENUM("used", "new", "certified"),
        allowNull: false,
        defaultValue: "used",
      },
      exteriorColor: DataTypes.STRING,
      year: DataTypes.STRING,
      drive: DataTypes.STRING,
      location: DataTypes.STRING,
      fuelConsumption: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "Vehicle",
      hooks: {
        afterUpdate: async (vehicle, options) => {
          const changed = vehicle.changed();

          // Check if status was changed
          if (changed && changed.includes("status")) {
            const { Advertisement, Notifications, TestDriveRequest, Dealer } =
              sequelize.models;

            // If status changed to 'live', create a base advertisement
            if (vehicle.status === "live") {
              // Check if a base ad already exists for this vehicle
              const existingAd = await Advertisement.findOne({
                where: {
                  vehicleId: vehicle.id,
                  adType: "base",
                },
              });

              // Only create if no base ad exists
              if (!existingAd) {
                // Check dealer's available listings
                const dealer = await Dealer.findOne({
                  where: { userId: vehicle.dealerId },
                });

                if (dealer && dealer.availableCarListing > 0) {
                  // Create the base ad
                  await Advertisement.create({
                    vehicleId: vehicle.id,
                    dealerId: vehicle.dealerId,
                    adType: "base",
                    status: "running",
                    pauseReason: "none",
                    dailyBudget: 0.0,
                    startDate: new Date(),
                    endDate: null,
                  });

                  // Deduct one listing
                  dealer.availableCarListing = dealer.availableCarListing - 1;
                  await dealer.save();
                }
              }
            }

            // If status changed to 'sold' or 'draft', delete related data
            if (vehicle.status === "sold" || vehicle.status === "draft") {
              // Count how many ads will be deleted
              const adsCount = await Advertisement.count({
                where: { vehicleId: vehicle.id },
              });

              // Delete all advertisements for this vehicle
              await Advertisement.destroy({
                where: { vehicleId: vehicle.id },
              });

              // Restore the listings to dealer
              if (adsCount > 0) {
                const dealer = await Dealer.findOne({
                  where: { userId: vehicle.dealerId },
                });

                if (dealer) {
                  dealer.availableCarListing =
                    dealer.availableCarListing + adsCount;
                  await dealer.save();
                }
              }

              // Delete all test drive requests for this vehicle
              const testDriveRequests = await TestDriveRequest.findAll({
                where: { vehicleId: vehicle.id },
              });

              // Delete notifications related to test drive requests
              if (testDriveRequests && testDriveRequests.length > 0) {
                const testDriveRequestIds = testDriveRequests.map(
                  (tdr) => tdr.id
                );
                await Notifications.destroy({
                  where: {
                    testDriveRequestId: testDriveRequestIds,
                  },
                });
              }

              // Delete the test drive requests themselves
              await TestDriveRequest.destroy({
                where: { vehicleId: vehicle.id },
              });

              // You can also delete other related notifications if needed
              // For example, notifications about this vehicle in general
            }
          }
        },

        afterCreate: async (vehicle, options) => {
          // Automatically create a base ad when a vehicle is created with 'live' status
          if (vehicle.status === "live") {
            const { Advertisement, Dealer } = sequelize.models;

            // Check dealer's available listings
            const dealer = await Dealer.findOne({
              where: { userId: vehicle.dealerId },
            });

            if (dealer && dealer.availableCarListing > 0) {
              // Create the base ad
              await Advertisement.create({
                vehicleId: vehicle.id,
                dealerId: vehicle.dealerId,
                adType: "base",
                status: "running",
                pauseReason: "none",
                dailyBudget: 0.0,
                startDate: new Date(),
                endDate: null,
              });

              // Deduct one listing
              dealer.availableCarListing = dealer.availableCarListing - 1;
              await dealer.save();
            }
          }
        },
      },
    }
  );

  return Vehicle;
};
