"use strict";

const db = require("../Models/index");
const User = db.User;
const Dealer = db.Dealer;
const Vehicle = db.Vehicle;
const Advertisement = db.Advertisement;
const { Op } = require("sequelize");
const bcrypt = require("bcryptjs");
const slugify = require("slugify");
const axios = require("axios");
const cloudinary = require("../Traits/Cloudinary");

const AutoTraderScraper = require("./AutoTraderScraper");
const SteeleFordScraper = require("./SteeleFordScraper");
const OreganScrapper = require("./OreganScrapper");


class ScraperOrchestrator {
  constructor() {
    // Configure which scrapers to run here. Kijiji is intentionally omitted.
    this.scrapers = [
      new AutoTraderScraper(),
      new SteeleFordScraper(),
      new OreganScrapper(),
    ];

    // Global cap across all scrapers — default to 5 vehicles per scraper
    this.globalMaxVehicles = (this.scrapers.length || 1) * 5;

    this.stats = {
      totalScraped: 0,
      totalDealersCreated: 0,
      totalVehiclesCreated: 0,
      totalAdvertisementsCreated: 0,
      totalErrors: 0,
      startTime: null,
      endTime: null,
    };
  }

  /**
   * Log with timestamp
   */
  log(message, level = "info") {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [Orchestrator]`;

    switch (level) {
      case "error":
        console.error(`❌ ${prefix}`, message);
        break;
      case "warn":
        console.warn(`⚠️  ${prefix}`, message);
        break;
      case "success":
        console.log(`✅ ${prefix}`, message);
        break;
      default:
        console.log(`ℹ️  ${prefix}`, message);
    }
  }

  /**
   * Run all scrapers and import data
   */
  async run() {
    this.stats.startTime = new Date();
    this.log("🚀 Starting scraper orchestrator...");

    try {
      // Scrape data from all sources
      const allVehicles = await this.scrapeAllSources();

      this.log(
        `📊 Total vehicles scraped: ${allVehicles.length}`,
        "success"
      );

      // Group vehicles by dealer
      const vehiclesByDealer = this.groupVehiclesByDealer(allVehicles);

      this.log(
        `👥 Found ${Object.keys(vehiclesByDealer).length} unique dealers`
      );

      // Process each dealer and their vehicles
      for (const [dealerKey, vehicles] of Object.entries(vehiclesByDealer)) {
        try {
          await this.processDealerAndVehicles(dealerKey, vehicles);
        } catch (error) {
          this.log(
            `Error processing dealer ${dealerKey}: ${error.message}`,
            "error"
          );
          this.stats.totalErrors++;
        }
      }

      this.stats.endTime = new Date();
      this.printSummary();

      // Ensure all scraper browsers are closed
      for (const scraper of this.scrapers) {
        if (scraper.closeBrowser) {
          await scraper.closeBrowser();
        }
      }
    } catch (error) {
      this.log(`Orchestrator failed: ${error.message}`, "error");
      
      // Ensure browsers are closed on error
      for (const scraper of this.scrapers) {
        if (scraper.closeBrowser) {
          await scraper.closeBrowser().catch(() => {});
        }
      }
      
      throw error;
    }
  }

  /**
   * Scrape data from all configured scrapers
   */
  async scrapeAllSources() {
    const allVehicles = [];

    // Allocate per-scraper quotas so combined results do not exceed globalMaxVehicles
    const numScrapers = this.scrapers.length || 1;
    const basePer = Math.floor(this.globalMaxVehicles / numScrapers);
    const remainder = this.globalMaxVehicles % numScrapers;

    this.log(`Allocating up to ${this.globalMaxVehicles} vehicles across ${numScrapers} scrapers (${basePer} each, +1 for first ${remainder} scrapers if needed)`);

    for (let i = 0; i < this.scrapers.length; i++) {
      const scraper = this.scrapers[i];
      try {
        // Assign quota for this run — distribute the remainder across the first N scrapers
        const allocated = basePer + (i < remainder ? 1 : 0);
        // Respect a scraper's own configured (smaller) `maxVehicles` when present.
        // If the scraper has explicitly set a lower `maxVehicles`, keep it instead of overwriting.
        if (typeof scraper.maxVehicles !== "undefined" && scraper.maxVehicles > 0 && scraper.maxVehicles < allocated) {
          this.log(`Respecting ${scraper.name} scraper's configured maxVehicles: ${scraper.maxVehicles}`);
        } else {
          // Assign the allocated quota for this run
          scraper.maxVehicles = allocated;
        }

        this.log(`Running ${scraper.name} scraper (quota: ${scraper.maxVehicles})...`);
        const vehicles = await scraper.scrape();

        this.log(
          `${scraper.name} scraped ${vehicles.length} vehicles`,
          "success"
        );

