import { storage } from "./storage";
import { logger } from "./logger";

// Sample current prices from the logs (these are the live prices we've been fetching)
const currentPrices = [
  { symbol: "ASML", price: 838.12, change: -13.95, changePercent: -1.637 },
  { symbol: "VOO", price: 517.47, change: -5.84, changePercent: -1.1163 },
  { symbol: "SPY", price: 597, change: -6.75, changePercent: -1.11801 },
  { symbol: "LMT", price: 486.45, change: 17.18, changePercent: 3.66101 },
  { symbol: "META", price: 682.87, change: -10.49, changePercent: -1.51292 },
  { symbol: "MSFT", price: 474.96, change: -3.91, changePercent: -0.81651 },
  { symbol: "VOOG", price: 379.04, change: -4.71, changePercent: -1.22736 },
  { symbol: "CRWD", price: 480.62, change: -1.11, changePercent: -0.23042 },
  { symbol: "COIN", price: 242.71, change: 1.66, changePercent: 0.68865 },
  { symbol: "APP", price: 364.49, change: -16.09, changePercent: -4.22776 },
  { symbol: "GOOGL", price: 174.67, change: -1.03, changePercent: -0.58623 },
  { symbol: "AMD", price: 116.16, change: -2.34, changePercent: -1.97468 },
  { symbol: "POWL", price: 187.85, change: -5.48, changePercent: -2.83453 },
  { symbol: "XLV", price: 136.13, change: -0.68, changePercent: -0.49704 },
  { symbol: "RCL", price: 258.08, change: -7.65, changePercent: -2.87886 },
  { symbol: "GOOG", price: 175.88, change: -1.09, changePercent: -0.61592 },
  { symbol: "STRL", price: 202.99, change: -1.33, changePercent: -0.65094 },
  { symbol: "QTWO", price: 85.68, change: -2.79, changePercent: -3.15361 },
  { symbol: "SBUX", price: 93.26, change: -1.06, changePercent: -1.12383 },
  { symbol: "ALAB", price: 89.73, change: -4.61, changePercent: -4.88658 },
  { symbol: "MU", price: 115.6, change: -0.58, changePercent: -0.49923 },
  { symbol: "XBI", price: 83.6, change: -0.76, changePercent: -0.9009 },
  { symbol: "TWLO", price: 113.39, change: -2.41, changePercent: -2.08117 },
  { symbol: "OKTA", price: 97.48, change: -2.7, changePercent: -2.69515 },
  // Watchlist items
  { symbol: "AMZN", price: 212.1, change: -1.14, changePercent: -0.53461 },
  { symbol: "AAPL", price: 196.45, change: -2.75, changePercent: -1.38052 },
  { symbol: "TSLA", price: 325.31, change: 6.2, changePercent: 1.9429 },
  { symbol: "NVDA", price: 141.97, change: -3.03, changePercent: -2.08966 },
];

export async function recordCurrentPrices() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of day for consistent dating
    
    logger.info("PRICE_RECORDING", `Recording ${currentPrices.length} current stock prices`);
    
    const historicalPrices = currentPrices.map(stock => ({
      symbol: stock.symbol,
      date: today,
      closePrice: stock.price.toString(),
      openPrice: stock.price.toString(), // Using current price as open since we don't have intraday data
      highPrice: stock.price.toString(),
      lowPrice: stock.price.toString(),
      volume: null,
      change: stock.change.toString(),
      changePercent: stock.changePercent.toString(),
    }));

    await storage.batchSaveHistoricalPrices(historicalPrices);
    
    logger.info("PRICE_RECORDING", `Successfully recorded ${historicalPrices.length} prices`);
    
    // Verify recording
    const recordedCount = await verifyRecording();
    logger.info("PRICE_RECORDING", `Verification: ${recordedCount} prices in database`);
    
    return { success: true, recorded: historicalPrices.length, verified: recordedCount };
  } catch (error) {
    logger.error("PRICE_RECORDING", "Failed to record prices", error);
    throw error;
  }
}

async function verifyRecording() {
  try {
    // Get a few sample symbols to verify
    const sampleSymbols = ["AAPL", "MSFT", "AMZN"];
    let count = 0;
    
    for (const symbol of sampleSymbols) {
      const price = await storage.getLatestHistoricalPrice(symbol);
      if (price) count++;
    }
    
    return count;
  } catch (error) {
    logger.error("PRICE_RECORDING", "Verification failed", error);
    return 0;
  }
}

// Run the recording
if (require.main === module) {
  recordCurrentPrices()
    .then(result => {
      console.log("Price recording completed:", result);
      process.exit(0);
    })
    .catch(error => {
      console.error("Price recording failed:", error);
      process.exit(1);
    });
}