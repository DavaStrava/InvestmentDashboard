import type { Express } from "express";
import { storage } from "./storage";
import { logger } from "./logger";

interface OptimizedHolding {
  id: number;
  symbol: string;
  companyName: string;
  shares: string;
  avgCostPerShare: string;
  currentPrice: number;
  afterHoursPrice?: number | null;
  dailyChange: number;
  dailyChangePercent: number;
  totalValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  costBasis: number;
  marketWeight: number;
  dataSource: 'live_api' | 'database_eod' | 'cost_basis';
  lastUpdated: Date;
}

interface OptimizedPortfolioSummary {
  totalValue: number;
  dailyChange: number;
  dailyChangePercent: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  holdingsCount: number;
  dataQuality: {
    liveQuotes: number;
    databaseQuotes: number;
    costBasisFallback: number;
  };
  lastUpdated: Date;
}

class OptimizedPortfolioService {
  private holdingsCache: Map<string, OptimizedHolding> = new Map();
  private summaryCache: OptimizedPortfolioSummary | null = null;
  private lastCacheUpdate: number = 0;
  private readonly CACHE_DURATION = 600000; // 10 minutes for optimal performance
  private readonly MAX_LIVE_QUOTES = 10; // Conservative API usage with smart prioritization

  /**
   * Get all holdings with optimized data sourcing
   */
  async getOptimizedHoldings(): Promise<OptimizedHolding[]> {
    if (this.isCacheValid() && this.holdingsCache.size > 0) {
      logger.info("CACHE_HIT", "Serving holdings from cache", { 
        count: this.holdingsCache.size,
        age: Math.round((Date.now() - this.lastCacheUpdate) / 1000) + "s"
      });
      return Array.from(this.holdingsCache.values());
    }

    await this.refreshHoldingsData();
    return Array.from(this.holdingsCache.values());
  }

  /**
   * Get portfolio summary with cached calculations
   */
  async getOptimizedSummary(): Promise<OptimizedPortfolioSummary> {
    if (this.isCacheValid() && this.summaryCache) {
      return this.summaryCache;
    }

    const holdings = await this.getOptimizedHoldings();
    this.summaryCache = this.calculateSummary(holdings);
    return this.summaryCache;
  }

  /**
   * Refresh holdings data with minimal API usage
   */
  private async refreshHoldingsData(): Promise<void> {
    const rawHoldings = await storage.getHoldings();
    if (rawHoldings.length === 0) {
      this.holdingsCache.clear();
      this.summaryCache = null;
      return;
    }

    logger.info("REFRESH_START", "Refreshing portfolio data", { holdings: rawHoldings.length });

    // Strategy: Only get live quotes for largest positions
    const prioritySymbols = this.selectPrioritySymbols(rawHoldings);
    const liveQuotes = await this.fetchMinimalLiveQuotes(prioritySymbols);

    this.holdingsCache.clear();
    let liveCount = 0;
    let dbCount = 0;
    let fallbackCount = 0;

    // Process holdings in parallel for better performance
    const holdingPromises = rawHoldings.map(holding => this.processHolding(holding, liveQuotes));
    const optimizedHoldings = await Promise.all(holdingPromises);

    optimizedHoldings.forEach((optimized, index) => {
      this.holdingsCache.set(rawHoldings[index].symbol, optimized);

      // Track data source statistics
      switch (optimized.dataSource) {
        case 'live_api': liveCount++; break;
        case 'database_eod': dbCount++; break;
        case 'cost_basis': fallbackCount++; break;
      }
    });

    // Update market weights
    this.updateMarketWeights();
    this.lastCacheUpdate = Date.now();

    logger.info("REFRESH_COMPLETE", "Portfolio data refreshed", {
      total: rawHoldings.length,
      live: liveCount,
      database: dbCount,
      fallback: fallbackCount
    });
  }