        if (vehicles && vehicles.length > 0) {
          allVehicles.push(...vehicles);
          this.stats.totalScraped += vehicles.length;
        }
      } catch (error) {
        this.log(
          `${scraper.name} scraper failed: ${error.message}`,
          "error"
        );
        this.stats.totalErrors++;
      }
    }

    // Ensure global cap
    if (allVehicles.length > this.globalMaxVehicles) {
      this.log(`Trimming combined results from ${allVehicles.length} to global cap ${this.globalMaxVehicles}`);
      return allVehicles.slice(0, this.globalMaxVehicles);
    }

    return allVehicles;
  }

  /**
   * Group vehicles by dealer
   */
  groupVehiclesByDealer(vehicles) {
    const grouped = {};

    vehicles.forEach((vehicle) => {
      // Create unique dealer key from name and location
      const dealerKey = this.createDealerKey(
        vehicle.dealerName,
        vehicle.dealerLocation
      );

      if (!grouped[dealerKey]) {
        grouped[dealerKey] = {
          dealerInfo: {
            name: vehicle.dealerName,
            location: vehicle.dealerLocation,
            phone: vehicle.dealerPhone,
            email: vehicle.dealerEmail,
            image: vehicle.dealerImage, // Add dealer image
            sourceSite: vehicle.sourceSite,
          },
          vehicles: [],
        };
      } else {
        // Update dealer image if not set and current vehicle has one
        if (!grouped[dealerKey].dealerInfo.image && vehicle.dealerImage) {
          grouped[dealerKey].dealerInfo.image = vehicle.dealerImage;
        }
      }

      grouped[dealerKey].vehicles.push(vehicle);
    });

    return grouped;
  }

  /**
   * Create unique dealer key
   */
  createDealerKey(name, location) {
    const cleanName = (name || "unknown").toLowerCase().trim();
    const cleanLocation = (location || "unknown").toLowerCase().trim();
    return `${cleanName}-${cleanLocation}`;
  }

  /**
   * Process dealer and their vehicles
   */
  async processDealerAndVehicles(dealerKey, dealerData) {
    const { dealerInfo, vehicles } = dealerData;

    this.log(
      `Processing dealer: ${dealerInfo.name} (${vehicles.length} vehicles)`
    );

    // Find or create dealer user
    const dealerUser = await this.findOrCreateDealer(dealerInfo);

    if (!dealerUser) {
      this.log(`Failed to create dealer: ${dealerInfo.name}`, "error");
      return;
    }

    this.log(
      `Dealer user ID: ${dealerUser.id} (${dealerInfo.name})`,
      "success"
    );

    // Process each vehicle for this dealer
    for (const vehicleData of vehicles) {
      try {
        await this.createVehicleWithAd(dealerUser.id, vehicleData);
      } catch (error) {
        this.log(
          `Error creating vehicle: ${error.message}`,
          "error"
        );
        this.stats.totalErrors++;
      }
    }
  }

  /**
   * Download image from URL and upload to Cloudinary
   */
  async downloadAndUploadImage(imageUrl, folder = "vehicles", baseUrl = "https://www.autotrader.ca") {
    try {
      // Skip placeholder images and ghost/placeholder SVGs
      if (!imageUrl || 
          imageUrl.includes("placeholder") || 
          imageUrl.includes("via.placeholder") ||
          imageUrl.includes("ghost-image") ||
          imageUrl.endsWith(".svg")) {
        return null;
      }

      // Convert relative URLs to absolute URLs
      let absoluteUrl = imageUrl;
      if (imageUrl.startsWith("/")) {
        absoluteUrl = `${baseUrl}${imageUrl}`;
      } else if (!imageUrl.startsWith("http")) {
        absoluteUrl = `${baseUrl}/${imageUrl}`;
      }

      this.log(`Downloading image: ${absoluteUrl.substring(0, 80)}...`);

      // Download image with timeout
      const response = await axios.get(absoluteUrl, {
        responseType: "arraybuffer",
        timeout: 30000, // 30 second timeout
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      // Get content type
      const contentType = response.headers["content-type"] || "image/jpeg";

      // Convert to base64
      const base64Image = Buffer.from(response.data, "binary").toString("base64");
      const dataUri = `data:${contentType};base64,${base64Image}`;

      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload(dataUri, {
        resource_type: "image",
        folder: folder,
      });

      this.log(`Image uploaded to Cloudinary: ${result.secure_url}`, "success");
      return result.secure_url;
    } catch (error) {
      this.log(`Failed to download/upload image: ${error.message}`, "warn");
      return null;
    }
  }

  /**
   * Download and upload multiple images
   */
  async downloadAndUploadImages(imageUrls, folder = "vehicles", maxImages = 10) {
    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return [];
    }

    const cloudinaryUrls = [];
    const limit = Math.min(imageUrls.length, maxImages);

    for (let i = 0; i < limit; i++) {
      const cloudinaryUrl = await this.downloadAndUploadImage(imageUrls[i], folder);
      if (cloudinaryUrl) {
        cloudinaryUrls.push(cloudinaryUrl);
      }

      // Add small delay between uploads to avoid rate limiting
      if (i < limit - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return cloudinaryUrls;
  }

  /**
   * Find or create dealer user
   */
  async findOrCreateDealer(dealerInfo) {
    try {
      // Generate unique identifiers
      const username = this.generateUsername(dealerInfo.name);
      const email = this.generateEmail(dealerInfo.name);

      // Check if dealer already exists by username or email
      let user = await User.findOne({
        where: {
          [Op.or]: [
            { username: { [Op.iLike]: `%${dealerInfo.name}%` } },
            { email: email },
          ],
          role: "dealer",
        },
      });

      if (user) {
        this.log(`Dealer already exists: ${dealerInfo.name} (ID: ${user.id})`);
        return user;
      }

      // Create new dealer user
      const password = this.generatePassword();
      const hashedPassword = await bcrypt.hash(password, 10);

      // Download and upload dealer profile image if available
      let profileImageUrl = null;
      if (dealerInfo.image) {
        profileImageUrl = await this.downloadAndUploadImage(dealerInfo.image, "dealers");
      }

      user = await User.create({
        email: email,
        password: hashedPassword,
        fullname: (dealerInfo.name || 'Unknown Dealer').substring(0, 100),
        username: username,
        phone: dealerInfo.phone ? dealerInfo.phone.substring(0, 50) : null,
        role: "dealer",
        image: profileImageUrl, // Add Cloudinary image URL
      });

      this.log(`Created new dealer user: ${dealerInfo.name} (ID: ${user.id})`, "success");

      // Create dealer profile in Dealer table
      const dealerSlug = slugify(dealerInfo.name, { lower: true, strict: true });
      const uniqueSlug = `${dealerSlug}-${user.id}`;

      const dealerProfile = await Dealer.create({
        userId: user.id,
        location: dealerInfo.location || "Canada",
        status: "nonverified",
        slug: uniqueSlug,
        availableCarListing: 20, // Give initial listing quota for scraped dealers
      });

      this.log(`Created dealer profile for: ${dealerInfo.name} (Dealer ID: ${dealerProfile.id})`, "success");
      this.stats.totalDealersCreated++;

      return user;
    } catch (error) {
      this.log(`Error creating dealer: ${error.message}`, "error");
      throw error;
    }
  }

  /**
   * Create vehicle with base advertisement
   */
  async createVehicleWithAd(dealerId, vehicleData) {
    try {
      // Normalize fields to match DB column types (many columns are strings)
      const normYear = vehicleData.year != null ? String(vehicleData.year) : null;
      const normMileage = vehicleData.mileage != null ? String(vehicleData.mileage) : null;

      // Check if vehicle already exists
      const existingVehicle = await Vehicle.findOne({
        where: {
          dealerId: dealerId,
          make: vehicleData.make,
          model: vehicleData.model,
          year: normYear,
          price: vehicleData.price,
        },
      });

      if (existingVehicle) {
        this.log(
          `Vehicle already exists: ${vehicleData.make} ${vehicleData.model} ${vehicleData.year}`
        );
        return;
      }

      // Generate unique slug
      const slug = this.generateVehicleSlug(vehicleData, dealerId);

      // Create vehicle name
      const name = `${vehicleData.year} ${vehicleData.make} ${vehicleData.model}`;

      // Download and upload images to Cloudinary
      this.log(`Downloading and uploading images for: ${name} (${vehicleData.images?.length || 0} images found)`);
      const cloudinaryImages = await this.downloadAndUploadImages(
        vehicleData.images,
        "vehicles",
        5 // Limit to 5 images per vehicle
      );

      // If no images were successfully uploaded, use placeholder
      const finalImages = cloudinaryImages.length > 0
        ? cloudinaryImages
        : ["https://via.placeholder.com/800x600?text=No+Image"];

      this.log(`Successfully uploaded ${cloudinaryImages.length} images for: ${name}`, "success");

      // Prepare vehicle data - map all fields from Vehicle model
      // Normalize condition to match ENUM values in DB
      let normCondition = (vehicleData.condition || "used").toString().toLowerCase();
      if (normCondition.startsWith("u")) normCondition = "used";
      else if (normCondition.startsWith("n")) normCondition = "new";
      else if (normCondition.includes("cert")) normCondition = "certified";
      else normCondition = "used";

      const vehiclePayload = {
        dealerId: dealerId,
        name: name,
        slug: slug,
        images: finalImages,
        price: vehicleData.price || "0",
        city: vehicleData.city,
        province: vehicleData.province,
        make: vehicleData.make,
        model: vehicleData.model,
        modelCategory: vehicleData.modelCategory,
        year: normYear,
        mileage: normMileage,
        transmission: vehicleData.transmission || "Manual",
        fuelType: vehicleData.fuelType || "Petrol",
        registerIn: vehicleData.registerIn,
        assemblyIn: vehicleData.assemblyIn,
        bodyType: vehicleData.bodyType,
        color: vehicleData.color || vehicleData.exteriorColor,
        exteriorColor: vehicleData.exteriorColor || vehicleData.color,
        engineCapacity: vehicleData.engineCapacity,
        condition: normCondition,
        description: vehicleData.description || `${name} available for sale`,
        status: "live", // Set to live so it triggers automatic ad creation
        location: vehicleData.location,
        doors: vehicleData.doors ? parseInt(vehicleData.doors) : null,
        drive: vehicleData.drive,
        fuelConsumption: vehicleData.fuelConsumption,
        interiorDetails: vehicleData.interiorDetails,
        exteriorDetails: vehicleData.exteriorDetails,
        safetyFeatures: vehicleData.safetyFeatures,
        specifications: vehicleData.specifications,
        tags: vehicleData.tags || [],
      };

      // Check if dealer has available listings
      const dealer = await Dealer.findOne({ where: { userId: dealerId } });

      if (!dealer || dealer.availableCarListing <= 0) {
        this.log(
          `Dealer ${dealerId} has no available listings. Skipping vehicle.`,
          "warn"
        );
        return;
      }

      // Create vehicle (this will automatically create base ad via model hook)
      const vehicle = await Vehicle.create(vehiclePayload);

      this.log(
        `Created vehicle: ${name} (ID: ${vehicle.id})`,
        "success"
      );
      this.stats.totalVehiclesCreated++;

      // Check if advertisement was created (should be automatic from Vehicle model hook)
      const ad = await Advertisement.findOne({
        where: {
          vehicleId: vehicle.id,
          adType: "base",
        },
      });

      if (ad) {
        this.log(
          `Base advertisement created for vehicle ID: ${vehicle.id}`,
          "success"
        );
        this.stats.totalAdvertisementsCreated++;
      } else {
        this.log(
          `Warning: Base ad not created for vehicle ID: ${vehicle.id}`,
          "warn"
        );
      }

      return vehicle;
    } catch (error) {
      this.log(
        `Error creating vehicle: ${error.message}`,
        "error"
      );
      throw error;
    }
  }

  /**
   * Generate unique username
   */
  generateUsername(dealerName) {
    // Limit dealer name to first 30 characters for username
    const cleanName = (dealerName || 'dealer').substring(0, 30);
    const base = slugify(cleanName, { lower: true, strict: true });
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000);
    return `${base}-${timestamp}${random}`.substring(0, 50);
  }

  /**
   * Generate email from dealer name
   */
  generateEmail(dealerName) {
    // Limit dealer name to first 30 characters for email
    const cleanName = (dealerName || 'dealer').substring(0, 30);
    const base = slugify(cleanName, { lower: true, strict: true });
    const timestamp = Date.now().toString().slice(-6);
    return `${base}-${timestamp}@scraped-dealers.carmate.com`.substring(0, 200);
  }

  /**
   * Generate unique vehicle slug
   */
  generateVehicleSlug(vehicleData, dealerId) {
    const parts = [
      vehicleData.year,
      vehicleData.make,
      vehicleData.model,
      vehicleData.city || "pk",
      dealerId,
    ]
      .filter(Boolean)
      .join("-");

    const baseSlug = slugify(parts, { lower: true, strict: true });
    const timestamp = Date.now().toString().slice(-6);
    return `${baseSlug}-${timestamp}`;
  }

  /**
   * Generate random password
   */
  generatePassword(length = 16) {
    const charset =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }

  /**
   * Print summary statistics
   */
  printSummary() {
    const duration = this.stats.endTime - this.stats.startTime;
    const durationMinutes = (duration / 1000 / 60).toFixed(2);

    this.log("\n" + "=".repeat(60));
    this.log("📊 SCRAPER ORCHESTRATOR SUMMARY");
    this.log("=".repeat(60));
    this.log(`⏱️  Duration: ${durationMinutes} minutes`);
    this.log(`🔍 Total Scraped: ${this.stats.totalScraped} listings`);
    this.log(`👥 Dealers Created: ${this.stats.totalDealersCreated}`);
    this.log(`🚗 Vehicles Created: ${this.stats.totalVehiclesCreated}`);
    this.log(`📢 Ads Created: ${this.stats.totalAdvertisementsCreated}`);
    this.log(`❌ Errors: ${this.stats.totalErrors}`);
    this.log("=".repeat(60) + "\n");
  }
}

module.exports = ScraperOrchestrator;
