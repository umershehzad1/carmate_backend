"use strict";

const BaseScraper = require("./BaseScraper");
const cheerio = require("cheerio");

/**
 * Kijiji Scraper
 * Scrapes vehicle listings from Kijiji Canada
 */
class KijijiScraper extends BaseScraper {
  constructor() {
    super("Kijiji");
    this.baseUrl = "https://www.kijiji.ca";
    this.searchUrl = `${this.baseUrl}/b-cars-vehicles/canada/c27l0`;
    this.maxPages = 10; // Number of pages to scrape per run
    this.maxVehicles = 100; // Maximum vehicles to collect
  }

  /**
   * Main scrape method
   */
  async scrape() {
    this.initStats();
    this.log("Starting OLX scraper...");

    try {
      const vehicles = [];

      // Scrape multiple pages
      for (let page = 1; page <= this.maxPages; page++) {
        if (vehicles.length >= this.maxVehicles) {
          this.log(`Reached maximum vehicle limit (${this.maxVehicles}). Stopping.`);
          break;
        }

        this.log(`Scraping page ${page}/${this.maxPages}`);

        try {
          const pageVehicles = await this.scrapePage(page);
          vehicles.push(...pageVehicles);

          // Add delay between pages to avoid getting blocked
          await this.sleep(3000 + Math.random() * 2000);
        } catch (error) {
          this.log(
            `Error scraping page ${page}: ${error.message}`,
            "error"
          );
        }
      }

      // Limit to maxVehicles
      const limitedVehicles = vehicles.slice(0, this.maxVehicles);
      this.stats.scraped = limitedVehicles.length;

      this.log(
        `Scraping completed. Found ${limitedVehicles.length} vehicles`,
        "success"
      );

      return limitedVehicles;
    } catch (error) {
      this.log(`Scraper failed: ${error.message}`, "error");
      throw error;
    }
  }

  /**
   * Scrape a single page
   */
  async scrapePage(page) {
    const url = page === 1 ? this.searchUrl : `${this.searchUrl}/page-${page}`;
    const html = await this.fetchHTML(url);
    const $ = cheerio.load(html);

    const vehicles = [];
    const listings = $(".search-item, [data-testid='listing-card'], .regular-ad");

    this.log(`Found ${listings.length} listings on page ${page}`);

    for (let i = 0; i < listings.length; i++) {
      try {
        const listingElement = $(listings[i]);
        const vehicleData = await this.extractVehicleData($, listingElement);

        if (vehicleData && this.validateVehicleData(vehicleData)) {
          vehicles.push(this.normalizeVehicleData(vehicleData));
        }
      } catch (error) {
        this.log(
          `Error extracting vehicle data: ${error.message}`,
          "warn"
        );
      }
    }

    return vehicles;
  }

  /**
   * Extract vehicle data from listing element
   */
  async extractVehicleData($, listingElement) {
    try {
      // Extract basic info from listing card
      const titleElement = listingElement.find(".title, a[class*='title']").first();
      const title = titleElement.text().trim();
      const detailUrl = listingElement.find("a.title, a[href*='/v-']").first().attr("href");

      const price = listingElement
        .find(".price, [class*='price']")
        .first()
        .text()
        .trim();

      const location = listingElement
        .find(".location, [class*='location']")
        .first()
        .text()
        .trim();

      const image = listingElement.find("img").first().attr("src") || listingElement.find("img").attr("data-src");

      // Extract features from listing
      const features = [];
      listingElement.find("span[data-aut-id='itemFeature']").each((i, elem) => {
        features.push($(elem).text().trim());
      });

      // Parse features
      const details = this.parseFeatures(features);

      // Extract year, make, model from title
      const titleParts = this.parseTitleParts(title);

      // Get seller info
      const sellerName = listingElement
        .find(".dealer-name, [class*='dealer']")
        .first()
        .text()
        .trim() || "Kijiji Dealer";

      const vehicleData = {
        // Basic info
        make: titleParts.make,
        model: titleParts.model,
        year: titleParts.year || details.year,
        price: price,

        // Location
        city: this.extractCity(location),
        province: this.extractProvince(location),
        location: location,

        // Details from features
        mileage: details.mileage,
        transmission: details.transmission,
        fuelType: details.fuelType,
        bodyType: details.bodyType,
        engineCapacity: details.engineCapacity,
        color: details.color,
        exteriorColor: details.exteriorColor || details.color,
        registeredIn: details.registeredIn || details.registerIn,
        registerIn: details.registerIn || details.registeredIn,
        assemblyIn: details.assemblyIn,
        doors: details.doors,
        drive: details.drive,

        // Image
        images: image ? [image] : [],

        // Description
        description: `${title} - Available in ${location}`,

        // Dealer info
        dealerName: sellerName,
        dealerLocation: location,

        // Source
        sourceUrl: detailUrl ? `${this.baseUrl}${detailUrl}` : null,
        sourceSite: this.name,
      };

      // If we have a detail URL, scrape detailed page for more info
      if (detailUrl) {
        try {
          const detailedData = await this.scrapeDetailPage(detailUrl);
          Object.assign(vehicleData, detailedData);

          // Add delay to avoid rate limiting
          await this.sleep(1500 + Math.random() * 1000);
        } catch (error) {
          this.log(
            `Could not scrape detail page: ${error.message}`,
            "warn"
          );
        }
      }

      return vehicleData;
    } catch (error) {
      this.log(
        `Error in extractVehicleData: ${error.message}`,
        "error"
      );
      return null;
    }
  }

