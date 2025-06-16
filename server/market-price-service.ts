import { storage } from "./storage";
import { getMarketStatus } from "./market-schedule";
import { logger } from "./logger";
import type { InsertHistoricalPrice } from "@shared/schema";

interface StockQuoteAPI {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  open?: number;
  high?: number;
  low?: number;
}

export class MarketPriceService {
  private isRecordingPrices = false;
  private recordingTimer: NodeJS.Timeout | null = null;

  /**
   * Get stock price with market-aware fallback
   * During market hours: fetch from API
   * After hours/weekends: fetch from database
   */
  async getMarketAwarePrice(symbol: string, apiQuoteFetcher: (symbol: string) => Promise<StockQuoteAPI | null>): Promise<StockQuoteAPI | null> {
    const marketStatus = getMarketStatus();
    
    if (marketStatus.isOpen) {
      // Market is open - fetch from API
      const apiQuote = await apiQuoteFetcher(symbol);
      if (apiQuote) {
        logger.info("MARKET_PRICE", `Live price for ${symbol}: $${apiQuote.price}`);
        return apiQuote;
      }
    }

    // Market closed or API failed - fetch from database
    const historicalPrice = await storage.getLatestHistoricalPrice(symbol);
    if (historicalPrice) {
      logger.info("MARKET_PRICE", `Historical price for ${symbol}: $${historicalPrice.closePrice} (${historicalPrice.date})`);
      return {
        symbol,
        price: parseFloat(historicalPrice.closePrice),
        change: parseFloat(historicalPrice.change || "0"),
        changePercent: parseFloat(historicalPrice.changePercent || "0"),
        volume: historicalPrice.volume || undefined,
        open: historicalPrice.openPrice ? parseFloat(historicalPrice.openPrice) : undefined,
        high: historicalPrice.highPrice ? parseFloat(historicalPrice.highPrice) : undefined,
        low: historicalPrice.lowPrice ? parseFloat(historicalPrice.lowPrice) : undefined,
      };
    }

    logger.warn("MARKET_PRICE", `No price data available for ${symbol}`);
    return null;
  }

  /**
   * Record end-of-market prices for all holdings and watchlist symbols
   */
  async recordEndOfMarketPrices(apiQuoteFetcher: (symbol: string) => Promise<StockQuoteAPI | null>): Promise<void> {
    if (this.isRecordingPrices) {
      logger.info("MARKET_PRICE", "Price recording already in progress");
      return;
    }

    this.isRecordingPrices = true;
    logger.info("MARKET_PRICE", "Starting end-of-market price recording");

    try {
      // Get all unique symbols from holdings and watchlist
      const [holdingSymbols, watchlistSymbols] = await Promise.all([
        storage.getUniqueSymbolsFromHoldings(),
        storage.getUniqueSymbolsFromWatchlist()
      ]);

      const allSymbols = Array.from(new Set([...holdingSymbols, ...watchlistSymbols]));
      logger.info("MARKET_PRICE", `Recording prices for ${allSymbols.length} symbols`);

      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of day for consistent dating

      const pricesToSave: InsertHistoricalPrice[] = [];
      let successCount = 0;
      let errorCount = 0;

      // Fetch quotes with controlled batching
      for (let i = 0; i < allSymbols.length; i += 5) {
        const batch = allSymbols.slice(i, i + 5);
        
        const batchPromises = batch.map(async (symbol) => {
          try {
            const quote = await apiQuoteFetcher(symbol);
            if (quote && quote.price && quote.price > 0) {
              const historicalPrice: InsertHistoricalPrice = {
                symbol,
                date: today,
                closePrice: quote.price.toString(),
                openPrice: quote.open?.toString(),
                highPrice: quote.high?.toString(),
                lowPrice: quote.low?.toString(),
                volume: quote.volume || null,
                change: quote.change?.toString(),
                changePercent: quote.changePercent?.toString(),
              };
              
              pricesToSave.push(historicalPrice);
              successCount++;
              logger.debug("MARKET_PRICE", `Recorded ${symbol}: $${quote.price}`);
            } else {
              errorCount++;
              logger.warn("MARKET_PRICE", `No valid quote for ${symbol}`);
            }
          } catch (error) {
            errorCount++;
            logger.error("MARKET_PRICE", `Error fetching ${symbol}`, error);
          }
        });

        await Promise.all(batchPromises);
        
        // Small delay between batches to respect rate limits
        if (i + 5 < allSymbols.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Save all prices to database
      if (pricesToSave.length > 0) {
        await storage.batchSaveHistoricalPrices(pricesToSave);
        logger.info("MARKET_PRICE", `Successfully recorded ${successCount} prices, ${errorCount} errors`);
      } else {
        logger.warn("MARKET_PRICE", "No prices to save");
      }

    } catch (error) {
      logger.error("MARKET_PRICE", "Error during price recording", error);
    } finally {
      this.isRecordingPrices = false;
    }
  }

  /**
   * Start automated end-of-market price recording
   * Runs at 4:15 PM ET on trading days
   */
  startAutomatedRecording(apiQuoteFetcher: (symbol: string) => Promise<StockQuoteAPI | null>): void {
    // Clear existing timer
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
    }

    // Check every 15 minutes if we should record prices
    this.recordingTimer = setInterval(() => {
      const now = new Date();
      const marketStatus = getMarketStatus(now);
      
      // Record at 4:15 PM ET on trading days (when market has just closed)
      const hour = now.getHours();
      const minute = now.getMinutes();
      
      // Convert to ET: if UTC hour is 20-21 (4-5 PM ET), record prices
      const isRecordingTime = (hour === 20 || hour === 21) && minute >= 15 && minute < 30;
      
      if (isRecordingTime && marketStatus.isTradingDay && !this.isRecordingPrices) {
        logger.info("MARKET_PRICE", "Triggering automated end-of-market price recording");
        this.recordEndOfMarketPrices(apiQuoteFetcher).catch(error => {
          logger.error("MARKET_PRICE", "Automated price recording failed", error);
        });
      }
    }, 15 * 60 * 1000); // Check every 15 minutes

    logger.info("MARKET_PRICE", "Automated price recording service started");
  }

  /**
   * Stop automated recording service
   */
  stopAutomatedRecording(): void {
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
      logger.info("MARKET_PRICE", "Automated price recording service stopped");
    }
  }

  /**
   * Get price recording status
   */
  getRecordingStatus(): { isRecording: boolean; hasTimer: boolean } {
    return {
      isRecording: this.isRecordingPrices,
      hasTimer: this.recordingTimer !== null,
    };
  }
}

export const marketPriceService = new MarketPriceService();