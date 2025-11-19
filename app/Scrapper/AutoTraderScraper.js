"use strict";

const BaseScraper = require("./BaseScraper");
const cheerio = require("cheerio");

/**
 * AutoTrader.ca Scraper
 * Scrapes vehicle listings from AutoTrader Canada
 */
class AutoTraderScraper extends BaseScraper {
  constructor() {
    super("AutoTrader");
    this.baseUrl = "https://www.autotrader.ca";
    this.searchUrl = `${this.baseUrl}/cars/`;
    this.maxPages = 10; // Number of pages to scrape per run
    this.maxVehicles = 100; // Maximum vehicles to collect
  }

  /**
   * Main scrape method
   */
  async scrape() {
    this.initStats();
    this.log("Starting PakWheels scraper...");

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
          await this.sleep(2000 + Math.random() * 2000);
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

      // Close browser after scraping
      await this.closeBrowser();

      return limitedVehicles;
    } catch (error) {
      this.log(`Scraper failed: ${error.message}`, "error");
      // Ensure browser is closed even on error
      await this.closeBrowser();
      throw error;
    }
  }

  /**
   * Scrape a single page
   */
  async scrapePage(page) {
    const url = page === 1 ? this.searchUrl : `${this.searchUrl}?rcp=${page * 15}&rcs=${(page - 1) * 15}`;
    const html = await this.fetchHTML(url);
    const $ = cheerio.load(html);

    const vehicles = [];
    const listings = $(".result-item, [data-testid='listing-card'], .listing-container, article.listing");

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
      const title = listingElement
        .find("h2, .title, [class*='title'], a[class*='title']")
        .first()
        .text()
        .trim();
      
      const detailUrl = listingElement
        .find("a[href*='/a/']")
        .first()
        .attr("href");
      
      let price = listingElement
        .find("[class*='price'], .price-amount, [data-testid*='price']")
        .first()
        .text()
        .trim();
      
      // Extract just the price number from the first line
      if (price) {
        const priceMatch = price.match(/\$?([\d,]+)/);
        price = priceMatch ? priceMatch[0] : price;
      }
      
      let location = listingElement
        .find("[class*='location'], .dealer-address, [class*='dealer-name'], [class*='dealer'] span")
        .first()
        .text()
        .trim();
      
      // If location is too long (includes dealer name), try to extract just the location
      if (location && location.length > 100) {
        const locationMatch = location.match(/([A-Za-z\s]+,\s*[A-Za-z\s]+)/);
        if (locationMatch) {
          location = locationMatch[1].trim();
        }
      }
      
      // Extract image - try multiple attributes and skip ghost/placeholder images
      let image = null;
      const imgElements = listingElement.find("img");
      imgElements.each((i, elem) => {
        // Try multiple attributes for better quality images
        const imgSrc = $(elem).attr("data-original") || 
                       $(elem).attr("data-src-large") ||
                       $(elem).attr("data-src") || 
                       $(elem).attr("data-lazy") ||
                       $(elem).attr("src");
        
        // Only use valid image URLs (not ghost SVGs or placeholders)
        if (imgSrc && 
            !imgSrc.includes("ghost-image") && 
            !imgSrc.endsWith(".svg") &&
            !imgSrc.includes("placeholder") &&
            !imgSrc.includes("thumbnail") &&
            (imgSrc.includes(".jpg") || imgSrc.includes(".jpeg") || imgSrc.includes(".png") || imgSrc.includes(".webp"))) {
          
           // Convert to high-res URL if possible
           let highResImg = imgSrc;
           highResImg = highResImg.replace(/w=\d+/, "/w=1920");
           highResImg = highResImg.replace(/h=\d+/, "/h=1440");
           highResImg = highResImg.replace(/small|thumb|medium/gi, "large");
          
           image = highResImg;
           return false; // Break the loop
        }
      });

      // Extract year, make, model from title
      const titleParts = this.parseTitleParts(title);

      // Get additional details from the listing
      const details = {};
      const detailTexts = [];
      listingElement.find("li, .specs-item, [class*='spec'], [class*='attribute']").each((i, elem) => {
        const text = $(elem).text().trim();
        if (text) {
          detailTexts.push(text);
          this.parseDetailText(text, details);
        }
      });
      
      // Debug logging for first vehicle
      if (detailTexts.length > 0 && !this._loggedDetails) {
        this.log(`Sample listing details found: ${detailTexts.slice(0, 5).join(", ")}`);
        this._loggedDetails = true;
      }

      // Get dealer info - extract only the actual dealer name
      let dealerName = listingElement
        .find("[class*='dealer-name'], .seller-name, [data-testid*='dealer']")
        .first()
        .text()
        .trim();
      
      // If dealer name is too long or empty, try to extract from location
      if (!dealerName || dealerName.length > 100) {
        // Try to extract from various possible locations
        dealerName = listingElement.find(".dealer-info").first().text().trim();
      }
      
      // Fallback to generic name
      if (!dealerName || dealerName.length > 100) {
        dealerName = "AutoTrader Dealer";
      }
      
      // Clean dealer name - remove extra text
      dealerName = dealerName.split('\n')[0].split('|')[0].substring(0, 100).trim();

      const vehicleData = {
        // Basic info
        make: titleParts.make,
        model: titleParts.model,
        year: titleParts.year,
        price: price,

        // Location
        city: this.extractCity(location),
        province: this.extractProvince(location),
        location: location,

        // Details from listing
        mileage: details.mileage,
        transmission: details.transmission,
        fuelType: details.fuelType,
        bodyType: details.bodyType,
        engineCapacity: details.engineCapacity,
        color: details.color,
        exteriorColor: details.exteriorColor || details.color,
        registerIn: details.registerIn || details.registeredIn,
        registeredIn: details.registeredIn || details.registerIn,
        assemblyIn: details.assemblyIn,
        doors: details.doors,
        drive: details.drive,
        fuelConsumption: details.fuelConsumption,
        modelCategory: details.modelCategory,

        // Image
        images: image ? [image] : [],

        // Description
        description: `${title} - ${location}`,

        // Dealer info
        dealerName: dealerName,
        dealerLocation: location,

        // Source
        sourceUrl: detailUrl ? `${this.baseUrl}${detailUrl}` : null,
        sourceSite: this.name,
      };

      // If we have a detail URL, scrape detailed page for more info
      if (detailUrl) {
        try {
          const detailedData = await this.scrapeDetailPage(detailUrl);
          
          // Debug: Log what we got from detail page
          this.log(`Detail page data: mileage=${detailedData.mileage}, color=${detailedData.color}, doors=${detailedData.doors}, drive=${detailedData.drive}`);
          
          Object.assign(vehicleData, detailedData);

          // Add delay to avoid rate limiting
          await this.sleep(1000 + Math.random() * 1000);
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
    const url = detailPath.startsWith("http") ? detailPath : `${this.baseUrl}${detailPath}`;
    const html = await this.fetchHTML(url);
    const $ = cheerio.load(html);

    const detailedData = {};

    // Extract all images - try multiple methods
    const images = [];
    const imageSet = new Set(); // Use Set to avoid duplicates

    // Method 1: Look for high-res images in data attributes and srcset
    $("img[class*='image'], .photo-gallery img, [class*='gallery'] img, [class*='photo'] img, picture img").each((i, elem) => {
      const $elem = $(elem);
      
      // Try different attributes for high quality images
      const possibleSources = [
        $elem.attr("data-original"),
        $elem.attr("data-src-large"),
        $elem.attr("data-zoom-image"),
        $elem.attr("data-full"),
        $elem.attr("data-highres"),
        $elem.attr("data-src"),
        $elem.attr("data-lazy"),
        $elem.attr("src")
      ];

      // Check srcset for highest quality image
      const srcset = $elem.attr("srcset");
      if (srcset) {
        // Parse srcset and get the largest image
        const srcsetParts = srcset.split(",");
        for (const part of srcsetParts) {
          const urlMatch = part.trim().match(/^(\S+)/);
          if (urlMatch) {
            possibleSources.unshift(urlMatch[1]); // Add to beginning (higher priority)
          }
        }
      }

      // Find the first valid high-quality image URL
      for (const imgSrc of possibleSources) {
        if (imgSrc && 
            !imgSrc.includes("placeholder") && 
            !imgSrc.includes("logo") &&
            !imgSrc.includes("ghost-image") &&
            !imgSrc.includes("thumbnail") && // Skip thumbnails
            !imgSrc.endsWith(".svg") &&
            (imgSrc.includes(".jpg") || imgSrc.includes(".jpeg") || imgSrc.includes(".png") || imgSrc.includes(".webp"))) {
          
          // Convert small images to large by replacing size parameters
          let highResUrl = imgSrc;
          // Replace common size parameters with larger ones
          highResUrl = highResUrl.replace(/\/w=\d+/, "/w=1920");
          highResUrl = highResUrl.replace(/\/h=\d+/, "/h=1440");
          highResUrl = highResUrl.replace(/small|thumb|medium/gi, "large");
          highResUrl = highResUrl.replace(/_s\./i, "_l.");
          highResUrl = highResUrl.replace(/_\d+x\d+\./i, "_1920x1440.");
          
          imageSet.add(highResUrl);
          break; // Found valid image, move to next element
        }
      }
    });

    // Method 2: Look for image URLs in JSON-LD or script tags
    $("script[type='application/ld+json']").each((i, elem) => {
      try {
        const jsonData = JSON.parse($(elem).html());
        if (jsonData.image) {
          if (Array.isArray(jsonData.image)) {
            jsonData.image.forEach(img => imageSet.add(img));
          } else if (typeof jsonData.image === "string") {
            imageSet.add(jsonData.image);
          }
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    });

    // Convert Set to Array
    images.push(...Array.from(imageSet));

    if (images.length > 0) {
      detailedData.images = images;
      this.log(`Found ${images.length} high-quality images`);
    }

    // Extract full description
    const description = $("[class*='description'], .comments, [class*='comment']").first().text().trim();
    if (description) {
      detailedData.description = description;
    }

    // Extract specifications and organize them
    const specs = {};
    const interiorDetails = {};
    const exteriorDetails = {};
    const safetyFeatures = {};
    const specifications = {};

    // Extract ALL text content and look for vehicle specifications
    const bodyText = $('body').text();
    
    // Parse the entire page text for specifications
    const textLines = bodyText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    for (const line of textLines) {
      // Try to extract specs from any line
      this.parseDetailText(line, specs);
      
      // Look for specific patterns
      if (line.includes('km') && !specs.mileage) {
        const mileageMatch = line.match(/([\d,]+)\s*km/i);
        if (mileageMatch) {
          specs.mileage = mileageMatch[1].replace(/,/g, '');
        }
      }
      
      // Categorize features into appropriate JSON fields from text lines
      const lowerLine = line.toLowerCase();
      
      // Interior features
      if ((lowerLine.includes('seat') || lowerLine.includes('leather') || 
           lowerLine.includes('cloth') || lowerLine.includes('heated') || 
           lowerLine.includes('ventilated') || lowerLine.includes('sunroof') ||
           lowerLine.includes('moonroof') || lowerLine.includes('climate') ||
           lowerLine.includes('air conditioning') || lowerLine.includes('navigation')) && 
           line.length > 3 && line.length < 100) {
        interiorDetails[line] = true;
      }
      
      // Exterior features
      if ((lowerLine.includes('wheel') || lowerLine.includes('alloy') || 
           lowerLine.includes('paint') || lowerLine.includes('roof rack') ||
           lowerLine.includes('running boards') || lowerLine.includes('tow') ||
           lowerLine.includes('spoiler') || lowerLine.includes('fog light')) && 
           line.length > 3 && line.length < 100) {
        exteriorDetails[line] = true;
      }
      
      // Safety features
      if ((lowerLine.includes('airbag') || lowerLine.includes('abs') || 
           lowerLine.includes('brake assist') || lowerLine.includes('stability') ||
           lowerLine.includes('traction') || lowerLine.includes('blind spot') ||
           lowerLine.includes('collision') || lowerLine.includes('lane') ||
           lowerLine.includes('backup camera') || lowerLine.includes('rear camera')) && 
           line.length > 3 && line.length < 100) {
        safetyFeatures[line] = true;
      }
    }

    // Also try structured selectors
    const specSelectors = [
      "li",
      "span",
      "div[class*='spec']",
      "div[class*='attribute']",
      "div[class*='feature']",
      "p",
      "dt",
      "dd",
      "table tr",
      "[class*='row'] > div",
    ];
    
    const allExtractedTexts = [];
    $(specSelectors.join(", ")).each((i, elem) => {
      const text = $(elem).text().trim();
      
      if (text.length > 0 && text.length < 200) { // Ignore very long text blocks
        allExtractedTexts.push(text);
        
        // Try to split by colon for key-value pairs
        const parts = text.split(":");
        if (parts.length === 2) {
          const label = parts[0].trim();
          const value = parts[1].trim();
          this.mapSpecification(label, value, specs);
          
          // Categorize features into appropriate JSON fields
          const lowerLabel = label.toLowerCase();
          if (lowerLabel.includes("interior") || lowerLabel.includes("seat") || lowerLabel.includes("upholstery")) {
            interiorDetails[label] = value;
          } else if (lowerLabel.includes("exterior") || lowerLabel.includes("wheel") || lowerLabel.includes("paint")) {
            exteriorDetails[label] = value;
          } else if (lowerLabel.includes("safety") || lowerLabel.includes("airbag") || lowerLabel.includes("brake")) {
            safetyFeatures[label] = value;
          } else {
            specifications[label] = value;
          }
        } else if (text.length > 0) {
          // If no colon, treat as a feature flag (boolean)
          // Also try to parse the text for details
          this.parseDetailText(text, specs);
          
          const lowerText = text.toLowerCase();
          if (lowerText.includes("interior") || lowerText.includes("seat") || lowerText.includes("leather") || lowerText.includes("climate")) {
            interiorDetails[text] = true;
          } else if (lowerText.includes("exterior") || lowerText.includes("wheel") || lowerText.includes("sunroof") || lowerText.includes("roof")) {
            exteriorDetails[text] = true;
          } else if (lowerText.includes("safety") || lowerText.includes("airbag") || lowerText.includes("abs") || lowerText.includes("stability")) {
            safetyFeatures[text] = true;
          } else {
            specifications[text] = true;
          }
        }
      }
    });
    
    // Debug: Log first few extracted texts
    if (allExtractedTexts.length > 0 && !this._loggedSpecTexts) {
      this.log(`Sample spec texts from detail page: ${allExtractedTexts.slice(0, 10).join(" | ")}`);
      this._loggedSpecTexts = true;
    }

    // Assign main specs
    Object.assign(detailedData, specs);
    
    // Debug logging
    this.log(`Extracted specs from detail page: ${JSON.stringify(specs)}`);
    
    // Assign JSON fields if they have content
    if (Object.keys(interiorDetails).length > 0) {
      detailedData.interiorDetails = interiorDetails;
      this.log(`Interior details: ${Object.keys(interiorDetails).length} items`);
    }
    if (Object.keys(exteriorDetails).length > 0) {
      detailedData.exteriorDetails = exteriorDetails;
      this.log(`Exterior details: ${Object.keys(exteriorDetails).length} items`);
    }
    if (Object.keys(safetyFeatures).length > 0) {
      detailedData.safetyFeatures = safetyFeatures;
      this.log(`Safety features: ${Object.keys(safetyFeatures).length} items`);
    }
    if (Object.keys(specifications).length > 0) {
      detailedData.specifications = specifications;
      this.log(`Specifications: ${Object.keys(specifications).length} items`);
    }

    // Extract dealer contact info
    const dealerPhone = $("[class*='phone'], .dealer-phone, [href^='tel:']").first().text().trim();
    if (dealerPhone) {
      detailedData.dealerPhone = dealerPhone;
    }

    const dealerName = $(".dealer-name, [class*='dealer-name']").first().text().trim();
    if (dealerName) {
      detailedData.dealerName = dealerName;
    }

    // Extract dealer profile image/logo
    const dealerImage = $(".dealer-logo img, [class*='dealer-logo'] img, [class*='dealer-image'] img, .seller-image img").first().attr("src") || 
                        $(".dealer-logo img, [class*='dealer-logo'] img").first().attr("data-src");
    if (dealerImage && !dealerImage.includes("placeholder")) {
      detailedData.dealerImage = dealerImage;
    }

    return detailedData;
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

    // Common car makes in Canada
    const makes = [
      "Toyota",
      "Honda",
      "Ford",
      "Chevrolet",
      "Nissan",
      "Mazda",
      "BMW",
      "Mercedes-Benz",
      "Mercedes",
      "Audi",
      "Volkswagen",
      "Hyundai",
      "KIA",
      "Subaru",
      "Jeep",
      "RAM",
      "Dodge",
      "Chrysler",
      "GMC",
      "Buick",
      "Cadillac",
      "Lexus",
      "Acura",
      "Infiniti",
      "Volvo",
      "Land Rover",
      "Jaguar",
      "Porsche",
      "Tesla",
      "Mitsubishi",
    ];

    for (const make of makes) {
      if (title.toLowerCase().includes(make.toLowerCase())) {
        parts.make = make;
        break;
      }
    }

    // Extract model (text after make and before year or special chars)
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
        parts.model = model || "Unknown";
      }
    }

    return parts;
  }

  /**
   * Parse detail text and extract info
   */
  parseDetailText(text, details) {
    const lowerText = text.toLowerCase();

    if (lowerText.includes("km") || lowerText.includes("mileage")) {
      // Extract numeric mileage value
      const mileageMatch = text.match(/([\d,]+)\s*km/i);
      if (mileageMatch) {
        details.mileage = mileageMatch[1].replace(/,/g, ""); // Remove commas
      } else {
        details.mileage = text;
      }
    } else if (
      lowerText.includes("automatic") ||
      lowerText.includes("manual") ||
      lowerText.includes("transmission")
    ) {
      if (lowerText.includes("automatic")) details.transmission = "Automatic";
      else if (lowerText.includes("manual")) details.transmission = "Manual";
      else if (lowerText.includes("cvt")) details.transmission = "CVT";
    } else if (
      lowerText.includes("petrol") ||
      lowerText.includes("gasoline") ||
      lowerText.includes("gas") ||
      lowerText.includes("diesel") ||
      lowerText.includes("cng") ||
      lowerText.includes("hybrid") ||
      lowerText.includes("electric") ||
      lowerText.includes("fuel")
    ) {
      if (lowerText.includes("petrol") || lowerText.includes("gasoline") || lowerText.includes("gas")) details.fuelType = "Petrol";
      if (lowerText.includes("diesel")) details.fuelType = "Diesel";
      if (lowerText.includes("cng")) details.fuelType = "CNG";
      if (lowerText.includes("hybrid")) details.fuelType = "Hybrid";
      if (lowerText.includes("electric") || lowerText.includes("ev")) details.fuelType = "Electric";
    } else if (lowerText.includes("cc") || lowerText.includes("cylinder") || lowerText.includes("litre") || lowerText.includes("liter") || lowerText.includes("engine")) {
      const engineCC = this.extractEngineCC(text);
      if (engineCC) details.engineCapacity = engineCC;
    } else if (lowerText.includes("door")) {
      const doorsMatch = text.match(/(\d+)/i);
      if (doorsMatch) {
        details.doors = parseInt(doorsMatch[1]);
      }
    } else if (lowerText.includes("awd") || lowerText.includes("fwd") || lowerText.includes("rwd") || lowerText.includes("4wd") || lowerText.includes("4x4") || lowerText.includes("drivetrain")) {
      if (lowerText.includes("awd") || lowerText.includes("all-wheel")) details.drive = "AWD";
      else if (lowerText.includes("fwd") || lowerText.includes("front-wheel")) details.drive = "FWD";
      else if (lowerText.includes("rwd") || lowerText.includes("rear-wheel")) details.drive = "RWD";
      else if (lowerText.includes("4wd") || lowerText.includes("4x4") || lowerText.includes("four-wheel")) details.drive = "4WD";
    } else if (lowerText.includes("color") || lowerText.includes("colour")) {
      // Extract color value after "color:" or "colour:"
      const colorMatch = text.match(/colou?r[:\s]+(.+)/i);
      if (colorMatch) {
        details.color = colorMatch[1].trim();
        details.exteriorColor = colorMatch[1].trim();
      } else {
        // If no colon, just extract the color text
        details.color = text.replace(/colou?r/gi, '').trim();
      }
    } else if (lowerText.includes("registered") || lowerText.includes("registration")) {
      details.registeredIn = text.replace(/registered?\s*(in)?[:\s]*/gi, '').trim();
      details.registerIn = details.registeredIn;
    } else if (lowerText.includes("assembly") || lowerText.includes("assembled")) {
      details.assemblyIn = text.replace(/assembled?\s*(in)?[:\s]*/gi, '').trim();
    } else if (lowerText.includes("body") || lowerText.includes("sedan") || lowerText.includes("suv") || 
               lowerText.includes("truck") || lowerText.includes("coupe") || lowerText.includes("hatchback") ||
               lowerText.includes("wagon") || lowerText.includes("van") || lowerText.includes("convertible")) {
      if (lowerText.includes("sedan")) details.bodyType = "Sedan";
      else if (lowerText.includes("suv")) details.bodyType = "SUV";
      else if (lowerText.includes("truck") || lowerText.includes("pickup")) details.bodyType = "Truck";
      else if (lowerText.includes("coupe")) details.bodyType = "Coupe";
      else if (lowerText.includes("hatchback")) details.bodyType = "Hatchback";
      else if (lowerText.includes("wagon")) details.bodyType = "Wagon";
      else if (lowerText.includes("van") || lowerText.includes("minivan")) details.bodyType = "Van";
      else if (lowerText.includes("convertible")) details.bodyType = "Convertible";
      else if (text.match(/body/i)) {
        const bodyMatch = text.match(/body[:\s]+(.+)/i);
        if (bodyMatch) details.bodyType = bodyMatch[1].trim();
      }
    } else if (lowerText.includes("mpg") || lowerText.includes("l/100") || lowerText.includes("fuel economy") || lowerText.includes("fuel consumption")) {
      details.fuelConsumption = text;
    } else if (lowerText.includes("vin") && text.length < 30) {
      details.vin = text.replace(/vin[:\s]*/i, '').trim();
    } else if (lowerText.includes("stock") && text.length < 30) {
      details.stockNumber = text.replace(/stock[:\s]*/i, '').trim();
    }
  }

  /**
   * Map specification label to field
   */
  mapSpecification(label, value, specs) {
    const lowerLabel = label.toLowerCase();

    const fieldMap = {
      mileage: ["mileage", "km", "kilometers", "odometer"],
      transmission: ["transmission"],
      fuelType: ["fuel", "fuel type", "gas", "gasoline"],
      bodyType: ["body type", "body", "body style"],
      color: ["color", "colour", "exterior color", "exterior colour", "paint"],
      exteriorColor: ["exterior color", "exterior colour", "paint color"],
      engineCapacity: ["engine", "engine capacity", "engine size", "cc", "displacement", "litre", "liter", "cylinder"],
      registeredIn: ["registered", "registered in", "registration"],
      registerIn: ["registered", "registered in", "registration"],
      assemblyIn: ["assembly", "assembled in", "assembled"],
      doors: ["doors", "door"],
      condition: ["condition"],
      drive: ["drive", "drivetrain", "wheel drive", "awd", "fwd", "rwd", "4wd"],
      fuelConsumption: ["fuel consumption", "mpg", "l/100km", "fuel economy"],
      modelCategory: ["category", "type", "class"],
      year: ["year", "model year"],
    };

    for (const [field, keywords] of Object.entries(fieldMap)) {
      if (keywords.some((keyword) => lowerLabel.includes(keyword))) {
        // Special handling for mileage to extract numeric value
        if (field === "mileage") {
          const mileageMatch = value.match(/([\d,]+)/i);
          if (mileageMatch) {
            specs[field] = mileageMatch[1].replace(/,/g, ""); // Remove commas
          } else {
            specs[field] = value;
          }
        }
        // Special handling for doors to extract numeric value
        else if (field === "doors") {
          const doorsMatch = value.match(/(\d+)/i);
          if (doorsMatch) {
            specs[field] = doorsMatch[1];
          } else {
            specs[field] = value;
          }
        }
        // Special handling for engine capacity
        else if (field === "engineCapacity") {
          const engineCC = this.extractEngineCC(value);
          if (engineCC) {
            specs[field] = engineCC;
          }
        }
        // For all other fields, save the value as-is
        else {
          specs[field] = value;
        }
        break;
      }
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

module.exports = AutoTraderScraper;
