"use strict";

const BaseScraper = require("./BaseScraper");
const cheerio = require("cheerio");

/**
 * Oregans.com Scraper
 * Scrapes vehicle listings from O'Regan's dealership website (Atlantic Canada)
 * Based on actual HTML structure analysis
 */
class OregansScraper extends BaseScraper {
  constructor() {
    super("Oregans");
    this.baseUrl = "https://www.oregans.com";
    this.searchUrl = `${this.baseUrl}/inventory/`;
    this.maxPages = 1;
    this.maxVehicles = 33;
  }

  /**
   * Main scrape method
   */
  async scrape() {
    this.initStats();
    this.log("Starting Oregans scraper...");

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
          
          if (pageVehicles.length === 0) {
            this.log(`No vehicles found on page ${page}. Stopping pagination.`);
            break;
          }
          
          vehicles.push(...pageVehicles);
          this.log(`Found ${pageVehicles.length} vehicles on page ${page}`);

          // Add delay between pages
          await this.sleep(2000 + Math.random() * 2000);
        } catch (error) {
          this.log(`Error scraping page ${page}: ${error.message}`, "error");
        }
      }

      // Limit to maxVehicles
      const limitedVehicles = vehicles.slice(0, this.maxVehicles);
      this.stats.scraped = limitedVehicles.length;

      this.log(`Scraping completed. Found ${limitedVehicles.length} vehicles`, "success");

      await this.closeBrowser();
      return limitedVehicles;
    } catch (error) {
      this.log(`Scraper failed: ${error.message}`, "error");
      await this.closeBrowser();
      throw error;
    }
  }

  /**
   * Scrape a single page
   * Note: Oregans may use infinite scroll or AJAX loading
   * This handles URL-based pagination as fallback
   */
  async scrapePage(page) {
    // Try different pagination patterns
    let url = this.searchUrl;
    if (page > 1) {
      // Common pagination patterns - may need adjustment based on actual site behavior
      url = `${this.searchUrl}?page=${page}`;
    }

    const html = await this.fetchHTML(url);
    const $ = cheerio.load(html);

    const vehicles = [];
    
    // Main vehicle listing selector based on actual HTML
    const listings = $(".ouvsrItem");

    this.log(`Found ${listings.length} vehicle listings on page ${page}`);

    listings.each((index, element) => {
      try {
        const $listing = $(element);
        const vehicleData = this.extractVehicleData($, $listing);

        if (vehicleData && this.validateVehicleData(vehicleData)) {
          vehicles.push(vehicleData);
        }
      } catch (error) {
        this.log(`Error extracting vehicle ${index}: ${error.message}`, "warn");
      }
    });

    return vehicles;
  }

  /**
   * Extract vehicle data from listing element
   * Based on actual Oregans HTML structure
   */
  extractVehicleData($, $listing) {
    try {
      // === Data Attributes ===
      const vehicleId = $listing.attr("data-vehicle-id");
      const stockNumber = $listing.attr("data-vehicle-stock");
      const inventoryTypeId = $listing.attr("data-vehicle-inventory-type-id");
      
      // Inventory type: 1 = New, 2 = Used
      const condition = inventoryTypeId === "1" ? "New" : "Used";

      // === Basic Vehicle Info ===
      const $heading = $listing.find(".ouvsrHeading");
      
      const inventoryType = $heading.find(".ouvsrInventoryType").text().trim();
      const year = $heading.find(".ouvsrYear").text().trim();
      const make = $heading.find(".ouvsrMake").text().trim();
      const model = $heading.find(".ouvsrModel").text().trim();
      const trim = $heading.find(".ouvsrTrimAndPackage").text().trim();
      const tagline = $heading.find(".ouvsrTagline").text().trim();

      // === Detail URL ===
      const detailPath = $listing.find(".ouvsrHeadingLink").attr("href");
      const detailUrl = detailPath ? `${this.baseUrl}${detailPath}` : null;

      // === Price ===
      const priceValue = $listing.find(".ouvsrCurrentPrice .currencyValue").text().trim();
      const price = priceValue ? `$${priceValue}` : null;

      // === Description ===
      const description = $listing.find(".ouvsrDescription").text().trim().replace(/More$/, "").trim();

      // === Dealer Location ===
      const dealerName = $listing.find(".ouvsrOwnerLocationLink").text().trim();

      // === VIN (from contact link) ===
      const contactLink = $listing.find(".ouvsrContactLink").attr("href");
      let vin = null;
      if (contactLink) {
        const vinMatch = contactLink.match(/vehicle\.vin=([A-HJ-NPR-Z0-9]{17})/i);
        if (vinMatch) {
          vin = vinMatch[1];
        }
      }

      // === Technical Specifications ===
      const specs = this.extractSpecs($, $listing);

      // === Features ===
      const features = this.extractFeatures($, $listing);

      // === Images ===
      const images = this.extractImages($, $listing);

      // === Certification ===
      const certificationBadge = $listing.find(".ouvsrCertificationBadge");
      const certification = certificationBadge.attr("title") || null;
      const certificationImage = certificationBadge.find(".ouvsrCertificationImage").attr("src") || null;

      // === Build Vehicle Object ===
      const vehicleData = {
        // Identifiers
        vehicleId: vehicleId,
        stockNumber: stockNumber || specs.stockNumber,
        vin: vin,

        // Basic Info
        condition: condition || inventoryType,
        year: year ? parseInt(year) : null,
        make: make,
        model: model,
        trim: trim,
        tagline: tagline,

        // Price
        price: price,

        // Specifications
        mileage: specs.mileage,
        engineCapacity: specs.engine,
        transmission: specs.transmission,
        drive: specs.drivetrain,
        fuelType: specs.fuelType,
        exteriorColor: specs.exteriorColor,

        // Features
        features: features,
        doors: this.extractDoors(features),

        // Certification
        certification: certification,
        certificationImage: certificationImage,

        // Images
        images: images,

        // Description
        description: description || tagline,

        // Dealer Info
        dealerName: dealerName || "O'Regan's",
        dealerLocation: this.mapDealerToLocation(dealerName),

        // Location (O'Regan's is Atlantic Canada based)
        city: this.extractCityFromDealer(dealerName),
        province: "Nova Scotia",
        location: this.extractCityFromDealer(dealerName) + ", Nova Scotia",

        // Source
        sourceUrl: detailUrl,
        sourceSite: this.name,

        // Timestamp
        scrapedAt: new Date().toISOString(),
      };

      return vehicleData;
    } catch (error) {
      this.log(`Error in extractVehicleData: ${error.message}`, "error");
      return null;
    }
  }

  /**
   * Extract technical specifications
   */
  extractSpecs($, $listing) {
    const specs = {
      exteriorColor: null,
      mileage: null,
      engine: null,
      transmission: null,
      drivetrain: null,
      fuelType: null,
      stockNumber: null,
    };

    // Each spec is in a div with class ouvsrSpec and a specific class
    const $specsList = $listing.find(".ouvsrTechSpecs .ouvsrSpec");

    $specsList.each((i, el) => {
      const $spec = $(el);
      const $value = $spec.find(".ouvsrValue");

      // Exterior Color
      if ($spec.hasClass("ouvsrExteriorColor")) {
        specs.exteriorColor = $spec.find(".ouvsrColorName").text().trim();
      }

      // Mileage/Odometer
      if ($spec.hasClass("ouvsrMileage")) {
        const mileageNum = $spec.find(".ouvsrValueNum").text().trim();
        // Remove commas and convert to number
        specs.mileage = mileageNum ? parseInt(mileageNum.replace(/,/g, "")) : null;
      }

      // Engine
      if ($spec.hasClass("ouvsrEngine")) {
        specs.engine = $value.text().trim();
      }

      // Transmission
      if ($spec.hasClass("ouvsrTransmission")) {
        specs.transmission = $value.text().trim();
      }

      // Drivetrain
      if ($spec.hasClass("ouvsrDrivetrain")) {
        specs.drivetrain = $value.text().trim();
      }

      // Fuel Type
      if ($spec.hasClass("ouvsrFuelType")) {
        specs.fuelType = $value.text().trim();
      }

      // Stock Number
      if ($spec.hasClass("ouvsrStockNumber")) {
        // Stock number has extra span, get text without the label
        const stockText = $value.text().trim();
        specs.stockNumber = stockText.replace(/^#/, "").trim();
      }
    });

    return specs;
  }

  /**
   * Extract features list
   */
  extractFeatures($, $listing) {
    const features = [];

    $listing.find(".ouvsrFeaturesList li").each((i, el) => {
      const featureLabel = $(el).find(".ouvsrFeatureLabel").text().trim();
      if (featureLabel) {
        features.push(featureLabel);
      }
    });

    return features;
  }

  /**
   * Extract doors from features
   */
  extractDoors(features) {
    for (const feature of features) {
      const doorMatch = feature.match(/^(\d+)\s*Door$/i);
      if (doorMatch) {
        return parseInt(doorMatch[1]);
      }
    }
    return null;
  }

  /**
   * Extract images from listing
   */
  extractImages($, $listing) {
    const images = [];

    const $img = $listing.find(".ouvsrMainImage img");
    
    if ($img.length > 0) {
      // Get srcset for multiple sizes
      const srcset = $img.attr("srcset");
      
      if (srcset) {
        // Parse srcset and get the largest image (768w)
        const srcsetParts = srcset.split(",").map(s => s.trim());
        
        // Find the largest image
        let largestUrl = null;
        let largestWidth = 0;

        srcsetParts.forEach(part => {
          const match = part.match(/^(\S+)\s+(\d+)w$/);
          if (match) {
            const url = match[1];
            const width = parseInt(match[2]);
            if (width > largestWidth) {
              largestWidth = width;
              largestUrl = url;
            }
          }
        });

        if (largestUrl) {
          images.push(largestUrl);
        }

        // Also store all available sizes for reference
        srcsetParts.forEach(part => {
          const match = part.match(/^(\S+)\s+(\d+)w$/);
          if (match && match[1] !== largestUrl) {
            // Could store these as additional images if needed
          }
        });
      } else {
        // Fallback to src attribute
        const src = $img.attr("src");
        if (src) {
          images.push(src);
        }
      }
    }

    return images;
  }

  /**
   * Map dealer name to city
   */
  extractCityFromDealer(dealerName) {
    if (!dealerName) return "Halifax";

    const lowerDealer = dealerName.toLowerCase();

    if (lowerDealer.includes("dartmouth")) {
      return "Dartmouth";
    } else if (lowerDealer.includes("south shore")) {
      return "Bridgewater";
    } else if (lowerDealer.includes("halifax") || lowerDealer.includes("bmw") || 
               lowerDealer.includes("mercedes") || lowerDealer.includes("lexus")) {
      return "Halifax";
    }

    return "Halifax"; // Default
  }

  /**
   * Map dealer name to full location
   */
  mapDealerToLocation(dealerName) {
    const city = this.extractCityFromDealer(dealerName);
    return `${city}, Nova Scotia`;
  }

  /**
   * Validate vehicle data
   */
  validateVehicleData(data) {
    // Must have at least make and model
    if (!data.make || !data.model) {
      return false;
    }

    // Must have a source URL
    if (!data.sourceUrl) {
      return false;
    }

    return true;
  }

  /**
   * Scrape detail page for additional information
   * Can be called separately if more details are needed
   */
  async scrapeDetailPage(detailUrl) {
    try {
      const html = await this.fetchHTML(detailUrl);
      const $ = cheerio.load(html);

      const detailedData = {};

      // Extract additional images from gallery
      const galleryImages = [];
      $(".gallery img, .photo-gallery img, [class*='gallery'] img").each((i, el) => {
        const srcset = $(el).attr("srcset");
        if (srcset) {
          const parts = srcset.split(",");
          // Get largest image
          parts.forEach(part => {
            const match = part.trim().match(/^(\S+)\s+(\d+)w$/);
            if (match) {
              galleryImages.push({ url: match[1], width: parseInt(match[2]) });
            }
          });
        } else {
          const src = $(el).attr("src");
          if (src && !src.includes("placeholder")) {
            galleryImages.push({ url: src, width: 0 });
          }
        }
      });

      // Sort by width and get URLs
      if (galleryImages.length > 0) {
        galleryImages.sort((a, b) => b.width - a.width);
        detailedData.images = [...new Set(galleryImages.map(img => img.url))];
      }

      // Extract full description
      const fullDescription = $(".vehicle-description, .description, [class*='description']").text().trim();
      if (fullDescription) {
        detailedData.description = fullDescription;
      }

      // Extract any additional specs from detail page
      // This would need to be customized based on actual detail page HTML

      return detailedData;
    } catch (error) {
      this.log(`Error scraping detail page: ${error.message}`, "warn");
      return {};
    }
  }
}

module.exports = OregansScraper;