  /**
   * Select only the most important symbols for live API calls
   */
  private selectPrioritySymbols(holdings: any[]): string[] {
    // Calculate position values using cost basis
    const positionValues = holdings.map(h => ({
      symbol: h.symbol,
      value: parseFloat(h.shares) * parseFloat(h.avgCostPerShare)
    }));

    // Sort by value and take top positions
    const sorted = positionValues.sort((a, b) => b.value - a.value);
    return sorted.slice(0, this.MAX_LIVE_QUOTES).map(p => p.symbol);
  }

  /**
   * Fetch minimal live quotes with intelligent throttling
   */
  private async fetchMinimalLiveQuotes(symbols: string[]): Promise<Map<string, any>> {
    const quotes = new Map();
    
    if (symbols.length === 0) return quotes;

    logger.info("LIVE_FETCH", `Fetching ${symbols.length} priority quotes`, { symbols });

    // Batch fetch in chunks with exponential backoff on errors
    const batchSize = 3;
    let errorCount = 0;
    const maxErrors = 2;

    for (let i = 0; i < Math.min(symbols.length, this.MAX_LIVE_QUOTES); i += batchSize) {
      if (errorCount >= maxErrors) {
        logger.warn("THROTTLE_LIMIT", "Stopping due to error threshold", { errorCount });
        break;
      }

      const batch = symbols.slice(i, i + batchSize);
      const batchPromises = batch.map(async (symbol, index) => {
        try {
          // Stagger requests within batch to avoid rate limits
          await this.delay(index * 400);
          const quote = await this.fetchSingleQuote(symbol);
          if (quote && quote.price > 0) {
            return { symbol, quote };
          }
        } catch (error) {
          errorCount++;
          logger.warn("QUOTE_ERROR", `Failed to fetch ${symbol}`, error);
          return null;
        }
        return null;
      });

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(result => {
        if (result) {
          quotes.set(result.symbol, result.quote);
        }
      });

      // Delay between batches with exponential backoff on errors
      const batchDelay = errorCount > 0 ? 2000 * Math.pow(2, errorCount) : 1500;
      await this.delay(batchDelay);
    }

    return quotes;
  }

  /**
   * Process individual holding with best available data
   */
  private async processHolding(holding: any, liveQuotes: Map<string, any>): Promise<OptimizedHolding> {
    const shares = parseFloat(holding.shares);
    const costBasis = parseFloat(holding.avgCostPerShare);
    const positionCost = shares * costBasis;

    let currentPrice = costBasis;
    let dailyChange = 0;
    let dailyChangePercent = 0;
    let dataSource: 'live_api' | 'database_eod' | 'cost_basis' = 'cost_basis';

    let afterHoursPrice = null;

    // Priority 1: Live API data (for top positions only)
    if (liveQuotes.has(holding.symbol)) {
      const quote = liveQuotes.get(holding.symbol);
      currentPrice = quote.price;
      dailyChange = quote.change * shares;
      dailyChangePercent = quote.changePercent || 0;
      afterHoursPrice = quote.afterHoursPrice || null;
      dataSource = 'live_api';
    } else {
      // Priority 2: Database EOD prices (most holdings use this)
      const historicalPrice = await storage.getLatestHistoricalPrice(holding.symbol);
      if (historicalPrice && parseFloat(historicalPrice.closePrice) > 0) {
        currentPrice = parseFloat(historicalPrice.closePrice);
        dailyChange = parseFloat(historicalPrice.change || '0') * shares;
        dailyChangePercent = parseFloat(historicalPrice.changePercent || '0');
        dataSource = 'database_eod';
      }
      // Otherwise use cost basis (already set above)
    }

    // Use after-hours price for portfolio value calculation if available
    const effectivePrice = afterHoursPrice || currentPrice;
    const currentValue = effectivePrice * shares;
    const totalGainLoss = currentValue - positionCost;
    const totalGainLossPercent = positionCost > 0 ? (totalGainLoss / positionCost) * 100 : 0;

    return {
      ...holding,
      currentPrice,
      afterHoursPrice,
      dailyChange,
      dailyChangePercent,
      totalValue: currentValue,
      totalGainLoss,
      totalGainLossPercent,
      costBasis: positionCost,
      marketWeight: 0, // Updated later
      dataSource,
      lastUpdated: new Date()
    };
  }

