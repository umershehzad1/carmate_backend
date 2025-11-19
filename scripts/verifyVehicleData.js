"use strict";

/**
 * Verify Vehicle Data Script
 * Check if vehicles were saved with all required fields
 */

require("dotenv").config();
const db = require("../app/Models/index");
const Vehicle = db.Vehicle;

async function verifyVehicleData() {
  console.log("\n" + "=".repeat(70));
  console.log("🔍 VEHICLE DATA VERIFICATION");
  console.log("=".repeat(70) + "\n");

  try {
    // Get the latest 5 vehicles
    const vehicles = await Vehicle.findAll({
      limit: 5,
      order: [["createdAt", "DESC"]],
    });

    if (vehicles.length === 0) {
      console.log("❌ No vehicles found in database\n");
      process.exit(1);
    }

    console.log(`✅ Found ${vehicles.length} vehicles\n`);

    for (const vehicle of vehicles) {
      console.log("─".repeat(70));
      console.log(`\n📋 Vehicle: ${vehicle.name} (ID: ${vehicle.id})`);
      console.log(`   Make: ${vehicle.make || "❌ MISSING"}`);
      console.log(`   Model: ${vehicle.model || "❌ MISSING"}`);
      console.log(`   Year: ${vehicle.year || "❌ MISSING"}`);
      console.log(`   Price: $${vehicle.price || "❌ MISSING"}`);
      console.log(`   Mileage: ${vehicle.mileage ? vehicle.mileage + " km" : "❌ MISSING"}`);
      console.log(`   Color: ${vehicle.color || vehicle.exteriorColor || "❌ MISSING"}`);
      console.log(`   Exterior Color: ${vehicle.exteriorColor || "❌ MISSING"}`);
      console.log(`   Transmission: ${vehicle.transmission || "❌ MISSING"}`);
      console.log(`   Fuel Type: ${vehicle.fuelType || "❌ MISSING"}`);
      console.log(`   Body Type: ${vehicle.bodyType || "❌ MISSING"}`);
      console.log(`   Doors: ${vehicle.doors || "❌ MISSING"}`);
      console.log(`   Drive: ${vehicle.drive || "❌ MISSING"}`);
      console.log(`   Engine Capacity: ${vehicle.engineCapacity || "❌ MISSING"}`);
      console.log(`   Fuel Consumption: ${vehicle.fuelConsumption || "❌ MISSING"}`);
      console.log(`   Location: ${vehicle.location || "❌ MISSING"}`);
      console.log(`   City: ${vehicle.city || "❌ MISSING"}`);
      console.log(`   Province: ${vehicle.province || "❌ MISSING"}`);
      console.log(`   Condition: ${vehicle.condition || "❌ MISSING"}`);
      console.log(`   Images: ${vehicle.images ? vehicle.images.length : 0} images`);
      
      if (vehicle.images && vehicle.images.length > 0) {
        console.log(`   Image URLs:`);
        vehicle.images.forEach((img, idx) => {
          console.log(`     ${idx + 1}. ${img.substring(0, 80)}...`);
        });
      }
      
      // Check JSON fields
      console.log(`   Interior Details: ${vehicle.interiorDetails ? Object.keys(vehicle.interiorDetails).length + " items" : "❌ MISSING"}`);
      console.log(`   Exterior Details: ${vehicle.exteriorDetails ? Object.keys(vehicle.exteriorDetails).length + " items" : "❌ MISSING"}`);
      console.log(`   Safety Features: ${vehicle.safetyFeatures ? Object.keys(vehicle.safetyFeatures).length + " items" : "❌ MISSING"}`);
      console.log(`   Specifications: ${vehicle.specifications ? Object.keys(vehicle.specifications).length + " items" : "❌ MISSING"}`);
      
      console.log("\n");
    }

    console.log("─".repeat(70));
    console.log("\n✅ Verification completed!\n");

    // Summary
    const missingFields = {
      mileage: 0,
      color: 0,
      doors: 0,
      drive: 0,
      fuelConsumption: 0,
      interiorDetails: 0,
      exteriorDetails: 0,
      safetyFeatures: 0,
      specifications: 0,
    };

    vehicles.forEach(v => {
      if (!v.mileage) missingFields.mileage++;
      if (!v.color && !v.exteriorColor) missingFields.color++;
      if (!v.doors) missingFields.doors++;
      if (!v.drive) missingFields.drive++;
      if (!v.fuelConsumption) missingFields.fuelConsumption++;
      if (!v.interiorDetails) missingFields.interiorDetails++;
      if (!v.exteriorDetails) missingFields.exteriorDetails++;
      if (!v.safetyFeatures) missingFields.safetyFeatures++;
      if (!v.specifications) missingFields.specifications++;
    });

    console.log("📊 SUMMARY:");
    console.log(`   Vehicles with missing mileage: ${missingFields.mileage}/${vehicles.length}`);
    console.log(`   Vehicles with missing color: ${missingFields.color}/${vehicles.length}`);
    console.log(`   Vehicles with missing doors: ${missingFields.doors}/${vehicles.length}`);
    console.log(`   Vehicles with missing drive: ${missingFields.drive}/${vehicles.length}`);
    console.log(`   Vehicles with missing fuel consumption: ${missingFields.fuelConsumption}/${vehicles.length}`);
    console.log(`   Vehicles with missing interior details: ${missingFields.interiorDetails}/${vehicles.length}`);
    console.log(`   Vehicles with missing exterior details: ${missingFields.exteriorDetails}/${vehicles.length}`);
    console.log(`   Vehicles with missing safety features: ${missingFields.safetyFeatures}/${vehicles.length}`);
    console.log(`   Vehicles with missing specifications: ${missingFields.specifications}/${vehicles.length}`);
    console.log("\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Verification failed:");
    console.error(error);
    console.error("\nStack trace:", error.stack);
    process.exit(1);
  }
}

// Run verification
verifyVehicleData();
