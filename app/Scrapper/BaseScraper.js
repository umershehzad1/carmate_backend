"use strict";

const axios = require("axios");
const bcrypt = require("bcryptjs");
const slugify = require("slugify");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

/**
 * Base Scraper Class
 * Provides common methods for all scrapers
 */
class BaseScraper {
  constructor(name) {
    this.name = name;
    this.maxRetries = 3;
    this.retryDelay = 2000;
    this.timeout = 30000;
    this.browser = null;
    this.userAgents = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0",
    ];
  }

  /**
   * Log with timestamp and scraper name
   */
  log(message, level = "info") {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${this.name}]`;

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
   * Get random user agent
   */
  getRandomUserAgent() {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  /**
   * Initialize browser instance with advanced anti-detection
   */
  async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: "new", // Use new headless mode (more stealthy)
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--window-size=1920,1080',
          '--disable-blink-features=AutomationControlled', // Hide automation
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
        ],
        ignoreHTTPSErrors: true,
        // Random viewport size to appear more human
        defaultViewport: {
          width: 1920 + Math.floor(Math.random() * 100),
          height: 1080 + Math.floor(Math.random() * 100),
        },
      });
      this.log('Browser initialized with stealth mode', 'success');
    }
    return this.browser;
  }

  /**
   * Close browser instance
   */
  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.log('Browser closed', 'success');
    }
  }

  /**
   * Fetch HTML with Puppeteer (handles JavaScript-rendered content and bypasses blocks)
   * Enhanced with advanced anti-detection techniques
   */
  async fetchHTML(url, retries = 0) {
    let page = null;
    try {
      this.log(`Fetching: ${url}`);

      const browser = await this.initBrowser();
      page = await browser.newPage();

      // Random viewport to appear more human-like
      const viewportWidth = 1920 + Math.floor(Math.random() * 100);
      const viewportHeight = 1080 + Math.floor(Math.random() * 100);
      await page.setViewport({ width: viewportWidth, height: viewportHeight });
      
      // Set random user agent
      await page.setUserAgent(this.getRandomUserAgent());

      // Set extra headers to appear more human-like
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9,en-CA;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-User': '?1',
        'Sec-Fetch-Dest': 'document',
        'Upgrade-Insecure-Requests': '1',
      });

      // Override navigator properties to hide automation
      await page.evaluateOnNewDocument(() => {
        // Override the navigator.webdriver property
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });

        // Override the permissions API
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );

        // Mock plugins and languages
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });

        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });

        // Mock chrome runtime
        window.chrome = {
          runtime: {},
        };
      });

      // Navigate with timeout and wait for network to be idle
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.timeout,
      });

      // Check and handle Cloudflare protection
      await this.handleCloudflare(page);

      // Simulate human behavior: random mouse movements
      await page.mouse.move(
        Math.random() * viewportWidth,
        Math.random() * viewportHeight
      );
      await this.sleep(100 + Math.random() * 200);

      // Random scroll to simulate reading
      const scrollAmount = Math.floor(Math.random() * 500) + 200;
      await page.evaluate((scroll) => {
        window.scrollBy(0, scroll);
      }, scrollAmount);
      await this.sleep(300 + Math.random() * 500);

      // Scroll back up a bit
      await page.evaluate(() => {
        window.scrollBy(0, -100);
      });
      await this.sleep(200 + Math.random() * 300);

      // Random delay to appear more human-like (1-2 seconds)
      await this.sleep(1000 + Math.random() * 1000);

      // Get the rendered HTML content
      const html = await page.content();

      await page.close();
      return html;
    } catch (error) {
      if (page) {
        await page.close().catch(() => {});
      }

      if (retries < this.maxRetries) {
        this.log(
          `Retry ${retries + 1}/${this.maxRetries} for: ${url}`,
          "warn"
        );
        // Exponential backoff with randomization
        const backoffDelay = this.retryDelay * Math.pow(2, retries) + Math.random() * 1000;
        await this.sleep(backoffDelay);
        return this.fetchHTML(url, retries + 1);
      }

      this.log(`Failed to fetch ${url}: ${error.message}`, "error");
      throw error;
    }
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check and handle Cloudflare protection
   */
  async handleCloudflare(page) {
    try {
      // Check if we're on a Cloudflare challenge page
      const isCloudflare = await page.evaluate(() => {
        const bodyText = document.body.textContent || '';
        return bodyText.includes('Checking your browser') || 
               bodyText.includes('Just a moment') ||
               bodyText.includes('DDoS protection by Cloudflare') ||
               document.title.includes('Just a moment');
      });

      if (isCloudflare) {
        this.log('Detected Cloudflare challenge, waiting...', 'warn');
        // Wait for Cloudflare to complete (usually takes 5-10 seconds)
        await this.sleep(10000);
        
        // Wait for navigation after challenge
        await page.waitForNavigation({ 
          waitUntil: 'networkidle2', 
          timeout: 30000 
        }).catch(() => {
          // Navigation might not happen, that's okay
        });
        
        this.log('Cloudflare challenge passed', 'success');
        return true;
      }
      
      return false;
    } catch (error) {
      this.log(`Error handling Cloudflare: ${error.message}`, 'warn');
      return false;
    }
  }

  /**
   * Generate unique username from dealer name
   */
  generateUsername(dealerName) {
    const base = slugify(dealerName, { lower: true, strict: true });
    const random = Math.floor(Math.random() * 10000);
    return `${base}-${random}`;
  }

  /**
   * Generate slug for vehicle
   */
  generateVehicleSlug(vehicleData) {
    const parts = [
      vehicleData.year,
      vehicleData.make,
      vehicleData.model,
      vehicleData.city,
    ]
      .filter(Boolean)
      .join("-");

    const baseSlug = slugify(parts, { lower: true, strict: true });
    const random = Math.floor(Math.random() * 100000);
    return `${baseSlug}-${random}`;
  }

  /**
   * Generate random password
   */
  generatePassword(length = 12) {
    const charset =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }

  /**
   * Hash password
   */
  async hashPassword(password) {
    return await bcrypt.hash(password, 10);
  }

  /**
   * Clean price string and convert to number
   */
  cleanPrice(priceStr) {
    if (!priceStr) return null;

    // Take only the first line if multi-line text
    const firstLine = priceStr.split('\n')[0].trim();
    
    // Remove currency symbols, commas, spaces, and "CAD", "$" etc
    const cleaned = firstLine
      .replace(/[^\d]/g, "");

    return cleaned || null;
  }

  /**
   * Clean and normalize text
   */
  cleanText(text) {
    if (!text) return null;
    return text
      .trim()
      .replace(/\s+/g, " ")
      .replace(/\n+/g, " ");
  }

  /**
   * Clean dealer name by removing unwanted text
   */
  cleanDealerName(name) {
    if (!name) return null;
    
    let cleaned = name;
    
    // First, split by bullet points and take only the first part (actual name)
    if (cleaned.includes('•')) {
      cleaned = cleaned.split('•')[0];
    }
    
    // Split by newlines and take first line
    if (cleaned.includes('\n')) {
      cleaned = cleaned.split('\n')[0];
    }
    
    // Remove common unwanted phrases (case insensitive)
    const unwantedPhrases = [
      /visit\s+website/gi,
      /see\s+website/gi,
      /see\s+reviews?/gi,
      /see\s+more/gi,
      /view\s+website/gi,
      /view\s+more/gi,
      /read\s+more/gi,
      /learn\s+more/gi,
      /click\s+here/gi,
      /more\s+info/gi,
      /contact\s+us/gi,
      /call\s+now/gi,
      /get\s+directions/gi,
      /view\s+details/gi,
      /show\s+number/gi,
    ];
    
    for (const phrase of unwantedPhrases) {
      cleaned = cleaned.replace(phrase, '');
    }
    
    // Remove any remaining pipes or separators
    cleaned = cleaned.replace(/[|•→]/g, '');
    
    // Clean up extra whitespace and trim
    cleaned = cleaned
      .replace(/\s+/g, ' ')
      .replace(/\s*[,;]\s*$/, '') // Remove trailing commas/semicolons
      .trim();
    
    return cleaned || null;
  }

  /**
   * Extract number from string
   */
  extractNumber(str) {
    if (!str) return null;
    const match = str.match(/\d+/);
    return match ? parseInt(match[0]) : null;
  }

  /**
   * Extract engine capacity in CC from text
   * Converts liters to CC and extracts numeric values
   * Only returns values with clear engine-related context
   */
  extractEngineCC(text) {
    if (!text) return null;
    
    // Clean the text
    const cleanedText = text.trim();
    const lowerText = cleanedText.toLowerCase();
    
    // Only process if text contains engine-related keywords
    const hasEngineContext = lowerText.includes('engine') || 
                            lowerText.includes('cc') || 
                            lowerText.includes('litre') || 
                            lowerText.includes('liter') || 
                            lowerText.includes('cylinder') || 
                            lowerText.includes('displacement') ||
                            /\d+\.\d+\s*l\b/i.test(cleanedText);
    
    // Match patterns like "2.0L", "2.0 L", "2.0 Litre", "2.0 liter" (must have L/litre/liter)
    const literMatch = cleanedText.match(/([0-9]+\.[0-9]+)\s*[lL](?:itre|iter|\b)/i);
    if (literMatch) {
      const liters = parseFloat(literMatch[1]);
      // Only accept reasonable engine sizes (0.5L to 8.0L)
      if (liters >= 0.5 && liters <= 8.0) {
        return Math.round(liters * 1000).toString(); // Convert to CC
      }
    }
    
    // Match patterns like "1998 cc", "1998cc", "1998 CC" (must have 'cc' suffix)
    const ccMatch = cleanedText.match(/([0-9]{3,4})\s*cc\b/i);
    if (ccMatch) {
      const cc = parseInt(ccMatch[1]);
      // Only accept reasonable CC values (500-8000)
      if (cc >= 500 && cc <= 8000) {
        return ccMatch[1];
      }
    }
    
    // Match cylinder count only if explicitly mentioned (e.g., "4-cylinder", "V6", "V8")
    const cylinderMatch = cleanedText.match(/([vV]?-?[3-8])[\s-]*(cylinder|cyl)\b/i);
    if (cylinderMatch) {
      const cylinders = cylinderMatch[1].replace(/[vV-]/g, '');
      // Only accept 3-8 cylinders
      const cylNum = parseInt(cylinders);
      if (cylNum >= 3 && cylNum <= 8) {
        return `${cylinders}-cylinder`;
      }
    }
    
    // Only match standalone numbers if there's engine context
    if (hasEngineContext) {
      // Match patterns like "Engine: 2000" or "Displacement: 1998"
      const engineNumMatch = cleanedText.match(/(?:engine|displacement|capacity)[:\s]+([0-9]{3,4})\b/i);
      if (engineNumMatch) {
        const cc = parseInt(engineNumMatch[1]);
        if (cc >= 500 && cc <= 8000) {
          return engineNumMatch[1];
        }
      }
    }
    
    return null; // Return null if we can't extract a valid engine capacity
  }

  /**
   * Validate required fields
   */
  validateVehicleData(vehicleData, requiredFields = []) {
    const defaultRequired = ["make", "model", "price", "year"];
    const required = requiredFields.length > 0 ? requiredFields : defaultRequired;

    for (const field of required) {
      if (!vehicleData[field]) {
        this.log(
          `Missing required field: ${field} in vehicle data`,
          "warn"
        );
        return false;
      }
    }

    return true;
  }

  /**
   * Normalize vehicle data
   */
  normalizeVehicleData(rawData) {
    return {
      // Basic info
      make: this.cleanText(rawData.make),
      model: this.cleanText(rawData.model),
      year: this.cleanText(rawData.year),
      price: this.cleanPrice(rawData.price),

      // Location
      city: this.cleanText(rawData.city),
      province: this.cleanText(rawData.province),
      location: this.cleanText(rawData.location),

      // Details
      mileage: this.cleanText(rawData.mileage),
      transmission: this.cleanText(rawData.transmission),
      fuelType: this.cleanText(rawData.fuelType),
      bodyType: this.cleanText(rawData.bodyType),
      color: this.cleanText(rawData.color),
      exteriorColor: this.cleanText(rawData.exteriorColor || rawData.color),
      engineCapacity: this.cleanText(rawData.engineCapacity),
      condition: rawData.condition || "used",
      registerIn: this.cleanText(rawData.registerIn || rawData.registeredIn),
      assemblyIn: this.cleanText(rawData.assemblyIn || rawData.assembly),
      doors: rawData.doors ? parseInt(rawData.doors) : null,
      drive: this.cleanText(rawData.drive),
      fuelConsumption: this.cleanText(rawData.fuelConsumption),

      // Description
      description: this.cleanText(rawData.description),
      modelCategory: this.cleanText(rawData.modelCategory),

      // Images
      images: Array.isArray(rawData.images)
        ? rawData.images.filter((img) => img && img.trim())
        : [],

      // JSON Fields for structured data
      interiorDetails: rawData.interiorDetails || null,
      exteriorDetails: rawData.exteriorDetails || null,
      safetyFeatures: rawData.safetyFeatures || null,
      specifications: rawData.specifications || null,

      // Dealer info - ensure proper length and clean unwanted text
      dealerName: rawData.dealerName ? this.cleanDealerName(rawData.dealerName).substring(0, 100) : null,
      dealerPhone: rawData.dealerPhone ? this.cleanText(rawData.dealerPhone).substring(0, 50) : null,
      dealerEmail: this.cleanText(rawData.dealerEmail),
      dealerLocation: rawData.dealerLocation ? this.cleanText(rawData.dealerLocation).substring(0, 200) : null,

      // Source tracking
      sourceUrl: rawData.sourceUrl,
      sourceSite: this.name,
      scrapedAt: new Date(),
    };
  }

  /**
   * Abstract method to be implemented by child classes
   */
  async scrape() {
    throw new Error("scrape() method must be implemented by child class");
  }

  /**
   * Get scraper stats
   */
  getStats() {
    return {
      name: this.name,
      scraped: this.stats?.scraped || 0,
      saved: this.stats?.saved || 0,
      failed: this.stats?.failed || 0,
    };
  }

  /**
   * Initialize stats
   */
  initStats() {
    this.stats = {
      scraped: 0,
      saved: 0,
      failed: 0,
      dealers: 0,
      vehicles: 0,
      advertisements: 0,
    };
  }

  /**
   * Update stats
   */
  updateStats(key, increment = 1) {
    if (this.stats && typeof this.stats[key] !== "undefined") {
      this.stats[key] += increment;
    }
  }
}

module.exports = BaseScraper;
