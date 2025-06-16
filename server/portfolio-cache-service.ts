import { storage } from "./storage";
import { logger } from "./logger";

interface CachedHoldingData {
  id: number;
  symbol: string;
  companyName: string;
  shares: string;
  avgCostPerShare: string;
  currentPrice: number;
  dailyChange: number;
  dailyChangePercent: number;
  totalValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  costBasis: number;
  marketWeight: number;
  lastUpdated: Date;
  dataSource: 'live_api' | 'database_eod' | 'cost_basis';
  isStale: boolean;
}

interface PortfolioSummaryCache {
  totalValue: number;
  dailyChange: number;
  dailyChangePercent: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  holdingsCount: number;
  dataFreshness: {
    liveQuotes: number;
    databaseQuotes: number;
    costBasisFallback: number;
  };
  lastUpdated: Date;
}

export class PortfolioCacheService {
  private holdingsCache: Map<string, CachedHoldingData> = new Map();
  private summaryCache: PortfolioSummaryCache | null = null;
  private lastCacheUpdate: number = 0;
  private readonly CACHE_VALIDITY = 300000; // 5 minutes
  private readonly MAX_API_CALLS_PER_UPDATE = 8; // Conservative API usage

  /**
   * Get optimized holdings data with minimal API calls
   */
  async getOptimizedHoldings(): Promise<CachedHoldingData[]> {
    const now = Date.now();
    
    if (this.isCacheValid() && this.holdingsCache.size > 0) {
      logger.info("PORTFOLIO_CACHE", "Serving from cache", { 
        count: this.holdingsCache.size,
        age: Math.round((now - this.lastCacheUpdate) / 1000) + "s"
      });
      return Array.from(this.holdingsCache.values());
    }

    logger.info("PORTFOLIO_REFRESH", "Refreshing portfolio cache");
    await this.refreshHoldingsCache();
    return Array.from(this.holdingsCache.values());
  }

  /**
   * Get cached portfolio summary
   */
  async getPortfolioSummary(): Promise<PortfolioSummaryCache> {
    if (this.isCacheValid() && this.summaryCache) {
      return this.summaryCache;
    }

    const holdings = await this.getOptimizedHoldings();
    this.summaryCache = this.calculateSummaryFromHoldings(holdings);
    return this.summaryCache;
  }

  /**
   * Force refresh specific symbols (for user interactions)
   */
  async refreshSymbols(symbols: string[]): Promise<void> {
    const limitedSymbols = symbols.slice(0, this.MAX_API_CALLS_PER_UPDATE);
    
    for (const symbol of limitedSymbols) {
      try {
        const freshQuote = await this.fetchSingleQuote(symbol);
        if (freshQuote && this.holdingsCache.has(symbol)) {
          const cached = this.holdingsCache.get(symbol)!;
          const updated = this.updateHoldingWithQuote(cached, freshQuote);
          this.holdingsCache.set(symbol, updated);
        }
      } catch (error) {
        logger.warn("SYMBOL_REFRESH", `Failed to refresh ${symbol}`, error);
      }
    }

    // Recalculate summary
    this.summaryCache = this.calculateSummaryFromHoldings(Array.from(this.holdingsCache.values()));
  }

  /**
   * Main cache refresh logic with intelligent data sourcing
   */
  private async refreshHoldingsCache(): Promise<void> {
    const rawHoldings = await storage.getHoldings();
    if (rawHoldings.length === 0) {
      this.holdingsCache.clear();
      this.summaryCache = null;
      return;
    }

    // Strategy: Get live quotes for top positions, use database for others
    const prioritizedSymbols = this.prioritizeSymbolsForLiveData(rawHoldings);
    const liveQuotes = await this.fetchPriorityQuotes(prioritizedSymbols);
    
    // Process all holdings with mixed data sources
    this.holdingsCache.clear();
    
    for (const holding of rawHoldings) {
      const cachedData = await this.processHolding(holding, liveQuotes);
      this.holdingsCache.set(holding.symbol, cachedData);
    }

    this.lastCacheUpdate = Date.now();
    
    const stats = this.getCacheStats();
    logger.info("CACHE_REFRESHED", "Portfolio cache updated", stats);
  }

  /**
   * Prioritize which symbols get live API calls based on portfolio weight
   */
  private prioritizeSymbolsForLiveData(holdings: any[]): string[] {
    const totalCost = holdings.reduce((sum, h) => {
      return sum + (parseFloat(h.shares) * parseFloat(h.avgCostPerShare));
    }, 0);

    // Calculate position weights and prioritize
    const weighted = holdings.map(h => {
      const positionValue = parseFloat(h.shares) * parseFloat(h.avgCostPerShare);
      return {
        symbol: h.symbol,
        weight: positionValue / totalCost,
        value: positionValue
      };
    });

    // Get top positions by weight (top 25% of portfolio value)
    const sorted = weighted.sort((a, b) => b.weight - a.weight);
    const topPositions = sorted.filter(p => p.weight > 0.03 || sorted.indexOf(p) < 8);
    
    return topPositions.map(p => p.symbol);
  }