  /**
   * Update market weights for all holdings
   */
  private updateMarketWeights(): void {
    const holdings = Array.from(this.holdingsCache.values());
    const totalValue = holdings.reduce((sum, h) => sum + h.totalValue, 0);

    holdings.forEach(holding => {
      holding.marketWeight = totalValue > 0 ? (holding.totalValue / totalValue) * 100 : 0;
      this.holdingsCache.set(holding.symbol, holding);
    });
  }

  /**
   * Calculate portfolio summary from cached holdings
   */
  private calculateSummary(holdings: OptimizedHolding[]): OptimizedPortfolioSummary {
    const totalValue = holdings.reduce((sum, h) => sum + h.totalValue, 0);
    const totalCost = holdings.reduce((sum, h) => sum + h.costBasis, 0);
    const dailyChange = holdings.reduce((sum, h) => sum + h.dailyChange, 0);
    const totalGainLoss = totalValue - totalCost;

    // Data quality metrics
    const liveQuotes = holdings.filter(h => h.dataSource === 'live_api').length;
    const databaseQuotes = holdings.filter(h => h.dataSource === 'database_eod').length;
    const costBasisFallback = holdings.filter(h => h.dataSource === 'cost_basis').length;

    return {
      totalValue,
      dailyChange,
      dailyChangePercent: totalValue > 0 ? (dailyChange / (totalValue - dailyChange)) * 100 : 0,
      totalGainLoss,
      totalGainLossPercent: totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0,
      holdingsCount: holdings.length,
      dataQuality: {
        liveQuotes,
        databaseQuotes,
        costBasisFallback
      },
      lastUpdated: new Date()
    };
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(): boolean {
    return Date.now() - this.lastCacheUpdate < this.CACHE_DURATION;
  }

  /**
   * Fetch single quote from FMP API
   */
  private async fetchSingleQuote(symbol: string): Promise<any | null> {
    const FMP_API_KEY = process.env.FMP_API_KEY;
    if (!FMP_API_KEY) return null;

    try {
      const response = await fetch(`https://financialmodelingprep.com/api/v3/quote/${symbol}?apikey=${FMP_API_KEY}`);
      const data = await response.json();

      if (data && Array.isArray(data) && data.length > 0 && data[0].price) {
        const quote = data[0];
        return {
          symbol: quote.symbol,
          price: quote.price,
          change: quote.change || 0,
          changePercent: quote.changesPercentage || 0
        };
      }
    } catch (error) {
      logger.error("API_ERROR", `Quote fetch failed for ${symbol}`, error);
    }

    return null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const optimizedPortfolioService = new OptimizedPortfolioService();

/**
 * Register optimized portfolio routes
 */
export function registerOptimizedRoutes(app: Express): void {
  // Optimized holdings endpoint
  app.get("/api/holdings/optimized", async (req, res) => {
    try {
      const holdings = await optimizedPortfolioService.getOptimizedHoldings();
      res.json(holdings);
    } catch (error) {
      logger.error("HOLDINGS_ERROR", "Failed to fetch optimized holdings", error);
      res.status(500).json({ message: "Failed to fetch holdings" });
    }
  });

  // Optimized portfolio summary endpoint
  app.get("/api/portfolio/summary/optimized", async (req, res) => {
    try {
      const summary = await optimizedPortfolioService.getOptimizedSummary();
      res.json(summary);
    } catch (error) {
      logger.error("SUMMARY_ERROR", "Failed to fetch optimized summary", error);
      res.status(500).json({ message: "Failed to fetch portfolio summary" });
    }
  });
}