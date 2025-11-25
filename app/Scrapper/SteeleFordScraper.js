"use strict";

const BaseScraper = require("./BaseScraper");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

/**
 * SteeleFord Scraper
 * Scrapes vehicle listings from https://www.steeleford.com/used/search.html
 * Uses heuristic selectors to be resilient against minor markup changes
 */
class SteeleFordScraper extends BaseScraper {
  constructor() {
    super("SteeleFord");
    // Target updated to Steele Auto inventory
    this.baseUrl = "https://steeleauto.com";
    this.searchUrl = `${this.baseUrl}/inventory/search`;
    this.maxPages = 5;
    this.maxVehicles = 200;
  }

  async scrape() {
    this.initStats();
    this.log("Starting SteeleFord scraper...");

    try {
      const vehicles = [];

      for (let page = 1; page <= this.maxPages; page++) {
        if (vehicles.length >= this.maxVehicles) {
          this.log(`Reached maximum vehicle limit (${this.maxVehicles}). Stopping.`);
          break;
        }

        this.log(`Scraping page ${page}/${this.maxPages}`);

        try {
          const pageVehicles = await this.scrapePage(page);
          if (!pageVehicles || pageVehicles.length === 0) {
            this.log(`No vehicles found on page ${page}. Stopping pagination.`);
            break;
          }

          vehicles.push(...pageVehicles);
          this.log(`Found ${pageVehicles.length} vehicles on page ${page}`);

          // polite delay
          await this.sleep(1500 + Math.random() * 1500);
        } catch (error) {
          this.log(`Error scraping page ${page}: ${error.message}`, "error");
        }
      }

      const limited = vehicles.slice(0, this.maxVehicles);
      this.stats.scraped = limited.length;

      this.log(`Scraping completed. Found ${limited.length} vehicles`, "success");

      await this.closeBrowser();
      return limited;
    } catch (error) {
      this.log(`Scraper failed: ${error.message}`, "error");
      await this.closeBrowser();
      throw error;
    }
  }