  /**
   * Scrape detailed vehicle page
   */
  async scrapeDetailPage(detailPath) {
    const url = detailPath.startsWith("http")
      ? detailPath
      : `${this.baseUrl}${detailPath}`;

    const html = await this.fetchHTML(url);
    const $ = cheerio.load(html);

    const detailedData = {};

    // Extract all images - look for high-resolution images
    const images = [];
    const imageSet = new Set();
    $("img[data-aut-id='defaultImg'], .swiper-slide img, .image-gallery img, [class*='gallery'] img").each((i, elem) => {
      const imgSrc = $(elem).attr("data-src") || $(elem).attr("src") || $(elem).attr("data-original");
      if (imgSrc && !imgSrc.includes("placeholder") && !imgSrc.includes("logo") && !imgSrc.endsWith('.svg')) {
        // Try to get larger version
        let highResImg = imgSrc.replace(/small|thumb|medium/gi, 'large');
        highResImg = highResImg.replace(/_s\./i, '_l.');
        imageSet.add(highResImg);
      }
    });
    
    if (imageSet.size > 0) {
      detailedData.images = Array.from(imageSet);
    }

    // Extract full description
    const description = $("div[data-aut-id='itemDescriptionContent'], .description, [class*='description']")
      .first()
      .text()
      .trim();
    if (description) {
      detailedData.description = description;
    }

    // Initialize JSON field containers
    const interiorDetails = {};
    const exteriorDetails = {};
    const safetyFeatures = {};
    const specifications = {};

    // Extract specifications from detail page
    $(".itemAttribute, [class*='attribute'], .vehicle-info li, .specs-list li, dl dt, dl dd").each((i, elem) => {
      const text = $(elem).text().trim();
      const label = $(elem).find(".label, dt").text().trim().toLowerCase();
      const value = $(elem).find(".value, dd").text().trim();

      if (label && value) {
        this.mapSpecification(label, value, detailedData);
        this.categorizeFeature(label, value, interiorDetails, exteriorDetails, safetyFeatures, specifications);
      } else if (text.includes(":")) {
        const parts = text.split(":");
        if (parts.length === 2) {
          const key = parts[0].trim().toLowerCase();
          const val = parts[1].trim();
          this.mapSpecification(key, val, detailedData);
          this.categorizeFeature(key, val, interiorDetails, exteriorDetails, safetyFeatures, specifications);
        }
      } else if (text.length > 3 && text.length < 100) {
        // Categorize standalone features
        this.categorizeFeature(text, true, interiorDetails, exteriorDetails, safetyFeatures, specifications);
      }
    });

    // Assign JSON fields if they have content
    if (Object.keys(interiorDetails).length > 0) detailedData.interiorDetails = interiorDetails;
    if (Object.keys(exteriorDetails).length > 0) detailedData.exteriorDetails = exteriorDetails;
    if (Object.keys(safetyFeatures).length > 0) detailedData.safetyFeatures = safetyFeatures;
    if (Object.keys(specifications).length > 0) detailedData.specifications = specifications;

    // Extract seller contact
    const sellerPhone = $(".phone-number, [href^='tel:'], [class*='phone']").first().text().trim();
    if (sellerPhone) {
      detailedData.dealerPhone = sellerPhone;
    }

    const sellerName = $(".seller-name, [class*='seller-name'], [class*='dealer-name']").first().text().trim();
    if (sellerName) {
      detailedData.dealerName = sellerName;
    }

    return detailedData;
  }

