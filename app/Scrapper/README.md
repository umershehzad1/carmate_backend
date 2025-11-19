# Vehicle Scraper System

## Overview

The Vehicle Scraper System automatically scrapes vehicle listings from three major Canadian automotive marketplaces:

- **AutoTrader.ca** - Canada's largest automotive marketplace
- **Kijiji.ca** - Popular classified ads platform
- **CarPages.ca** - Automotive marketplace

The system runs automatically every night at **11:00 PM (23:00)** and:

1. ✅ Scrapes vehicle listings from all three platforms
2. ✅ Creates dealer accounts automatically (role: `dealer`)
3. ✅ Creates dealer profiles in the `Dealer` table
4. ✅ Creates vehicle listings with all details
5. ✅ Automatically creates base advertisements for each vehicle
6. ✅ Assigns proper dealerId to each vehicle

## Architecture

```
app/Scrapper/
├── BaseScraper.js          # Base class with common scraping methods
├── AutoTraderScraper.js    # Scrapes AutoTrader.ca
├── KijijiScraper.js        # Scrapes Kijiji.ca
├── CarPagesScraper.js      # Scrapes CarPages.ca
└── ScraperOrchestrator.js  # Coordinates all scrapers and data import

cronjobs/
└── vehicleScraper.js       # Cron job (runs at 11 PM daily)

scripts/
└── testScraper.js          # Manual test script
```

## Features

### 🤖 Automated Scraping
- Runs every night at 11 PM
- Scrapes multiple pages from each platform
- Handles rate limiting with random delays
- Retry logic for failed requests

### 👥 Dealer Management
- Automatically creates dealer users with unique usernames and emails
- Creates dealer profile records in the `Dealer` table
- Assigns 20 free listing slots to each scraped dealer
- Groups vehicles by dealer (same dealer = same userId)

### 🚗 Vehicle Creation
- Extracts comprehensive vehicle information:
  - Make, model, year
  - Price, mileage, transmission
  - Fuel type, body type, color
  - Location (city, province)
  - Multiple images
  - Full description
- Generates unique slugs for each vehicle
- Sets status to `live` automatically

### 📢 Advertisement Creation
- Automatically creates base advertisements (via Vehicle model hooks)
- Base ads have `adType: "base"`
- Properly tracks available car listings

## Database Schema

### User Table
```javascript
{
  email: "dealer-name-123456@scraped-dealers.carmate.com",
  password: "hashed",
  fullname: "Dealer Name",
  username: "dealer-name-123456789",
  phone: "scraped if available",
  role: "dealer" // Important!
}
```

### Dealer Table
```javascript
{
  userId: 123, // References User.id
  location: "Toronto, Ontario",
  status: "nonverified",
  slug: "dealer-name-123",
  availableCarListing: 20
}
```

### Vehicle Table
```javascript
{
  dealerId: 123, // References User.id (same as dealer user)
  name: "2022 Toyota Camry",
  slug: "2022-toyota-camry-toronto-123-456789",
  images: ["url1", "url2", ...],
  price: "25000",
  city: "Toronto",
  province: "Ontario",
  make: "Toyota",
  model: "Camry",
  year: "2022",
  // ... many more fields
  status: "live"
}
```

### Advertisement Table (Auto-created)
```javascript
{
  vehicleId: 456,
  dealerId: 123,
  adType: "base",
  status: "running",
  pauseReason: "none",
  dailyBudget: 0.00
}
```

## Configuration

### Cron Schedule
Edit `cronjobs/vehicleScraper.js` to change the schedule:

```javascript
// Current: Every night at 11 PM
cron.schedule("0 23 * * *", async () => { ... });

// For testing: Every 5 minutes (uncomment)
// cron.schedule("*/5 * * * *", async () => { ... });
```

### Scraping Limits
Edit each scraper file to adjust pages scraped:

```javascript
// In AutoTraderScraper.js, KijijiScraper.js, CarPagesScraper.js
this.maxPages = 3; // Change this number
```

## Manual Testing

Run the scraper manually for testing:

```bash
cd carmate
node scripts/testScraper.js
```

This will:
- Run all scrapers immediately
- Show detailed logs
- Display summary statistics
- Exit when complete

## Logs

The scraper provides detailed logs:

```
✅ [Orchestrator] Starting scraper orchestrator...
ℹ️  [AutoTrader] Starting AutoTrader scraper...
ℹ️  [AutoTrader] Scraping page 1/3
✅ [AutoTrader] Found 15 listings on page 1
✅ [Orchestrator] Created dealer user: XYZ Motors (ID: 123)
✅ [Orchestrator] Created dealer profile for: XYZ Motors (Dealer ID: 45)
✅ [Orchestrator] Created vehicle: 2022 Toyota Camry (ID: 789)
✅ [Orchestrator] Base advertisement created for vehicle ID: 789
```

## Error Handling

- Failed page scrapes are logged but don't stop the process
- Missing required fields (make, model, price, year) skip that vehicle
- Database errors for individual vehicles don't stop other vehicles
- Full error stats included in summary report

## Summary Report

After each run:

```
============================================================
📊 SCRAPER ORCHESTRATOR SUMMARY
============================================================
⏱️  Duration: 12.45 minutes
🔍 Total Scraped: 45 listings
👥 Dealers Created: 8
🚗 Vehicles Created: 42
📢 Ads Created: 42
❌ Errors: 3
============================================================
```

## Important Notes

### Dealer Creation
- Each unique dealer (by name + location) gets ONE user account
- All vehicles from the same dealer use the same `dealerId`
- Dealer profiles are automatically created in the `Dealer` table
- Passwords are randomly generated and hashed

### Vehicle Status
- All scraped vehicles are set to `status: "live"`
- This triggers automatic base ad creation (via model hooks)
- Dealer's `availableCarListing` is decremented automatically

### Data Deduplication
- Vehicles are checked for duplicates before creation
- Duplicate check: same dealerId, make, model, year, and price
- Existing vehicles are skipped (not updated)

### Images
- Multiple images are scraped when available
- Placeholder images used if no images found
- All images stored as array in `images` field

## Dependencies

```json
{
  "axios": "Web requests",
  "cheerio": "HTML parsing",
  "node-cron": "Scheduling",
  "bcryptjs": "Password hashing",
  "slugify": "URL-friendly slugs",
  "sequelize": "Database ORM"
}
```

## Troubleshooting

### No vehicles being scraped
- Check if the website structure has changed
- Test with manual script: `node scripts/testScraper.js`
- Check logs for connection errors

### Dealer not getting created
- Check database constraints (unique emails, usernames)
- Verify Dealer table has proper associations
- Check logs for SQL errors

### Advertisements not being created
- Verify dealer has `availableCarListing > 0`
- Check Vehicle model hooks are working
- Verify Advertisement model associations

### Rate Limiting
- Increase delays in scraper files
- Reduce `maxPages` to scrape fewer pages
- Add more random delay variance

## Future Enhancements

- [ ] Add more Canadian marketplaces
- [ ] Implement update mechanism for existing vehicles
- [ ] Add price change tracking
- [ ] Email notifications for new dealers
- [ ] Admin dashboard for scraper stats
- [ ] Scraper health monitoring
- [ ] Duplicate detection improvements

## Support

For issues or questions:
1. Check the logs in terminal
2. Run manual test script for debugging
3. Review error messages in summary report
4. Check database for partial data

## License

Proprietary - CarMate Project
