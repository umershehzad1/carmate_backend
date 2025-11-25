/* Debug script to run AutoTrader scraper manually */
(async () => {
  try {
    const AutoTraderScraper = require('../app/Scrapper/AutoTraderScraper');
    const scraper = new AutoTraderScraper();
    console.log('Starting AutoTrader debug run...');
    const start = Date.now();
    const vehicles = await scraper.scrape();
    const duration = (Date.now() - start) / 1000;
    console.log(`AutoTrader debug finished in ${duration}s, vehicles: ${vehicles.length}`);
    console.log(JSON.stringify(vehicles.slice(0, 2), null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Debug run failed:', err);
    process.exit(1);
  }
})();