  /**
   * Categorize a feature into the appropriate JSON field
   */
  categorizeFeature(label, value, interiorDetails, exteriorDetails, safetyFeatures, specifications) {
    const lowerLabel = typeof label === 'string' ? label.toLowerCase() : '';
    
    // Interior features
    if (lowerLabel.includes('seat') || lowerLabel.includes('leather') || 
        lowerLabel.includes('cloth') || lowerLabel.includes('heated') || 
        lowerLabel.includes('ventilated') || lowerLabel.includes('sunroof') ||
        lowerLabel.includes('moonroof') || lowerLabel.includes('climate') ||
        lowerLabel.includes('air conditioning') || lowerLabel.includes('navigation') ||
        lowerLabel.includes('audio') || lowerLabel.includes('stereo') ||
        lowerLabel.includes('bluetooth') || lowerLabel.includes('usb')) {
      interiorDetails[label] = value;
    }
    // Exterior features
    else if (lowerLabel.includes('wheel') || lowerLabel.includes('alloy') || 
             lowerLabel.includes('paint') || lowerLabel.includes('roof rack') ||
             lowerLabel.includes('running boards') || lowerLabel.includes('tow') ||
             lowerLabel.includes('spoiler') || lowerLabel.includes('fog light') ||
             lowerLabel.includes('headlight') || lowerLabel.includes('mirror')) {
      exteriorDetails[label] = value;
    }
    // Safety features
    else if (lowerLabel.includes('airbag') || lowerLabel.includes('abs') || 
             lowerLabel.includes('brake assist') || lowerLabel.includes('stability') ||
             lowerLabel.includes('traction') || lowerLabel.includes('blind spot') ||
             lowerLabel.includes('collision') || lowerLabel.includes('lane') ||
             lowerLabel.includes('backup camera') || lowerLabel.includes('rear camera') ||
             lowerLabel.includes('parking') || lowerLabel.includes('cruise control')) {
      safetyFeatures[label] = value;
    }
    // General specifications
    else {
      specifications[label] = value;
    }
  }

  /**
   * Parse features array
   */
  parseFeatures(features) {
    const details = {};

    features.forEach((feature) => {
      const lowerFeature = feature.toLowerCase();

      // Year
      const yearMatch = feature.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) {
        details.year = yearMatch[0];
      }

      // Mileage
      if (lowerFeature.includes("km")) {
        details.mileage = feature;
      }

      // Transmission
      if (lowerFeature.includes("automatic")) {
        details.transmission = "Automatic";
      } else if (lowerFeature.includes("manual")) {
        details.transmission = "Manual";
      }

      // Fuel type
      if (lowerFeature.includes("petrol")) details.fuelType = "Petrol";
      if (lowerFeature.includes("diesel")) details.fuelType = "Diesel";
      if (lowerFeature.includes("cng")) details.fuelType = "CNG";
      if (lowerFeature.includes("hybrid")) details.fuelType = "Hybrid";

      // Engine capacity
      if (lowerFeature.includes("cc") || lowerFeature.includes("litre") || lowerFeature.includes("liter") || lowerFeature.includes("cylinder")) {
        const engineCC = this.extractEngineCC(feature);
        if (engineCC) details.engineCapacity = engineCC;
      }
    });