  /**
   * Scrape a single page. SteeleFord appears to render server-side but protects some parts
   * We'll fetch the search URL and try to find listing containers by multiple selectors.
   */
  async scrapePage(page) {
    // SteeleFord uses a single search page; pagination might be via query params - try page param
    const url = page === 1 ? this.searchUrl : `${this.searchUrl}?page=${page}`;
    const html = await this.fetchHTML(url);

    // Save fetched parent HTML for analysis
    try {
      const tmpDir = path.join(__dirname, '..', '..', 'tmp');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, `steeleauto_parent_page_${page}.html`), html);
    } catch (e) {
      this.log(`Failed to save parent HTML: ${e.message}`, 'warn');
    }

    let $ = cheerio.load(html);

    // Candidate selectors for listing items
    const candidateSelectors = [
      ".listing",
      ".list-item",
      ".vehicle-item",
      "article",
      ".result",
      ".list-row",
      ".lstListingWrapperClone",
      ".divSpan12",
      ".inventory-result",
      ".vehicle-card",
      ".inventory-item",
      ".inventory-listing",
      "[data-vehicle-id]",
      ".vehRow",
      "li.carBoxWrapper",
      ".carBoxWrapper",
    ];

    let listings = $();

    for (const sel of candidateSelectors) {
      const found = $(sel).not('.hideme, #mobileSite *');
      if (found.length > listings.length) listings = found;
    }

    // Additional fallback: find elements containing .format-price
    if (listings.length === 0) {
      const priceParents = $(".format-price").closest("div, li, article, a");
      if (priceParents.length > 0) listings = priceParents;
    }

    // If still nothing found, the site may render listings into an iframe (#mobileSite).
    // Try to fetch the iframe src directly and re-run selectors against that content.
    if (listings.length === 0) {
      const iframeSrc = $("iframe#mobileSite").attr("src") || $("iframe").first().attr("src");
      if (iframeSrc) {
        this.log(`No listings on parent page — fetching iframe: ${iframeSrc}`, 'warn');
          try {
            const iframeHtml = await this.fetchHTML(iframeSrc.startsWith('http') ? iframeSrc : this.absoluteUrl(iframeSrc));

          // save iframe HTML
          try {
            const tmpDir = path.join(__dirname, '..', '..', 'tmp');
            fs.writeFileSync(path.join(tmpDir, `steeleauto_iframe_page_${page}.html`), iframeHtml);
          } catch (e) {
            this.log(`Failed to save iframe HTML: ${e.message}`, 'warn');
          }

          const _$ = cheerio.load(iframeHtml);

          // retry candidate selectors inside iframe
          let iframeListings = _$(candidateSelectors.join(', ')).not('.hideme, #mobileSite *');

          if (iframeListings.length === 0) {
            const priceParents = _$(".format-price").closest("div, li, article, a");
            if (priceParents.length > 0) iframeListings = priceParents;
          }

          this.log(`Found ${iframeListings.length} candidate listings inside iframe`);

          // replace listings with iframeListings mapped to same structure
          listings = iframeListings;

          // replace $ reference so downstream extraction uses iframe DOM
          // We'll pass a cheerio instance bound to iframe HTML when extracting
          // For simplicity, set $ to _$
          $ = _$;
        } catch (err) {
          this.log(`Failed to fetch/parse iframe: ${err.message}`, 'warn');
        }
      } else {
        // Try known mobile query parameters that the site uses (nfr & wswidth)
        const fallbackMobile = `${this.searchUrl}?nfr=1&wswidth=956`;
        this.log(`No iframe src found — trying mobile URL: ${fallbackMobile}`, 'warn');
        try {
          const mobileHtml = await this.fetchHTML(fallbackMobile);

          // save mobile HTML
          try {
            const tmpDir = path.join(__dirname, '..', '..', 'tmp');
            fs.writeFileSync(path.join(tmpDir, `steeleauto_mobile_page_${page}.html`), mobileHtml);
          } catch (e) {
            this.log(`Failed to save mobile HTML: ${e.message}`, 'warn');
          }

          const _$_ = cheerio.load(mobileHtml);
          let mobileListings = _$_(candidateSelectors.join(', ')).not('.hideme, #mobileSite *');
          if (mobileListings.length === 0) {
            const priceParents = _$_(".format-price").closest("div, li, article, a");
            if (priceParents.length > 0) mobileListings = priceParents;
          }
          this.log(`Found ${mobileListings.length} candidate listings on mobile URL`);
          listings = mobileListings;
          $ = _$_;
        } catch (err) {
          this.log(`Failed to fetch mobile URL: ${err.message}`, 'warn');
        }
      }
    }

    this.log(`Found ${listings.length} candidate listings on page`);

    // If still nothing found, as a last resort try a direct puppeteer DOM extraction
    if (listings.length === 0) {
      try {
        this.log('No listings found via static parse — trying direct Puppeteer DOM extraction', 'warn');
        const browser = await this.initBrowser();
        const pageObj = await browser.newPage();
        await pageObj.setUserAgent(this.getRandomUserAgent());
        await pageObj.setViewport({ width: 1200, height: 900 });
        await pageObj.goto(url, { waitUntil: 'networkidle2', timeout: this.timeout });
        await this.sleep(1000);

        // Try to find iframe and navigate into it
        let iframeSrc = null;
        try {
          iframeSrc = await pageObj.$eval('iframe#mobileSite', (el) => el.src);
        } catch (e) {
          // ignore
        }

        if (iframeSrc) {
          this.log(`Navigating to iframe src via puppeteer: ${iframeSrc}`);
          await pageObj.goto(iframeSrc.startsWith('http') ? iframeSrc : this.absoluteUrl(iframeSrc), { waitUntil: 'networkidle2', timeout: this.timeout });
          await this.sleep(1000);
        }

        const domHtml = await pageObj.content();

        // save DOM HTML
        try {
          const tmpDir = path.join(__dirname, '..', '..', 'tmp');
          fs.writeFileSync(path.join(tmpDir, `steeleauto_dom_page_${page}.html`), domHtml);
        } catch (e) {
          this.log(`Failed to save DOM HTML: ${e.message}`, 'warn');
        }

        const _$ = cheerio.load(domHtml);
        let domListings = _$(candidateSelectors.join(', ')).not('.hideme, #mobileSite *');
        if (domListings.length === 0) {
          const priceParents = _$(".format-price").closest("div, li, article, a");
          if (priceParents.length > 0) domListings = priceParents;
        }

        this.log(`Direct DOM extraction found ${domListings.length} candidate listings`);
        listings = domListings;
        $ = _$_;

        await pageObj.close();
      } catch (err) {
        this.log(`Direct DOM extraction failed: ${err.message}`, 'warn');
      }
    }

    const vehicles = [];

    listings.each((i, el) => {
      try {
        const $el = $(el);
        const vehicle = this.extractVehicleData($, $el);
        if (vehicle && this.validateVehicleData(vehicle, ["make", "model", "year"])) {
          vehicles.push(this.normalizeVehicleData(vehicle));
        }
      } catch (error) {
        this.log(`Error extracting vehicle ${i}: ${error.message}`, "warn");
      }
    });

    return vehicles;
  }

  /**
   * Extract vehicle data heuristically from an element
   */
  extractVehicleData($, $el) {
    // Prefer structured attributes if present (more reliable)
    // Many pages include data-* attributes on .carImage or a hidden input[name="vehicledata"]
    const structured = {};
    const carImage = $el.find('.carImage').first();
    if (carImage && carImage.length) {
      const dm = carImage.attr('data-make');
      const dmo = carImage.attr('data-model');
      const dy = carImage.attr('data-year');
      if (dm) structured.make = this.cleanText(dm);
      if (dmo) structured.model = this.cleanText(dmo);
      if (dy) structured.year = this.cleanText(dy);
    }

    // Hidden input carrying vehicledata is another reliable source
    const vehicleDataInput = $el.find('input[name="vehicledata"]').first();
    if (vehicleDataInput && vehicleDataInput.length) {
      try {
        const vmake = vehicleDataInput.attr('data-make');
        const vmodel = vehicleDataInput.attr('data-model');
        const vyear = vehicleDataInput.attr('data-year');
        if (vmake && !structured.make) structured.make = this.cleanText(vmake);
        if (vmodel && !structured.model) structured.model = this.cleanText(vmodel);
        if (vyear && !structured.year) structured.year = this.cleanText(vyear);
      } catch (e) {
        // ignore
      }
    }

    // Title detection
    const titleSel = ["h2", "h3", ".title", ".vehTitle", "a[href*='vehicle']", "a[href*='/used/']"];
    let title = null;
    for (const sel of titleSel) {
      const t = $el.find(sel).first().text() || $el.attr('title');
      if (t && t.trim().length > 0) {
        title = this.cleanText(t);
        break;
      }
    }

    // Prepare parts container early so later heuristics can populate it
    let parts = { year: null, make: null, model: null };

    // Steele Auto specific card structure: year/make in a <p> then model in <strong> inside it
    try {
      const pFirst = $el.find('p').first();
      if (pFirst && pFirst.length) {
        const pText = this.cleanText(pFirst.clone().children('strong').remove().end().text());
        const strongModel = $el.find('p strong').first().text();
        if (pText && !parts.year && !parts.make) {
          const ym = pText.match(/\b(19|20)\d{2}\b\s+([A-Za-z0-9\-]+)/);
          if (ym) {
            parts.year = parts.year || ym[0].match(/\b(19|20)\d{2}\b/)[0];
            parts.make = parts.make || (ym[2] ? this.cleanText(ym[2]) : null);
          } else {
            // Sometimes p contains '2021 Ford' with extra spacing
            const alt = pText.match(/(\d{4})\s+([A-Za-z0-9\-]+)/);
            if (alt) {
              parts.year = parts.year || alt[1];
              parts.make = parts.make || alt[2];
            }
          }
        }
        if (strongModel && !parts.model) {
          parts.model = this.cleanText(strongModel);
        }
        // set title if missing
        if (!title && pText) title = pText + (strongModel ? ` ${strongModel}` : '');
      }
    } catch (e) {
      // ignore
    }

    // Some listings use h6 (Year + Make) and h1 (Model) inside card-body
    try {
      if ((!parts.year || !parts.make || !parts.model)) {
        const h6 = $el.find('h6').first().text();
        const h1 = $el.find('h1').first().text();
        if (h6 && (!parts.year || !parts.make)) {
          const m = this.cleanText(h6).match(/(\d{4})\s+(.+)/);
          if (m) {
            parts.year = parts.year || m[1];
            // m[2] may contain make and extra words; take first token
            const maybeMake = m[2].split(/\s+/)[0];
            parts.make = parts.make || maybeMake;
          }
        }
        if (h1 && !parts.model) {
          parts.model = parts.model || this.cleanText(h1).split(/\n/)[0];
        }
      }
    } catch (e) {}

    // Final heuristic fallback: find any 4-digit year and common makes in the element text
    if (!parts.year || !parts.make) {
      try {
        const elText = this.cleanText($el.text() || '');
        if (!parts.year) {
          const yearMatch = elText.match(/\b(19|20)\d{2}\b/);
          if (yearMatch) parts.year = yearMatch[0];
        }

        if (!parts.make) {
          const makes = [
            'Toyota','Honda','Ford','Chevrolet','Nissan','Mazda','BMW','Mercedes','Audi','Volkswagen','Hyundai','Kia','Subaru','Jeep','GMC','Lexus','Acura','Infiniti','Ram','Dodge','Buick','Cadillac','Volvo','Porsche','Tesla'
          ];
          for (const m of makes) {
            const idx = elText.toLowerCase().indexOf(m.toLowerCase());
            if (idx !== -1) {
              parts.make = m;
              // attempt to get model as the next 1-3 tokens after the make occurrence
              const after = elText.substring(idx + m.length).trim();
              const modelTokens = after.split(/\s+/).slice(0, 3).join(' ').replace(/[\|,\n].*$/,'').trim();
              if (modelTokens && !parts.model) parts.model = modelTokens;
              break;
            }
          }
        }
      } catch (e) {}
    }

    // Price detection
    let price = null;
    const priceElem = $el.find('.format-price, .price, [class*="price"]').first();
    if (priceElem && priceElem.length) price = priceElem.text();
    if (!price) {
      // find any $ in text
      const text = $el.text();
      const match = text && text.match(/\$\s?[\d,]+/);
      if (match) price = match[0];
    }

    // Image detection
    let images = [];
    const img = $el.find('img').first();
    if (img && img.attr('src')) images.push(this.absoluteUrl(img.attr('src')));

    // If we found structured attributes use them first, otherwise fall back to title parsing
    if (structured.make || structured.year || structured.model) {
      parts = {
        make: structured.make || null,
        model: structured.model || null,
        year: structured.year || null,
      };
    } else {
      // Try site-specific data attributes used by Steele Auto
      try {
        const dataId = $el.attr('data-inventory-id') || $el.attr('data-id') || $el.attr('data-vehicle-id');
        if (dataId && !parts.sourceId) parts.sourceId = this.cleanText(dataId.toString());
      } catch (e) {}

      // Try ld+json Vehicle block as another fallback
      try {
        const ld = $el.find("script[type='application/ld+json']");
        if (ld && ld.length) {
          for (let i = 0; i < ld.length; i++) {
            const jsonText = $(ld[i]).contents().text();
            if (!jsonText) continue;
            try {
              const obj = JSON.parse(jsonText);
              if (obj && (obj['@type'] === 'Vehicle' || obj['@type'] === 'Product')) {
                if (obj.brand && obj.brand.name && !parts.make) parts.make = this.cleanText(obj.brand.name);
                if (obj.name && !parts.model) {
                  // obj.name often contains year + make + model; remove year if present
                  const nm = this.cleanText(obj.name);
                  const yearMatch = nm.match(/\b(19|20)\d{2}\b/);
                  parts.year = parts.year || (yearMatch ? yearMatch[0] : null);
                  // remove year and make from name to get model
                  let candidate = nm;
                  if (parts.year) candidate = candidate.replace(parts.year, '');
                  if (parts.make) candidate = candidate.replace(new RegExp(parts.make, 'i'), '');
                  candidate = candidate.replace(/\bin\s+[A-Za-z\s]+$/i, '').trim();
                  parts.model = parts.model || (candidate || null);
                }
                if (obj.productID && !parts.sourceId) parts.sourceId = obj.productID;
              }
            } catch (e) {
              // ignore JSON parse errors
            }
          }
        }
      } catch (e) {
        // ignore
      }

      if (!parts.make && title) {
        parts = this.parseTitleParts(title || '');
      }
    }

    // Mileage detection
    let mileage = null;
    const mileageMatch = $el.text().match(/([\d,]+)\s*(km|k)?/i);
    if (mileageMatch) mileage = mileageMatch[1];

    // Dealer name (site is dealer) - fallback to Steele Ford
    const dealerName = "Steele Ford Lincoln";

    const detailLink = $el.find('a[href*="/used/"]').first().attr('href') || $el.find('a').first().attr('href');
    const sourceUrl = detailLink ? this.absoluteUrl(detailLink) : null;

    const vehicle = {
      make: parts.make || null,
      model: parts.model || null,
      year: parts.year || null,
      price: price || null,
      mileage: mileage || null,
      images: images,
      description: title || null,
      dealerName: dealerName,
      dealerLocation: "Halifax, Nova Scotia",
      city: "Halifax",
      province: "Nova Scotia",
      location: "Halifax, Nova Scotia",
      sourceUrl: sourceUrl,
      sourceSite: this.name,
    };

    return vehicle;
  }

  /**
   * Make URL absolute when necessary
   */
  absoluteUrl(path) {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    if (path.startsWith('//')) return `https:${path}`;
    if (path.startsWith('/')) return `${this.baseUrl}${path}`;
    return `${this.baseUrl}/${path}`;
  }

  /**
   * Simple title parsing to get year/make/model
   */
  parseTitleParts(title) {
    const parts = { year: null, make: null, model: null };
    if (!title) return parts;

    // Year - 4 digit
    const yearMatch = title.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) parts.year = yearMatch[0];

    // Try to split title into words and find common makes
    const makes = [
      'Toyota','Honda','Ford','Chevrolet','Nissan','Mazda','BMW','Mercedes','Audi','Volkswagen','Hyundai','Kia','Subaru','Jeep','GMC','Lexus','Acura','Infiniti','Ram','Dodge','Buick','Cadillac','Volvo','Porsche','Tesla'
    ];

    for (const make of makes) {
      const idx = title.toLowerCase().indexOf(make.toLowerCase());
      if (idx !== -1) {
        parts.make = make;
        const after = title.substring(idx + make.length).trim();
        // model is first token(s) after make up to a comma or pipe or year
        const modelMatch = after.match(/^([A-Za-z0-9\-\s]+)/);
        if (modelMatch) {
          let model = modelMatch[1].trim();
          if (parts.year) model = model.replace(parts.year, '').trim();
          // stop at separators
          model = model.split('|')[0].split(',')[0].split('\n')[0].trim();
          parts.model = model || null;
        }
        break;
      }
    }

    // If make not found, try to parse title words
    if (!parts.make) {
      const words = title.split(/\s+/);
      if (words.length >= 2) {
        parts.make = words[0];
        parts.model = words.slice(1, 3).join(' ');
      }
    }

    return parts;
  }
}

module.exports = SteeleFordScraper;
