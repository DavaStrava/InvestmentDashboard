import { storage } from "./storage";
import { logger } from "./logger";

interface EnhancedHolding {
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
  priceMovement: 'up' | 'down' | 'flat';
  volatilityIndicator: 'high' | 'medium' | 'low';
  lastUpdated: Date;
  dataSource: 'live' | 'cached' | 'database';
}

interface PortfolioMetrics {
  totalValue: number;
  dailyChange: number;
  dailyChangePercent: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  holdingsCount: number;
  topPerformers: EnhancedHolding[];
  underperformers: EnhancedHolding[];
  sectorAllocation: { [key: string]: number };
  riskMetrics: {
    portfolioVolatility: number;
    diversificationScore: number;
    concentrationRisk: number;
  };
}

export class EnhancedHoldingsService {
  private cachedHoldings: Map<string, EnhancedHolding> = new Map();
  private cachedPortfolioMetrics: PortfolioMetrics | null = null;
  private lastFullRefresh: number = 0;
  private readonly CACHE_DURATION = 300000; // 5 minutes
  private readonly STALE_THRESHOLD = 600000; // 10 minutes for stale data

  /**
   * Get enhanced holdings with minimal API calls using intelligent caching
   */
  async getEnhancedHoldings(forceRefresh: boolean = false): Promise<EnhancedHolding[]> {
    const now = Date.now();
    const needsRefresh = forceRefresh || 
                        (now - this.lastFullRefresh > this.CACHE_DURATION) ||
                        this.cachedHoldings.size === 0;

    if (!needsRefresh) {
      logger.info("HOLDINGS_CACHE", "Serving from cache", { count: this.cachedHoldings.size });
      return Array.from(this.cachedHoldings.values());
    }

    logger.info("HOLDINGS_REFRESH", "Refreshing holdings data");
    
    try {
      const rawHoldings = await storage.getHoldings();
      if (rawHoldings.length === 0) {
        return [];
      }

      // Get fresh market data for critical symbols only
      const criticalSymbols = this.identifyCriticalSymbols(rawHoldings);
      const freshQuotes = await this.fetchCriticalQuotes(criticalSymbols);
      
      // Use historical prices for non-critical symbols
      const enhancedHoldings = await this.enhanceHoldingsData(rawHoldings, freshQuotes);
      
      // Update cache
      this.cachedHoldings.clear();
      enhancedHoldings.forEach(holding => {
        this.cachedHoldings.set(holding.symbol, holding);
      });
      
      this.lastFullRefresh = now;
      logger.info("HOLDINGS_ENHANCED", "Cache updated", { 
        total: enhancedHoldings.length,
        fresh: Object.keys(freshQuotes).length,
        cached: enhancedHoldings.length - Object.keys(freshQuotes).length
      });

      return enhancedHoldings;
    } catch (error) {
      logger.error("HOLDINGS_ERROR", "Failed to refresh holdings", error);
      return Array.from(this.cachedHoldings.values()); // Return stale cache on error
    }
  }

  /**
   * Get comprehensive portfolio metrics with cached calculations
   */
  async getPortfolioMetrics(forceRefresh: boolean = false): Promise<PortfolioMetrics> {
    const holdings = await this.getEnhancedHoldings(forceRefresh);
    
    if (!forceRefresh && this.cachedPortfolioMetrics) {
      return this.cachedPortfolioMetrics;
    }

    const metrics = this.calculatePortfolioMetrics(holdings);
    this.cachedPortfolioMetrics = metrics;
    
    return metrics;
  }

  /**
   * Identify which symbols need fresh API data (largest positions, biggest movers)
   */
  private identifyCriticalSymbols(holdings: any[]): string[] {
    const totalValue = holdings.reduce((sum, h) => {
      const shares = parseFloat(h.shares);
      const price = parseFloat(h.avgCostPerShare); // Use cost basis for initial calculation
      return sum + (shares * price);
    }, 0);

    // Sort by position size and select top 10 for live updates
    const sortedByValue = holdings
      .map(h => ({
        symbol: h.symbol,
        value: parseFloat(h.shares) * parseFloat(h.avgCostPerShare),
        weight: (parseFloat(h.shares) * parseFloat(h.avgCostPerShare)) / totalValue
      }))
      .sort((a, b) => b.value - a.value);

    // Always refresh top 10 positions or positions > 5% weight
    const critical = sortedByValue
      .filter((_, index) => index < 10 || sortedByValue[index].weight > 0.05)
      .map(h => h.symbol);

    return critical;
  }

  /**
   * Fetch market data only for critical symbols to minimize API usage
   */
  private async fetchCriticalQuotes(symbols: string[]): Promise<{ [symbol: string]: any }> {
    const quotes: { [symbol: string]: any } = {};
    
    // Use existing cached quote system with rate limiting
    for (const symbol of symbols.slice(0, 5)) { // Limit to 5 API calls max
      try {
        const quote = await this.fetchSingleQuote(symbol);
        if (quote) {
          quotes[symbol] = quote;
        }
      } catch (error) {
        logger.warn("QUOTE_FETCH", `Failed to fetch ${symbol}`, error);
      }
    }

    return quotes;
  }