  /**
   * Fetch live quotes for priority symbols only
   */
  private async fetchPriorityQuotes(symbols: string[]): Promise<Map<string, any>> {
    const quotes = new Map();
    const maxCalls = Math.min(symbols.length, this.MAX_API_CALLS_PER_UPDATE);
    
    logger.info("LIVE_QUOTES", `Fetching ${maxCalls} priority quotes`, { symbols: symbols.slice(0, maxCalls) });

    for (let i = 0; i < maxCalls; i++) {
      const symbol = symbols[i];
      try {
        const quote = await this.fetchSingleQuote(symbol);
        if (quote) {
          quotes.set(symbol, quote);
          await this.delay(500); // Rate limiting
        }
      } catch (error) {
        logger.warn("QUOTE_FETCH", `Failed ${symbol}`, error);
      }
    }

    return quotes;
  }

  /**
   * Process individual holding with best available data source
   */
  private async processHolding(holding: any, liveQuotes: Map<string, any>): Promise<CachedHoldingData> {
    const shares = parseFloat(holding.shares);
    const costBasis = parseFloat(holding.avgCostPerShare);
    const positionCost = shares * costBasis;

    let currentPrice = costBasis;
    let dailyChange = 0;
    let dailyChangePercent = 0;
    let dataSource: 'live_api' | 'database_eod' | 'cost_basis' = 'cost_basis';

    // Priority 1: Live API data
    if (liveQuotes.has(holding.symbol)) {
      const quote = liveQuotes.get(holding.symbol);
      currentPrice = quote.price;
      dailyChange = quote.change * shares;
      dailyChangePercent = quote.changePercent;
      dataSource = 'live_api';
    } else {
      // Priority 2: Database EOD prices
      const historicalPrice = await storage.getLatestHistoricalPrice(holding.symbol);
      if (historicalPrice && parseFloat(historicalPrice.closePrice) > 0) {
        currentPrice = parseFloat(historicalPrice.closePrice);
        dailyChange = parseFloat(historicalPrice.change || '0') * shares;
        dailyChangePercent = parseFloat(historicalPrice.changePercent || '0');
        dataSource = 'database_eod';
      }
      // Fallback to cost basis is already set above
    }

    const currentValue = currentPrice * shares;
    const totalGainLoss = currentValue - positionCost;
    const totalGainLossPercent = positionCost > 0 ? (totalGainLoss / positionCost) * 100 : 0;

    return {
      ...holding,
      currentPrice,
      dailyChange,
      dailyChangePercent,
      totalValue: currentValue,
      totalGainLoss,
      totalGainLossPercent,
      costBasis: positionCost,
      marketWeight: 0, // Will be calculated after all holdings are processed
      lastUpdated: new Date(),
      dataSource,
      isStale: dataSource === 'cost_basis'
    };
  }

  /**
   * Update market weights after all holdings are processed
   */
  private updateMarketWeights(holdings: CachedHoldingData[]): void {
    const totalValue = holdings.reduce((sum, h) => sum + h.totalValue, 0);
    
    holdings.forEach(holding => {
      holding.marketWeight = totalValue > 0 ? (holding.totalValue / totalValue) * 100 : 0;
    });
  }

  /**
   * Calculate portfolio summary from cached holdings
   */
  private calculateSummaryFromHoldings(holdings: CachedHoldingData[]): PortfolioSummaryCache {
    this.updateMarketWeights(holdings);

    const totalValue = holdings.reduce((sum, h) => sum + h.totalValue, 0);
    const totalCost = holdings.reduce((sum, h) => sum + h.costBasis, 0);
    const dailyChange = holdings.reduce((sum, h) => sum + h.dailyChange, 0);
    const totalGainLoss = totalValue - totalCost;

    // Data source statistics
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
      dataFreshness: {
        liveQuotes,
        databaseQuotes,
        costBasisFallback
      },
      lastUpdated: new Date()
    };
  }

  /**
   * Update a specific holding with fresh quote data
   */
  private updateHoldingWithQuote(holding: CachedHoldingData, quote: any): CachedHoldingData {
    const shares = parseFloat(holding.shares);
    const currentPrice = quote.price;
    const dailyChange = quote.change * shares;
    const dailyChangePercent = quote.changePercent;
    const currentValue = currentPrice * shares;
    const totalGainLoss = currentValue - holding.costBasis;
    const totalGainLossPercent = holding.costBasis > 0 ? (totalGainLoss / holding.costBasis) * 100 : 0;

    return {
      ...holding,
      currentPrice,
      dailyChange,
      dailyChangePercent,
      totalValue: currentValue,
      totalGainLoss,
      totalGainLossPercent,
      lastUpdated: new Date(),
      dataSource: 'live_api',
      isStale: false
    };
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(): boolean {
    return Date.now() - this.lastCacheUpdate < this.CACHE_VALIDITY;
  }

  /**
   * Get cache statistics for monitoring
   */
  private getCacheStats() {
    const holdings = Array.from(this.holdingsCache.values());
    return {
      totalHoldings: holdings.length,
      liveData: holdings.filter(h => h.dataSource === 'live_api').length,
      databaseData: holdings.filter(h => h.dataSource === 'database_eod').length,
      fallbackData: holdings.filter(h => h.dataSource === 'cost_basis').length,
      cacheAge: Math.round((Date.now() - this.lastCacheUpdate) / 1000)
    };
  }

  /**
   * Placeholder for single quote fetching - to be connected to existing API
   */
  private async fetchSingleQuote(symbol: string): Promise<any | null> {
    // This will be connected to the existing FMP quote fetching logic
    // For now, return null to use database fallback
    return null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const portfolioCacheService = new PortfolioCacheService();