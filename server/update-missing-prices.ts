import { storage } from "./storage";
import { logger } from "./logger";

// List of stocks that need real EOD prices
const missingStocks = ['ANET', 'ARE', 'BRKB', 'CCL', 'CLS', 'CRDO', 'EZPW', 'JPC', 'LC', 'MAIN', 'MFC', 'O', 'SMCI', 'SYF', 'USBPRH'];

const FMP_API_KEY = process.env.FMP_API_KEY;
const FMP_BASE_URL = 'https://financialmodelingprep.com/api';

async function fetchFridayEODPrice(symbol: string): Promise<any | null> {
  if (!FMP_API_KEY) {
    console.error('FMP API key not configured');
    return null;
  }
  
  try {
    console.log(`[FMP] Fetching EOD price for ${symbol}`);
    
    const response = await fetch(`${FMP_BASE_URL}/v3/quote/${symbol}?apikey=${FMP_API_KEY}`);
    const data = await response.json();
    
    if (data && Array.isArray(data) && data.length > 0) {
      const quote = data[0];
      if (quote.price && quote.price > 0) {
        console.log(`[EOD_SUCCESS] ${symbol}: $${quote.price} (${quote.changesPercentage || 0}%)`);
        return {
          symbol: quote.symbol,
          price: quote.price,
          change: quote.change || 0,
          changePercent: quote.changesPercentage || 0,
          open: quote.open,
          high: quote.dayHigh,
          low: quote.dayLow,
          volume: quote.volume
        };
      }
    }
    
    console.log(`[EOD_FAILED] No valid data for ${symbol}`);
    return null;
  } catch (error) {
    console.error(`[EOD_ERROR] ${symbol}:`, error);
    return null;
  }
}

async function updateMissingEODPrices() {
  console.log(`[EOD_UPDATE] Starting Friday EOD price update for ${missingStocks.length} stocks`);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let successCount = 0;
  let errorCount = 0;
  
  // Process stocks in smaller batches to respect rate limits
  for (let i = 0; i < missingStocks.length; i += 3) {
    const batch = missingStocks.slice(i, i + 3);
    
    const batchPromises = batch.map(async (symbol) => {
      try {
        const quote = await fetchFridayEODPrice(symbol);
        if (quote && quote.price && quote.price > 0) {
          // Update the historical price record
          const historicalPrice = {
            symbol,
            date: today,
            closePrice: quote.price.toString(),
            openPrice: quote.open?.toString() || quote.price.toString(),
            highPrice: quote.high?.toString() || quote.price.toString(),
            lowPrice: quote.low?.toString() || quote.price.toString(),
            volume: quote.volume || null,
            change: quote.change?.toString() || "0",
            changePercent: quote.changePercent?.toString() || "0",
          };
          
          await storage.saveHistoricalPrice(historicalPrice);
          successCount++;
          console.log(`[EOD_UPDATED] ${symbol}: $${quote.price}`);
        } else {
          errorCount++;
          console.log(`[EOD_SKIP] ${symbol}: No valid price data`);
        }
      } catch (error) {
        errorCount++;
        console.error(`[EOD_ERROR] ${symbol}:`, error);
      }
    });
    
    await Promise.all(batchPromises);
    
    // Small delay between batches
    if (i + 3 < missingStocks.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log(`[EOD_COMPLETE] Updated ${successCount} stocks, ${errorCount} errors`);
  return { success: successCount, errors: errorCount };
}

// Run the update
updateMissingEODPrices()
  .then(result => {
    console.log("Friday EOD price update completed:", result);
    process.exit(0);
  })
  .catch(error => {
    console.error("Friday EOD price update failed:", error);
    process.exit(1);
  });