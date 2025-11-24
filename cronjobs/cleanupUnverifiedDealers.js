"use strict";

const cron = require("node-cron");
const { Op } = require("sequelize");
const {
  User,
  Dealer,
  Vehicle,
  Advertisement,
  TestDriveRequest,
  Notifications,
} = require("../app/Models");

/**
 * Cleanup Unverified Dealers Cron Job
 * 
 * Runs every 1 minute to:
 * 1. Find vehicles older than 2 weeks from unverified dealers
 * 2. Remove advertisements for these vehicles
 * 3. Remove test drive requests and related notifications
 * 4. Remove the vehicles
 * 5. Remove dealers that have no vehicles left
 * 
 * This ensures the database stays clean and only verified dealers persist.
 */

let isRunning = false;

async function cleanupUnverifiedDealers() {
  // Prevent multiple concurrent runs
  if (isRunning) {
    console.log("⚠️  Cleanup job is already running. Skipping this execution.");
    return;
  }

  isRunning = true;

  try {
    console.log("\n" + "=".repeat(70));
    console.log("🧹 [CLEANUP] Starting cleanup of unverified dealers and old vehicles...");
    console.log("=".repeat(70));

    // Calculate the date 2 weeks ago
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    console.log(`📅 Looking for vehicles created before: ${twoWeeksAgo.toISOString()}`);

    // Step 1: Find unverified dealers
    const unverifiedDealers = await Dealer.findAll({
      where: {
        status: "nonverified",
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "email", "fullname"],
        },
      ],
    });

    if (!unverifiedDealers || unverifiedDealers.length === 0) {
      console.log("✅ No unverified dealers found. Nothing to clean up.");
      isRunning = false;
      return;
    }

    console.log(`📊 Found ${unverifiedDealers.length} unverified dealer(s)`);

    const unverifiedDealerIds = unverifiedDealers.map((d) => d.userId);

    // Step 2: Find old vehicles (older than 2 weeks) from unverified dealers
    const oldVehicles = await Vehicle.findAll({
      where: {
        dealerId: {
          [Op.in]: unverifiedDealerIds,
        },
        createdAt: {
          [Op.lte]: twoWeeksAgo,
        },
      },
      attributes: ["id", "name", "dealerId", "createdAt"],
    });

    if (!oldVehicles || oldVehicles.length === 0) {
      console.log("✅ No old vehicles found for unverified dealers. Nothing to clean up.");
      isRunning = false;
      return;
    }

    console.log(`🚗 Found ${oldVehicles.length} old vehicle(s) to remove`);

    const vehicleIds = oldVehicles.map((v) => v.id);
    const dealerIdsWithOldVehicles = [...new Set(oldVehicles.map((v) => v.dealerId))];

    // Step 3: Remove advertisements first (to maintain referential integrity)
    console.log("\n🗑️  Step 1/4: Removing advertisements...");
    const adsDeleted = await Advertisement.destroy({
      where: {
        vehicleId: {
          [Op.in]: vehicleIds,
        },
      },
    });
    console.log(`   ✅ Deleted ${adsDeleted} advertisement(s)`);

    // Step 4: Remove test drive requests and related notifications
    console.log("\n🗑️  Step 2/4: Removing test drive requests and notifications...");
    
    // First, find all test drive requests for these vehicles
    const testDriveRequests = await TestDriveRequest.findAll({
      where: {
        vehicleId: {
          [Op.in]: vehicleIds,
        },
      },
      attributes: ["id"],
    });

    let notificationsDeleted = 0;
    if (testDriveRequests && testDriveRequests.length > 0) {
      const testDriveRequestIds = testDriveRequests.map((tdr) => tdr.id);
      
      // Delete notifications related to test drive requests
      notificationsDeleted = await Notifications.destroy({
        where: {
          testDriveRequestId: {
            [Op.in]: testDriveRequestIds,
          },
        },
      });
    }

    // Delete the test drive requests themselves
    const testDriveRequestsDeleted = await TestDriveRequest.destroy({
      where: {
        vehicleId: {
          [Op.in]: vehicleIds,
        },
      },
    });
    console.log(`   ✅ Deleted ${testDriveRequestsDeleted} test drive request(s)`);
    console.log(`   ✅ Deleted ${notificationsDeleted} notification(s)`);

    // Step 5: Remove vehicles
    console.log("\n🗑️  Step 3/4: Removing vehicles...");
    const vehiclesDeleted = await Vehicle.destroy({
      where: {
        id: {
          [Op.in]: vehicleIds,
        },
      },
    });
    console.log(`   ✅ Deleted ${vehiclesDeleted} vehicle(s)`);

    // Step 6: Remove dealers that have no vehicles left
    console.log("\n🗑️  Step 4/4: Checking and removing empty dealers...");
    let dealersDeleted = 0;
    let dealerProfilesDeleted = 0;

    for (const dealerId of dealerIdsWithOldVehicles) {
      // Check if dealer has any remaining vehicles
      const remainingVehicles = await Vehicle.count({
        where: {
          dealerId: dealerId,
        },
      });

      if (remainingVehicles === 0) {
        // Delete dealer profile from Dealer table first
        const dealerProfileDeleted = await Dealer.destroy({
          where: {
            userId: dealerId,
          },
        });
        dealerProfilesDeleted += dealerProfileDeleted;

        // Then delete user account from User table
        const userDeleted = await User.destroy({
          where: {
            id: dealerId,
          },
        });

        if (userDeleted > 0) {
          dealersDeleted++;
        }
      }
    }

    console.log(`   ✅ Deleted ${dealerProfilesDeleted} dealer profile(s) from Dealer table`);
    console.log(`   ✅ Deleted ${dealersDeleted} user account(s) from User table`);

    console.log("\n" + "=".repeat(70));
    console.log("✅ [CLEANUP] Cleanup completed successfully!");
    console.log(`   - Advertisements removed: ${adsDeleted}`);
    console.log(`   - Test drive requests removed: ${testDriveRequestsDeleted}`);
    console.log(`   - Notifications removed: ${notificationsDeleted}`);
    console.log(`   - Vehicles removed: ${vehiclesDeleted}`);
    console.log(`   - Dealer profiles removed: ${dealerProfilesDeleted}`);
    console.log(`   - User accounts removed: ${dealersDeleted}`);
    console.log("=".repeat(70) + "\n");
  } catch (error) {
    console.error("\n❌ [CLEANUP] Cleanup job failed with error:", error);
    console.error("Stack trace:", error.stack);
  } finally {
    isRunning = false;
  }
}

// ─────────────────────────────
// SCHEDULE CRON JOB
// ─────────────────────────────

// Run every 1 minute
// Cron format: "*/1 * * * *"
cron.schedule("0 11 * * *", async () => {
  await cleanupUnverifiedDealers();
});

console.log("✅ Cleanup unverified dealers cronjob initialized.");
console.log("   - Scheduled to run every 1 minute");
console.log("   - Removes vehicles older than 2 weeks from unverified dealers");
console.log("   - Deletion order: Advertisements → Test Drive Requests → Notifications → Vehicles → Dealers");

// Export for manual execution if needed
module.exports = {
  cleanupUnverifiedDealers,
};