    return details;
  }

  /**
   * Parse title to extract year, make, model
   */
  parseTitleParts(title) {
    const parts = {
      year: null,
      make: null,
      model: null,
    };

    if (!title) return parts;

    // Extract year (usually 4 digits)
    const yearMatch = title.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      parts.year = yearMatch[0];
    }

    // Common Pakistani car makes
    const makes = [
      "Toyota",
      "Honda",
      "Suzuki",
      "Daihatsu",
      "Nissan",
      "Mitsubishi",
      "Mercedes",
      "BMW",
      "Audi",
      "Hyundai",
      "KIA",
      "Mazda",
      "Ford",
      "Chevrolet",
      "FAW",
      "Changan",
      "MG",
      "Proton",
      "Volkswagen",
      "Peugeot",
      "Prince",
      "United",
    ];

    for (const make of makes) {
      if (title.toLowerCase().includes(make.toLowerCase())) {
        parts.make = make;
        break;
      }
    }

    // Extract model (text after make)
    if (parts.make) {
      const makeIndex = title.toLowerCase().indexOf(parts.make.toLowerCase());
      const afterMake = title.substring(makeIndex + parts.make.length).trim();
      const modelMatch = afterMake.match(/^([A-Za-z0-9\s-]+)/);

      if (modelMatch) {
        let model = modelMatch[1].trim();
        // Remove year from model if present
        if (parts.year) {
          model = model.replace(parts.year, "").trim();
        }
        // Remove "for sale" and similar phrases
        model = model
          .replace(/for sale/i, "")
          .replace(/\b(on installment|installment)\b/i, "")
          .trim();

        parts.model = model || "Unknown";
      }
    }

    return parts;
  }

  /**
   * Map specification label to field
   */
  mapSpecification(label, value, specs) {
    const lowerLabel = label.toLowerCase();

    if (lowerLabel.includes("mileage") || lowerLabel.includes("km")) {
      specs.mileage = value;
    } else if (lowerLabel.includes("transmission")) {
      specs.transmission = value;
    } else if (lowerLabel.includes("fuel")) {
      specs.fuelType = value;
    } else if (lowerLabel.includes("body")) {
      specs.bodyType = value;
    } else if (lowerLabel.includes("color") || lowerLabel.includes("colour")) {
      specs.color = value;
      specs.exteriorColor = value;
    } else if (lowerLabel.includes("engine") || lowerLabel.includes("cc") || lowerLabel.includes("displacement") || lowerLabel.includes("cylinder") || lowerLabel.includes("litre") || lowerLabel.includes("liter")) {
      const engineCC = this.extractEngineCC(value);
      if (engineCC) specs.engineCapacity = engineCC;
    } else if (lowerLabel.includes("registered") || lowerLabel.includes("registration")) {
      specs.registeredIn = value;
      specs.registerIn = value;
    } else if (lowerLabel.includes("assembly") || lowerLabel.includes("assembled")) {
      specs.assemblyIn = value;
    } else if (lowerLabel.includes("condition")) {
      specs.condition = value.toLowerCase();
    } else if (lowerLabel.includes("make")) {
      specs.make = value;
    } else if (lowerLabel.includes("model") && !lowerLabel.includes("year")) {
      specs.model = value;
    } else if (lowerLabel.includes("year")) {
      specs.year = value;
    } else if (lowerLabel.includes("doors")) {
      const doorsMatch = value.match(/(\d+)/);
      if (doorsMatch) specs.doors = parseInt(doorsMatch[1]);
    } else if (lowerLabel.includes("drive") || lowerLabel.includes("drivetrain")) {
      specs.drive = value;
    }
  }

  /**
   * Extract city from location string
   */
  extractCity(location) {
    if (!location) return null;

    const cities = [
      "Toronto",
      "Ottawa",
      "Mississauga",
      "Brampton",
      "Hamilton",
      "London",
      "Markham",
      "Vaughan",
      "Kitchener",
      "Windsor",
      "Montreal",
      "Quebec City",
      "Laval",
      "Gatineau",
      "Vancouver",
      "Surrey",
      "Burnaby",
      "Richmond",
      "Calgary",
      "Edmonton",
      "Winnipeg",
      "Halifax",
      "Victoria",
      "Regina",
      "Saskatoon",
    ];

    for (const city of cities) {
      if (location.toLowerCase().includes(city.toLowerCase())) {
        return city;
      }
    }

    // If no match, return first part of location
    return location.split(",")[0].trim();
  }

  /**
   * Extract province from location string
   */
  extractProvince(location) {
    if (!location) return null;

    const lowerLocation = location.toLowerCase();

    if (
      lowerLocation.includes("ontario") ||
      lowerLocation.includes("toronto") ||
      lowerLocation.includes("ottawa") ||
      lowerLocation.includes("mississauga")
    ) {
      return "Ontario";
    } else if (
      lowerLocation.includes("quebec") ||
      lowerLocation.includes("montreal") ||
      lowerLocation.includes("laval")
    ) {
      return "Quebec";
    } else if (
      lowerLocation.includes("british columbia") ||
      lowerLocation.includes("bc") ||
      lowerLocation.includes("vancouver") ||
      lowerLocation.includes("victoria")
    ) {
      return "British Columbia";
    } else if (
      lowerLocation.includes("alberta") ||
      lowerLocation.includes("calgary") ||
      lowerLocation.includes("edmonton")
    ) {
      return "Alberta";
    } else if (
      lowerLocation.includes("manitoba") ||
      lowerLocation.includes("winnipeg")
    ) {
      return "Manitoba";
    } else if (
      lowerLocation.includes("saskatchewan") ||
      lowerLocation.includes("regina")
    ) {
      return "Saskatchewan";
    } else if (
      lowerLocation.includes("nova scotia") ||
      lowerLocation.includes("halifax")
    ) {
      return "Nova Scotia";
    }

    return null;
  }
}

module.exports = KijijiScraper;