  /**
   * Enhanced data processing with database fallback
   */
  private async enhanceHoldingsData(rawHoldings: any[], freshQuotes: { [symbol: string]: any }): Promise<EnhancedHolding[]> {
    const enhanced: EnhancedHolding[] = [];
    const totalPortfolioValue = await this.calculateTotalValue(rawHoldings, freshQuotes);

    for (const holding of rawHoldings) {
      const shares = parseFloat(holding.shares);
      const costBasis = parseFloat(holding.avgCostPerShare);
      const positionCost = shares * costBasis;

      let currentPrice = costBasis; // Default fallback
      let dailyChange = 0;
      let dailyChangePercent = 0;
      let dataSource: 'live' | 'cached' | 'database' = 'database';

      // Try fresh quote first
      if (freshQuotes[holding.symbol]) {
        const quote = freshQuotes[holding.symbol];
        currentPrice = quote.price;
        dailyChange = quote.change * shares;
        dailyChangePercent = quote.changePercent;
        dataSource = 'live';
      } else {
        // Fallback to database historical price
        const historicalPrice = await storage.getLatestHistoricalPrice(holding.symbol);
        if (historicalPrice) {
          currentPrice = parseFloat(historicalPrice.closePrice);
          dailyChange = parseFloat(historicalPrice.change || '0') * shares;
          dailyChangePercent = parseFloat(historicalPrice.changePercent || '0');
          dataSource = 'database';
        }
      }

      const currentValue = currentPrice * shares;
      const totalGainLoss = currentValue - positionCost;
      const totalGainLossPercent = positionCost > 0 ? (totalGainLoss / positionCost) * 100 : 0;
      const marketWeight = totalPortfolioValue > 0 ? (currentValue / totalPortfolioValue) * 100 : 0;

      enhanced.push({
        ...holding,
        id: holding.id,
        currentPrice,
        dailyChange,
        dailyChangePercent,
        totalValue: currentValue,
        totalGainLoss,
        totalGainLossPercent,
        costBasis: positionCost,
        marketWeight,
        priceMovement: dailyChangePercent > 0.1 ? 'up' : dailyChangePercent < -0.1 ? 'down' : 'flat',
        volatilityIndicator: Math.abs(dailyChangePercent) > 3 ? 'high' : Math.abs(dailyChangePercent) > 1 ? 'medium' : 'low',
        lastUpdated: new Date(),
        dataSource
      });
    }

    return enhanced;
  }

  /**
   * Calculate total portfolio value using mixed data sources
   */
  private async calculateTotalValue(holdings: any[], freshQuotes: { [symbol: string]: any }): Promise<number> {
    let total = 0;

    for (const holding of holdings) {
      const shares = parseFloat(holding.shares);
      let price = parseFloat(holding.avgCostPerShare); // Fallback to cost basis

      if (freshQuotes[holding.symbol]) {
        price = freshQuotes[holding.symbol].price;
      } else {
        const historicalPrice = await storage.getLatestHistoricalPrice(holding.symbol);
        if (historicalPrice) {
          price = parseFloat(historicalPrice.closePrice);
        }
      }

      total += shares * price;
    }

    return total;
  }

  /**
   * Calculate comprehensive portfolio metrics
   */
  private calculatePortfolioMetrics(holdings: EnhancedHolding[]): PortfolioMetrics {
    const totalValue = holdings.reduce((sum, h) => sum + h.totalValue, 0);
    const totalCost = holdings.reduce((sum, h) => sum + h.costBasis, 0);
    const dailyChange = holdings.reduce((sum, h) => sum + h.dailyChange, 0);
    const totalGainLoss = totalValue - totalCost;

    // Performance analysis
    const sorted = [...holdings].sort((a, b) => b.totalGainLossPercent - a.totalGainLossPercent);
    const topPerformers = sorted.slice(0, 3);
    const underperformers = sorted.slice(-3);

    // Risk metrics
    const weights = holdings.map(h => h.marketWeight / 100);
    const concentrationRisk = Math.max(...weights) * 100;
    const diversificationScore = 100 - concentrationRisk;

    return {
      totalValue,
      dailyChange,
      dailyChangePercent: totalValue > 0 ? (dailyChange / (totalValue - dailyChange)) * 100 : 0,
      totalGainLoss,
      totalGainLossPercent: totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0,
      holdingsCount: holdings.length,
      topPerformers,
      underperformers,
      sectorAllocation: this.calculateSectorAllocation(holdings),
      riskMetrics: {
        portfolioVolatility: this.calculateVolatility(holdings),
        diversificationScore,
        concentrationRisk
      }
    };
  }

  private calculateSectorAllocation(holdings: EnhancedHolding[]): { [key: string]: number } {
    // Simplified sector allocation based on symbol patterns
    const sectors: { [key: string]: number } = {};
    const totalValue = holdings.reduce((sum, h) => sum + h.totalValue, 0);

    holdings.forEach(holding => {
      const sector = this.inferSector(holding.symbol);
      sectors[sector] = (sectors[sector] || 0) + (holding.totalValue / totalValue) * 100;
    });

    return sectors;
  }

  private inferSector(symbol: string): string {
    // Basic sector inference - can be enhanced with real sector data
    const techSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'NFLX', 'ADBE', 'CRM', 'ASML'];
    const financialSymbols = ['JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'USB', 'PNC', 'TFC', 'COF'];
    
    if (techSymbols.includes(symbol)) return 'Technology';
    if (financialSymbols.includes(symbol)) return 'Financial';
    return 'Other';
  }

  private calculateVolatility(holdings: EnhancedHolding[]): number {
    const changes = holdings.map(h => h.dailyChangePercent);
    const avg = changes.reduce((sum, c) => sum + c, 0) / changes.length;
    const variance = changes.reduce((sum, c) => sum + Math.pow(c - avg, 2), 0) / changes.length;
    return Math.sqrt(variance);
  }

  private async fetchSingleQuote(symbol: string): Promise<any | null> {
    // Use the existing fetchStockQuote function with rate limiting
    // This would be imported from the main routes file
    return null; // Placeholder - implement actual quote fetching
  }
}

export const enhancedHoldingsService = new EnhancedHoldingsService();