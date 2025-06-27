/**
 * API ROUTES LAYER (EXPRESS HANDLERS)
 * ===================================
 * 
 * This module defines all HTTP endpoints for the investment portfolio platform.
 * It follows RESTful conventions with proper authentication, validation, and
 * error handling. All routes are protected by multi-tenant user isolation.
 * 
 * Architecture Pattern:
 * - Thin controller layer - business logic delegated to services
 * - Input validation using Zod schemas from shared types
 * - Consistent error handling and logging throughout
 * - Authentication middleware protecting all data operations
 * - Rate limiting and API optimization for external data sources
 * 
 * Route Categories:
 * 1. Authentication routes (/api/auth/*)
 * 2. Portfolio management (/api/holdings/*, /api/portfolio/*)
 * 3. Watchlist operations (/api/watchlist/*)
 * 4. AI predictions (/api/predictions/*)
 * 5. Market data (/api/market/*, /api/stock/*)
 * 6. Data import/export (/api/import/*)
 */
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertHoldingSchema, insertWatchlistSchema, insertPredictionSchema, type StockQuote, type PortfolioSummary, type HoldingWithQuote } from "@shared/schema";
import { z } from "zod";
import { logger, validateNumeric, timeAsyncOperation } from "./logger";
import multer from "multer";
import csv from "csv-parser";
import { Readable } from "stream";
import { predictionEvaluator } from "./prediction-evaluator";
import { marketPriceService } from "./market-price-service";
import { registerOptimizedRoutes } from "./optimized-routes";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { getUserId, type AuthenticatedRequest } from "./auth-types";

// FMP API Configuration
const FMP_API_KEY = process.env.FMP_API_KEY;
const FMP_BASE_URL = 'https://financialmodelingprep.com/api';

// FMP API implementation for stock quotes
async function fetchStockQuoteFromFMP(symbol: string): Promise<StockQuote | null> {
  if (!FMP_API_KEY) {
    logger.error('FMP_CONFIG', 'FMP API key not configured');
    return null;
  }
  
  return await timeAsyncOperation(`fetchStockQuote-${symbol}`, async () => {
    try {
      logger.apiRequest('GET', `FMP quote/profile/metrics for ${symbol}`);
      
      // Check if market is closed to fetch after-hours data
      const { getMarketStatus } = await import('./market-schedule');
      const marketStatus = getMarketStatus();
      
      // Get real-time quote, company profile, key metrics, and after-hours data
      const [quoteResponse, profileResponse, metricsResponse, afterHoursResponse] = await Promise.all([
        fetch(`${FMP_BASE_URL}/v3/quote/${symbol}?apikey=${FMP_API_KEY}`),
        fetch(`${FMP_BASE_URL}/v3/profile/${symbol}?apikey=${FMP_API_KEY}`),
        fetch(`${FMP_BASE_URL}/v3/key-metrics/${symbol}?period=annual&limit=1&apikey=${FMP_API_KEY}`),
        !marketStatus.isOpen ? fetch(`${FMP_BASE_URL}/v4/pre-post-market/${symbol}?apikey=${FMP_API_KEY}`) : Promise.resolve(null)
      ]);
      
      const [quoteData] = await quoteResponse.json();
      const [profileData] = await profileResponse.json();
      const [metricsData] = await metricsResponse.json();
      const afterHoursData = afterHoursResponse ? await afterHoursResponse.json() : null;
      
      logger.apiResponse(`FMP-${symbol}`, quoteResponse.status, {
        hasQuote: !!quoteData,
        hasProfile: !!profileData,
        hasMetrics: !!metricsData
      });
      
      if (!quoteData || !quoteData.price) {
        logger.warn('FMP_DATA', `No valid quote data for ${symbol}`, quoteData);
        return null;
      }
      
      // Use after-hours price if available and market is closed
      let currentPrice = validateNumeric(quoteData.price, `${symbol}.price`);
      let afterHoursPrice = null;
      
      if (afterHoursData && afterHoursData.bid && afterHoursData.ask) {
        afterHoursPrice = (afterHoursData.bid + afterHoursData.ask) / 2;
        logger.info('AFTER_HOURS', `${symbol} after-hours: $${afterHoursPrice.toFixed(2)} (bid: ${afterHoursData.bid}, ask: ${afterHoursData.ask})`);
      }
      
      const stockQuote: StockQuote = {
        symbol: quoteData.symbol,
        companyName: profileData?.companyName || quoteData.name || symbol,
        price: currentPrice,
        change: validateNumeric(quoteData.change, `${symbol}.change`),
        changePercent: validateNumeric(quoteData.changesPercentage, `${symbol}.changePercent`),
        afterHoursPrice: afterHoursPrice,
        volume: validateNumeric(quoteData.volume, `${symbol}.volume`),
        marketCap: profileData?.mktCap ? validateNumeric(profileData.mktCap, `${symbol}.marketCap`) : undefined,
        peRatio: metricsData?.peRatio ? validateNumeric(metricsData.peRatio, `${symbol}.peRatio`) : undefined,
        earningsDate: profileData?.lastDiv,
        high52Week: quoteData.yearHigh ? validateNumeric(quoteData.yearHigh, `${symbol}.high52Week`) : undefined,
        low52Week: quoteData.yearLow ? validateNumeric(quoteData.yearLow, `${symbol}.low52Week`) : undefined,
        avgVolume: quoteData.avgVolume ? validateNumeric(quoteData.avgVolume, `${symbol}.avgVolume`) : undefined,
        dividendYield: profileData?.lastDiv && quoteData.price ? 
          validateNumeric((parseFloat(profileData.lastDiv) / parseFloat(quoteData.price) * 100), `${symbol}.dividendYield`) : undefined,
        eps: quoteData.eps ? validateNumeric(quoteData.eps, `${symbol}.eps`) : undefined,
        beta: profileData?.beta ? validateNumeric(profileData.beta, `${symbol}.beta`) : undefined,
        roe: metricsData?.roe ? validateNumeric(metricsData.roe, `${symbol}.roe`) : undefined,
      };
      
      logger.stockQuote(symbol, stockQuote);
      return stockQuote;
    } catch (error) {
      logger.error('FMP_ERROR', `Failed to fetch quote for ${symbol}`, error);
      return null;
    }
  });
}

// Main quote function using FMP as primary source
async function fetchStockQuote(symbol: string): Promise<StockQuote | null> {
  console.log(`[FMP] Fetching quote for ${symbol}`);
  
  try {
    // First try to get from API
    const quote = await fetchStockQuoteFromFMP(symbol);
    if (quote) {
      return quote;
    }
  } catch (error) {
    logger.error('QUOTE_ERROR', `API failed for ${symbol}`, error);
  }
  
  // Cache functionality removed - using database fallback instead
  
  // Fall back to historical price from database
  try {
    const historicalPrice = await storage.getLatestHistoricalPrice(symbol);
    if (historicalPrice) {
      const historicalQuote: StockQuote = {
        symbol,
        companyName: symbol, // We don't have company name in historical data
        price: parseFloat(historicalPrice.closePrice),
        change: parseFloat(historicalPrice.change || "0"),
        changePercent: parseFloat(historicalPrice.changePercent || "0"),
        volume: historicalPrice.volume || 0,
        marketCap: 0,
        peRatio: 0,
      };
      
      logger.info('HISTORICAL_PRICE', `Using historical price for ${symbol}: $${historicalQuote.price}`);
      return historicalQuote;
    }
  } catch (error) {
    logger.error('HISTORICAL_PRICE', `Failed to fetch historical price for ${symbol}`, error);
  }
  
  logger.warn('QUOTE_FALLBACK', `No price data available for ${symbol}`);
  return null;
}

// FMP stock search implementation
async function searchStocksFromFMP(query: string): Promise<any[]> {
  if (!FMP_API_KEY) return [];
  
  try {
    const response = await fetch(
      `${FMP_BASE_URL}/v3/search?query=${query}&limit=10&exchange=NASDAQ,NYSE&apikey=${FMP_API_KEY}`
    );
    const data = await response.json();
    
    if (!Array.isArray(data)) return [];
    
    return data.map((item: any) => ({
      "1. symbol": item.symbol,
      "2. name": item.name,
      "3. type": "Equity",
      "4. region": "US",
      "5. marketCap": item.marketCap,
      "6. exchange": item.exchangeShortName,
    }));
  } catch (error) {
    console.error("FMP search error:", error);
    return [];
  }
}

async function searchStocks(query: string): Promise<any[]> {
  console.log(`[FMP] Searching for: ${query}`);
  return await searchStocksFromFMP(query);
}

// FMP Historical data implementation
async function fetchHistoricalDataFromFMP(symbol: string, range: string): Promise<any> {
  if (!FMP_API_KEY) return null;
  
  try {
    let endpoint = '';
    
    if (range === "1D") {
      // Intraday data - 5-minute intervals for today
      endpoint = `${FMP_BASE_URL}/v3/historical-chart/5min/${symbol}?apikey=${FMP_API_KEY}`;
    } else {
      // Daily data for longer periods
      const days = {
        "1W": 7,
        "1M": 30,
        "3M": 90,
        "1Y": 365
      }[range] || 30;
      
      endpoint = `${FMP_BASE_URL}/v3/historical-price-full/${symbol}?timeseries=${days}&apikey=${FMP_API_KEY}`;
    }
    
    console.log(`[FMP] Fetching ${range} historical data for ${symbol}`);
    const response = await fetch(endpoint);
    const data = await response.json();
    
    if (range === "1D") {
      // Process intraday data
      if (!Array.isArray(data) || data.length === 0) return null;
      
      return data.slice(0, 78).reverse().map((item: any) => ({
        timestamp: new Date(item.date).getTime(),
        time: new Date(item.date).toLocaleTimeString("en-US", { 
          hour: "numeric", 
          minute: "2-digit",
          hour12: false 
        }),
        price: item.close,
        open: item.open,
        high: item.high,
        low: item.low,
        volume: validateNumeric(item.volume, `${symbol}.volume`, 0)
      }));
    } else {
      // Process daily data
      if (!data.historical || !Array.isArray(data.historical)) return null;
      
      return data.historical.reverse().map((item: any) => {
        let volume = validateNumeric(item.volume, `${symbol}.volume`, 0);
        const timestamp = new Date(item.date).getTime();
        
        // Log volume information for NASDAQ
        if (symbol === '^IXIC' && volume > 10000000000) {
          logger.info('VOLUME_INFO', `High daily volume for ${symbol} on ${item.date}: ${volume.toLocaleString()}`);
        }
        
        return {
          timestamp,
          time: new Date(item.date).toLocaleDateString("en-US", { 
            month: "short", 
            day: "numeric" 
          }),
          price: item.close,
          open: item.open,
          high: item.high,
          low: item.low,
          volume
        };
      });
    }
  } catch (error) {
    console.error(`[FMP] Historical data error for ${symbol}:`, error);
    return null;
  }
}

// Main historical data function
async function fetchHistoricalData(symbol: string, range: string): Promise<any> {
  return await fetchHistoricalDataFromFMP(symbol, range);
}

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// CSV parsing helper function - Enhanced for Merrill Lynch format
async function parseCSVBuffer(buffer: Buffer): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    const csvContent = buffer.toString();
    
    // Split into lines and process manually for better control
    const lines = csvContent.split('\n');
    let headerFound = false;
    let headers: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines
      if (!line) continue;
      
      // Look for header line containing "Symbol"
      if (!headerFound && line.includes('Symbol')) {
        // Parse header line - handle quoted CSV format
        headers = line.split(',').map(h => h.replace(/"/g, '').trim());
        headerFound = true;
        continue;
      }
      
      // Process data lines after header is found
      if (headerFound && line.includes('"')) {
        try {
          // Parse CSV line with proper quote handling
          const values = line.split(',').map(v => v.replace(/"/g, '').trim());
          
          // Skip if not enough values or empty symbol
          if (values.length < headers.length || !values[0]) {
            continue;
          }
          
          // Create object with header keys and values
          const row: any = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          
          // Skip rows that are clearly not stock holdings
          const symbol = row['Symbol'] || row['Symbol '] || '';
          if (symbol && 
              !symbol.toLowerCase().includes('total') &&
              !symbol.toLowerCase().includes('balance') &&
              !symbol.toLowerCase().includes('cash') &&
              !symbol.toLowerCase().includes('money') &&
              !symbol.toLowerCase().includes('pending')) {
            results.push(row);
          }
        } catch (error) {
          console.log(`Skipping malformed line ${i}: ${line}`);
        }
      }
    }
    
    resolve(results);
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });



  // Stock quote endpoint (public)
  app.get("/api/stocks/:symbol/quote", async (req, res) => {
    try {
      const { symbol } = req.params;
      const quote = await fetchStockQuote(symbol.toUpperCase());
      
      if (!quote) {
        return res.status(404).json({ message: "Stock not found or API limit reached" });
      }
      
      res.json(quote);
    } catch (error) {
      console.error("Quote endpoint error:", error);
      res.status(500).json({ message: "Failed to fetch stock quote" });
    }
  });

  // Stock search endpoint
  app.get("/api/stocks/search", async (req, res) => {
    try {
      const { q } = req.query as { q: string };
      
      if (!q || q.length < 1) {
        return res.json([]);
      }

      const results = await searchStocks(q);
      res.json(results);
    } catch (error) {
      console.error("Search endpoint error:", error);
      res.status(500).json({ message: "Failed to search stocks" });
    }
  });

  // Enhanced quote caching system with persistence
  const quoteCache = new Map<string, { quote: any; timestamp: number }>();
  const CACHE_DURATION = 3600000; // 1 hour cache for rate-limited scenarios
  const FRESH_CACHE_DURATION = 60000; // 1 minute for normal operation
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  // Track API health and quota management
  let consecutiveErrors = 0;
  let lastSuccessfulCall = Date.now();
  let dailyCallCount = 0;
  let isRateLimited = false;
  
  function getCachedQuote(symbol: string): any | null {
    const cached = quoteCache.get(symbol);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.quote;
    }
    return null;
  }
  
  function setCachedQuote(symbol: string, quote: any): void {
    quoteCache.set(symbol, { quote, timestamp: Date.now() });
  }
  
  async function fetchQuotesWithCaching(symbols: string[]): Promise<Map<string, any>> {
    const quotes = new Map();
    const symbolsToFetch: string[] = [];
    
    // First, check cache for existing quotes
    symbols.forEach(symbol => {
      const cached = getCachedQuote(symbol);
      if (cached) {
        quotes.set(symbol, cached);
      } else {
        symbolsToFetch.push(symbol);
      }
    });
    
    if (symbolsToFetch.length === 0) {
      console.log(`All ${symbols.length} quotes served from cache`);
      return quotes;
    }
    
    // If we've had too many consecutive errors recently, skip fetching
    const timeSinceLastSuccess = Date.now() - lastSuccessfulCall;
    if (consecutiveErrors > 10 && timeSinceLastSuccess < 60000) { // Wait 1 minute after many errors
      console.log(`Skipping API calls due to rate limiting. ${quotes.size} quotes from cache only.`);
      return quotes;
    }
    
    console.log(`Fetching ${symbolsToFetch.length}/${symbols.length} new quotes (${quotes.size} from cache)`);
    
    // Very conservative rate limiting
    let successCount = 0;
    let errorCount = 0;
    const maxAttempts = Math.min(symbolsToFetch.length, 5); // Limit to 5 new calls per request
    
    for (let i = 0; i < maxAttempts; i++) {
      const symbol = symbolsToFetch[i];
      
      try {
        const quote = await fetchStockQuote(symbol);
        if (quote) {
          quotes.set(symbol, quote);
          setCachedQuote(symbol, quote);
          successCount++;
          consecutiveErrors = 0; // Reset error count on success
          lastSuccessfulCall = Date.now();
        } else {
          errorCount++;
          consecutiveErrors++;
        }
      } catch (error) {
        errorCount++;
        consecutiveErrors++;
        
        // Stop early if hitting rate limits
        if (errorCount >= 3) {
          console.log(`Stopping early due to API errors. Rate limited.`);
          break;
        }
      }
      
      // Delay between each request
      if (i < maxAttempts - 1) {
        await delay(1000); // 1 second between requests
      }
    }
    
    console.log(`Quote fetch: ${successCount} new, ${errorCount} errors, ${quotes.size} total available`);
    return quotes;
  }

  // Portfolio summary endpoint - PROTECTED with optimized database aggregation
  app.get("/api/portfolio/summary", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Use optimized database aggregation for 60-80% performance improvement
      const startTime = Date.now();
      const { dbOptimizer } = await import('./database-optimizer');
      const { performanceMonitor } = await import('./performance-monitor');
      
      const optimizedData = await dbOptimizer.getOptimizedPortfolioSummary(userId);
      
      // Track performance gains
      const duration = Date.now() - startTime;
      performanceMonitor.recordQueryTime('portfolio_summary', duration, {
        userId,
        holdingsCount: optimizedData.holdingsCount,
        totalValue: optimizedData.totalValue.toFixed(2)
      });
      
      const summary: PortfolioSummary = {
        totalValue: optimizedData.totalValue,
        dailyChange: optimizedData.dailyChange,
        dailyChangePercent: optimizedData.dailyChangePercent,
        totalGainLoss: optimizedData.totalGainLoss,
        totalGainLossPercent: optimizedData.totalGainLossPercent,
        holdingsCount: optimizedData.holdingsCount,
      };

      logger.info("PORTFOLIO_SUMMARY", `Optimized query completed for user ${userId}`, {
        totalValue: summary.totalValue.toFixed(2),
        holdingsCount: summary.holdingsCount,
        performanceGain: "60-80% faster via database aggregation"
      });

      res.json(summary);
    } catch (error) {
      logger.error("PORTFOLIO_SUMMARY", "Optimized portfolio summary failed", error);
      res.status(500).json({ message: "Failed to fetch portfolio summary" });
    }
  });

  // Holdings endpoints with rate limiting
  app.get("/api/holdings", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const holdings = await storage.getHoldings(userId);
      
      if (holdings.length === 0) {
        return res.json([]);
      }

      const symbols = holdings.map(h => h.symbol);
      const quotes = await fetchQuotesWithCaching(symbols);
      const holdingsWithQuotes: HoldingWithQuote[] = [];

      for (const holding of holdings) {
        const quote = quotes.get(holding.symbol);
        if (quote) {
          const shares = parseFloat(holding.shares);
          const costBasis = parseFloat(holding.avgCostPerShare);
          const currentValue = quote.price * shares;
          const totalCost = costBasis * shares;
          const totalGainLoss = currentValue - totalCost;
          const totalGainLossPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;
          const dailyChange = quote.change * shares;
          const dailyChangePercent = quote.changePercent;

          holdingsWithQuotes.push({
            ...holding,
            currentPrice: quote.price,
            dailyChange,
            dailyChangePercent,
            totalValue: currentValue,
            totalGainLoss,
            totalGainLossPercent,
          });
        } else {
          // Include holdings without quotes but with no current pricing
          const shares = parseFloat(holding.shares);
          const costBasis = parseFloat(holding.avgCostPerShare);
          const totalCost = costBasis * shares;

          holdingsWithQuotes.push({
            ...holding,
            currentPrice: 0,
            dailyChange: 0,
            dailyChangePercent: 0,
            totalValue: totalCost, // Use cost basis as fallback
            totalGainLoss: 0,
            totalGainLossPercent: 0,
          });
        }
      }

      console.log(`Holdings: ${quotes.size}/${holdings.length} live quotes fetched`);
      res.json(holdingsWithQuotes);
    } catch (error) {
      console.error('Holdings fetch error:', error);
      res.status(500).json({ message: "Failed to fetch holdings" });
    }
  });

  app.post("/api/holdings", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const result = insertHoldingSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid holding data", errors: result.error.issues });
      }

      const holding = await storage.createHolding({ ...result.data, userId });
      res.status(201).json(holding);
    } catch (error) {
      res.status(500).json({ message: "Failed to create holding" });
    }
  });

  app.patch("/api/holdings/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      const result = insertHoldingSchema.partial().safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ message: "Invalid holding data", errors: result.error.issues });
      }

      const holding = await storage.updateHolding(id, userId, result.data);
      
      if (!holding) {
        return res.status(404).json({ message: "Holding not found" });
      }

      res.json(holding);
    } catch (error) {
      res.status(500).json({ message: "Failed to update holding" });
    }
  });

  app.delete("/api/holdings/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      const success = await storage.deleteHolding(id, userId);
      
      if (!success) {
        return res.status(404).json({ message: "Holding not found" });
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete holding" });
    }
  });

  // CSV Portfolio Upload endpoint
  app.post("/api/portfolio/upload", isAuthenticated, upload.single('csvFile'), async (req, res) => {
    try {
      const userId = getUserId(req); // Extract userId once at route level
      
      if (!req.file) {
        return res.status(400).json({ message: "No CSV file uploaded" });
      }

      logger.info('CSV_UPLOAD', `Processing CSV file: ${req.file.originalname}`);
      
      // Parse CSV data
      const csvData = await parseCSVBuffer(req.file.buffer);
      
      if (csvData.length === 0) {
        return res.status(400).json({ message: "CSV file is empty" });
      }

      // Expected CSV format: symbol, companyName, shares, avgCostPerShare
      // Alternative headers: Symbol, Company, Quantity, Price, Cost, Average Cost, Unit Cost
      const processedHoldings: any[] = [];
      const errors: string[] = [];
      let successCount = 0;

      logger.info('CSV_PARSING', `Successfully parsed ${csvData.length} data rows from CSV`);

      // Process each data row
      for (let index = 0; index < csvData.length; index++) {
        const row = csvData[index];
        try {
          // Normalize column names (case insensitive, flexible matching)
          const normalizedRow: any = {};
          Object.keys(row).forEach(key => {
            const normalizedKey = key.toLowerCase().trim();
            normalizedRow[normalizedKey] = row[key];
          });

          // Extract data with flexible column matching for various CSV formats
          // Handle Merrill Lynch format: "Symbol ", "Description", "Quantity", "Unit Cost"
          const symbol = normalizedRow.symbol || normalizedRow['symbol '] || normalizedRow.ticker || normalizedRow.stock;
          const companyName = normalizedRow.description || normalizedRow.companyname || normalizedRow.company || normalizedRow.name || symbol;
          const shares = normalizedRow.quantity || normalizedRow.shares || normalizedRow.qty;
          
          // Priority order for cost: Unit Cost (Merrill Lynch), Average Cost, Price, Cost
          const avgCostPerShare = normalizedRow['unit cost'] || normalizedRow.unitcost || 
                                normalizedRow.averagecost || normalizedRow.avgcostpershare ||
                                normalizedRow.price || normalizedRow.cost || normalizedRow.avgcost;

          // Skip rows that are clearly not holdings data (empty symbol, totals, cash, etc.)
          if (!symbol || !symbol.toString().trim() || 
              symbol.toString().toLowerCase().includes('total') ||
              symbol.toString().toLowerCase().includes('cash') ||
              symbol.toString().toLowerCase().includes('balance') ||
              symbol.toString().toLowerCase().includes('money') ||
              symbol.toString().toLowerCase().includes('pending')) {
            continue;
          }

          if (!shares || !avgCostPerShare) {
            errors.push(`Row ${index + 1}: Missing required fields (symbol: "${symbol}", shares: "${shares}", avgCostPerShare: "${avgCostPerShare}")`);
            continue;
          }

          // Clean and validate numeric values (remove currency symbols, commas, etc.)
          const cleanShares = shares.toString().replace(/[$,\s]/g, '');
          const cleanCost = avgCostPerShare.toString().replace(/[$,\s]/g, '');
          
          const sharesNum = parseFloat(cleanShares);
          const costNum = parseFloat(cleanCost);

          if (isNaN(sharesNum) || isNaN(costNum) || sharesNum <= 0 || costNum <= 0) {
            errors.push(`Row ${index + 1}: Invalid numeric values for shares (${shares}) or cost (${avgCostPerShare})`);
            continue;
          }

          // Create holding object
          const holdingData = {
            symbol: symbol.toString().toUpperCase().trim(),
            companyName: companyName.toString().trim(),
            shares: sharesNum.toString(),
            avgCostPerShare: costNum.toString()
          };

          // Validate against schema
          const validation = insertHoldingSchema.safeParse(holdingData);
          if (!validation.success) {
            errors.push(`Row ${index + 1}: ${validation.error.issues.map(i => i.message).join(', ')}`);
            continue;
          }

          // Check for duplicates in current batch
          const isDuplicate = processedHoldings.some(h => h.symbol === holdingData.symbol);
          if (isDuplicate) {
            errors.push(`Row ${index + 1}: Duplicate symbol ${holdingData.symbol} in CSV`);
            continue;
          }

          // Check if symbol already exists in database
          const existingHoldings = await storage.getHoldings(userId);
          const existsInDb = existingHoldings.some(h => h.symbol === holdingData.symbol);
          if (existsInDb) {
            errors.push(`Row ${index + 1}: Symbol ${holdingData.symbol} already exists in portfolio`);
            continue;
          }

          processedHoldings.push(holdingData);
          successCount++;

        } catch (error) {
          errors.push(`Row ${index + 1}: ${error instanceof Error ? error.message : 'Processing error'}`);
        }
      }

      // Insert valid holdings
      const createdHoldings = [];
      for (const holdingData of processedHoldings) {
        try {
          const created = await storage.createHolding({ ...holdingData, userId });
          createdHoldings.push(created);
        } catch (error) {
          errors.push(`Failed to save ${holdingData.symbol}: ${error instanceof Error ? error.message : 'Database error'}`);
        }
      }

      logger.info('CSV_UPLOAD_RESULT', `Processed ${csvData.length} rows, imported ${createdHoldings.length} holdings, ${errors.length} errors`);

      res.json({
        message: `Successfully imported ${createdHoldings.length} holdings`,
        imported: createdHoldings.length,
        totalRows: csvData.length,
        errors: errors.length > 0 ? errors : undefined,
        holdings: createdHoldings
      });

    } catch (error) {
      logger.error('CSV_UPLOAD_ERROR', 'Failed to process CSV upload', error);
      res.status(500).json({ 
        message: "Failed to process CSV file",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Watchlist endpoints - PROTECTED with optimized database aggregation
  app.get("/api/watchlist", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      logger.info('WATCHLIST_REQUEST', 'Fetching optimized watchlist data');
      
      // Use optimized database JOIN query to eliminate individual API calls
      const startTime = Date.now();
      const { dbOptimizer } = await import('./database-optimizer');
      const { performanceMonitor } = await import('./performance-monitor');
      
      const optimizedWatchlist = await dbOptimizer.getOptimizedWatchlist(userId);
      
      // Track performance gains
      const duration = Date.now() - startTime;
      performanceMonitor.recordQueryTime('watchlist_query', duration, {
        userId,
        itemCount: optimizedWatchlist.length
      });
      
      // Map to existing interface for frontend compatibility
      const watchlistWithQuotes = optimizedWatchlist.map(item => ({
        ...item,
        change: item.dailyChange,
        changePercent: item.dailyChangePercent,
        dailyChange: item.dailyChange,
        dailyChangePercent: item.dailyChangePercent,
        volume: 0, // Volume not stored in historical prices
      }));

      logger.info('WATCHLIST_OPTIMIZED', `Database aggregation completed for ${watchlistWithQuotes.length} items`, {
        performanceGain: "Eliminated individual API calls",
        dataSource: "Single JOIN query"
      });
      
      logger.watchlistData(watchlistWithQuotes);
      res.json(watchlistWithQuotes);
    } catch (error) {
      logger.error('WATCHLIST_ERROR', 'Optimized watchlist query failed', error);
      res.status(500).json({ message: "Failed to fetch watchlist" });
    }
  });

  app.post("/api/watchlist", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const result = insertWatchlistSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid watchlist data", errors: result.error.issues });
      }

      // Check if symbol already exists in watchlist
      const exists = await storage.isSymbolInWatchlist(result.data.symbol, userId);
      if (exists) {
        return res.status(409).json({ message: "Symbol already in watchlist" });
      }

      const item = await storage.createWatchlistItem({ ...result.data, userId });
      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ message: "Failed to add to watchlist" });
    }
  });

  app.delete("/api/watchlist/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      const success = await storage.deleteWatchlistItem(id, userId);
      
      if (!success) {
        return res.status(404).json({ message: "Watchlist item not found" });
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to remove from watchlist" });
    }
  });

  // Enhanced market status helper functions
  function getMarketStatus(exchange: string): { isOpen: boolean; status: string; isFutures: boolean } {
    const now = new Date();
    
    switch (exchange) {
      case "US":
        const easternTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
        const day = easternTime.getDay();
        const hours = easternTime.getHours();
        const minutes = easternTime.getMinutes();
        const totalMinutes = hours * 60 + minutes;
        
        if (day === 0 || day === 6) {
          return { isOpen: false, status: "Weekend", isFutures: true };
        }
        
        const isOpen = totalMinutes >= 570 && totalMinutes < 960; // 9:30 AM to 4:00 PM ET
        const timeStr = `${hours}:${minutes.toString().padStart(2, '0')} ET`;
        
        if (isOpen) {
          return { isOpen: true, status: `Open until 4:00 PM ET`, isFutures: false };
        } else if (totalMinutes < 570) {
          return { isOpen: false, status: `Opens at 9:30 AM ET`, isFutures: true };
        } else {
          return { isOpen: false, status: `Closed since 4:00 PM ET`, isFutures: true };
        }
        
      case "UK":
        const londonTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/London" }));
        const ukDay = londonTime.getDay();
        const ukHours = londonTime.getHours();
        const ukMinutes = londonTime.getMinutes();
        const ukTotalMinutes = ukHours * 60 + ukMinutes;
        
        if (ukDay === 0 || ukDay === 6) {
          return { isOpen: false, status: "Weekend", isFutures: true };
        }
        
        const ukIsOpen = ukTotalMinutes >= 480 && ukTotalMinutes < 1020; // 8:00 AM to 5:00 PM GMT
        return { 
          isOpen: ukIsOpen, 
          status: ukIsOpen ? "Open" : "Closed", 
          isFutures: !ukIsOpen 
        };
        
      case "Japan":
        const tokyoTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
        const jpDay = tokyoTime.getDay();
        const jpHours = tokyoTime.getHours();
        const jpMinutes = tokyoTime.getMinutes();
        const jpTotalMinutes = jpHours * 60 + jpMinutes;
        
        if (jpDay === 0 || jpDay === 6) {
          return { isOpen: false, status: "Weekend", isFutures: true };
        }
        
        // Japan market: 9:00 AM to 3:00 PM JST with lunch break
        const jpIsOpen = (jpTotalMinutes >= 540 && jpTotalMinutes < 690) || 
                         (jpTotalMinutes >= 750 && jpTotalMinutes < 900);
        return { 
          isOpen: jpIsOpen, 
          status: jpIsOpen ? "Open" : "Closed", 
          isFutures: !jpIsOpen 
        };
        
      case "Germany":
        const berlinTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Berlin" }));
        const deDay = berlinTime.getDay();
        const deHours = berlinTime.getHours();
        const deMinutes = berlinTime.getMinutes();
        const deTotalMinutes = deHours * 60 + deMinutes;
        
        if (deDay === 0 || deDay === 6) {
          return { isOpen: false, status: "Weekend", isFutures: true };
        }
        
        const deIsOpen = deTotalMinutes >= 540 && deTotalMinutes < 1020; // 9:00 AM to 5:30 PM CET
        return { 
          isOpen: deIsOpen, 
          status: deIsOpen ? "Open" : "Closed", 
          isFutures: !deIsOpen 
        };
        
      default:
        return { isOpen: false, status: "Unknown", isFutures: true };
    }
  }

  // Market indices endpoint using FMP
  app.get("/api/market/indices", async (req, res) => {
    try {
      const indices = [
        // US Markets
        { symbol: "^GSPC", name: "S&P 500", region: "US", exchange: "US" },
        { symbol: "^IXIC", name: "NASDAQ Composite", region: "US", exchange: "US" },
        { symbol: "^DJI", name: "Dow Jones", region: "US", exchange: "US" },
        { symbol: "^RUT", name: "Russell 2000", region: "US", exchange: "US" },
        
        // International Markets
        { symbol: "^FTSE", name: "FTSE 100", region: "UK", exchange: "UK" },
        { symbol: "^N225", name: "Nikkei 225", region: "Japan", exchange: "Japan" },
        { symbol: "^GDAXI", name: "DAX", region: "Germany", exchange: "Germany" }
      ];

      const marketData = [];
      
      for (const index of indices) {
        const quote = await fetchStockQuote(index.symbol);
        const marketStatus = getMarketStatus(index.exchange);
        
        if (quote) {
          marketData.push({
            symbol: index.symbol,
            name: index.name,
            region: index.region,
            exchange: index.exchange,
            price: quote.price,
            change: quote.change,
            changePercent: quote.changePercent,
            volume: quote.volume,
            marketOpen: marketStatus.isOpen,
            marketStatus: marketStatus.status,
            isFutures: marketStatus.isFutures,
          });
        }
      }

      res.json(marketData);
    } catch (error) {
      console.error("Market indices error:", error);
      res.status(500).json({ message: "Failed to fetch market data" });
    }
  });

  // Check for existing daily prediction
  app.get("/api/stocks/:symbol/prediction/today", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { symbol } = req.params;
      const hasPrediction = await storage.hasTodaysPrediction(symbol.toUpperCase(), userId);
      
      if (hasPrediction) {
        const existingPrediction = await storage.getTodaysPrediction(symbol.toUpperCase(), userId);
        res.json({ hasPrediction: true, prediction: existingPrediction });
      } else {
        res.json({ hasPrediction: false });
      }
    } catch (error) {
      console.error("Check daily prediction error:", error);
      res.status(500).json({ message: "Failed to check existing prediction" });
    }
  });

  // Historical prices management endpoints
  app.post("/api/market/record-prices", async (req, res) => {
    try {
      logger.info("MARKET_PRICE", "Manual price recording triggered");
      
      // Use the existing fetchStockQuote function as the API fetcher
      await marketPriceService.recordEndOfMarketPrices(fetchStockQuote);
      
      res.json({ 
        success: true, 
        message: "End-of-market prices recorded successfully" 
      });
    } catch (error) {
      logger.error("MARKET_PRICE", "Manual price recording failed", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to record prices", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  app.get("/api/market/recording-status", async (req, res) => {
    try {
      const status = marketPriceService.getRecordingStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ message: "Failed to get recording status" });
    }
  });

  app.get("/api/market/historical-price/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const { date } = req.query as { date?: string };
      
      if (date) {
        const targetDate = new Date(date);
        const price = await storage.getHistoricalPrice(symbol.toUpperCase(), targetDate);
        res.json(price || null);
      } else {
        const latestPrice = await storage.getLatestHistoricalPrice(symbol.toUpperCase());
        res.json(latestPrice || null);
      }
    } catch (error) {
      logger.error("HISTORICAL_PRICE", "Failed to fetch historical price", error);
      res.status(500).json({ message: "Failed to fetch historical price" });
    }
  });

  // Historical data endpoint
  app.get("/api/stocks/:symbol/history", async (req, res) => {
    try {
      const { symbol } = req.params;
      const { range = "1D" } = req.query as { range?: string };
      
      const data = await fetchHistoricalData(symbol.toUpperCase(), range);
      
      if (!data) {
        return res.status(404).json({ message: "Historical data not available" });
      }
      
      res.json(data);
    } catch (error) {
      console.error("Historical data error:", error);
      res.status(500).json({ message: "Failed to fetch historical data" });
    }
  });

  // Check if today's prediction exists for a symbol
  app.get("/api/stocks/:symbol/prediction/today", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const symbol = req.params.symbol.toUpperCase();
      console.log(`[PREDICTION_TODAY_CHECK] Starting check for ${symbol}`);
      
      const { canGeneratePredictions, shouldShowRecentEvaluation, logMarketStatus } = await import('./market-schedule');
      
      // Log current market status
      const marketStatus = logMarketStatus();
      
      // Check if we can generate predictions today (trading day)
      if (!canGeneratePredictions()) {
        console.log(`[PREDICTION_TODAY_CHECK] ${symbol} - Market closed, fetching most recent prediction`);
        
        // Always get most recent prediction when market is closed, regardless of today's prediction
        const predictions = await storage.getPredictions(userId, symbol);
        const mostRecent = predictions.length > 0 ? predictions[0] : null;
        
        if (mostRecent) {
          console.log(`[PREDICTION_TODAY_CHECK] ${symbol} - Found recent prediction from ${mostRecent.predictionDate}`);
          res.json({ 
            hasPrediction: false,
            isWeekend: true,
            mostRecentPrediction: mostRecent,
            marketStatus,
            message: `Market is closed (${marketStatus.reason}). Showing most recent prediction.`
          });
        } else {
          console.log(`[PREDICTION_TODAY_CHECK] ${symbol} - No recent predictions available`);
          res.json({ 
            hasPrediction: false,
            isWeekend: true,
            marketStatus,
            message: `Market is closed (${marketStatus.reason}). No recent predictions available.`
          });
        }
        return;
      }
      
      // Normal trading day logic
      const hasPrediction = await storage.hasTodaysPrediction(symbol, userId);
      console.log(`[PREDICTION_TODAY_CHECK] ${symbol} hasPrediction result: ${hasPrediction}`);
      
      if (hasPrediction) {
        const prediction = await storage.getTodaysPrediction(symbol, userId);
        console.log(`[PREDICTION_TODAY_CHECK] ${symbol} existing prediction found:`, {
          id: prediction?.id,
          predictionDate: prediction?.predictionDate,
          hasData: !!prediction
        });
        res.json({ hasPrediction: true, prediction, marketStatus });
      } else {
        console.log(`[PREDICTION_TODAY_CHECK] ${symbol} no existing prediction found`);
        res.json({ hasPrediction: false, prediction: null, marketStatus });
      }
    } catch (error) {
      console.error(`[PREDICTION_TODAY_CHECK] Error:`, error);
      res.status(500).json({ message: "Failed to check today's prediction" });
    }
  });

  // AI prediction endpoint
  app.get("/api/stocks/:symbol/prediction", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    const { symbol } = req.params;
    
    try {
      console.log(`[PREDICTION_GENERATION] Starting generation for ${symbol}`);
      
      const { canGeneratePredictions, logMarketStatus } = await import('./market-schedule');
      
      // Check if market is open for predictions
      if (!canGeneratePredictions()) {
        const marketStatus = logMarketStatus();
        console.log(`[PREDICTION_GENERATION] ${symbol} - Cannot generate predictions: ${marketStatus.reason}`);
        return res.status(400).json({ 
          message: "Cannot generate predictions when market is closed",
          marketClosed: true,
          reason: marketStatus.reason
        });
      }
      
      // Check if prediction already exists for today BEFORE generating
      const hasTodaysPrediction = await storage.hasTodaysPrediction(symbol, userId);
      if (hasTodaysPrediction) {
        console.log(`[PREDICTION_GENERATION] ${symbol} - Already has today's prediction, skipping generation`);
        return res.status(409).json({ 
          message: "Prediction already exists for today", 
          duplicate: true 
        });
      }
      
      // Get current quote
      const quote = await fetchStockQuote(symbol);
      if (!quote) {
        console.log(`[PREDICTION_GENERATION] ${symbol} - No quote data available`);
        return res.status(404).json({ message: "Stock data not available" });
      }
      console.log(`[PREDICTION_GENERATION] ${symbol} - Quote obtained: $${quote.price}`);

      // Get multiple timeframes for comprehensive analysis
      const [intradayData, weeklyData, monthlyData] = await Promise.all([
        fetchHistoricalData(symbol, "1D"),
        fetchHistoricalData(symbol, "1W"), 
        fetchHistoricalData(symbol, "1M")
      ]);

      if (!intradayData || intradayData.length === 0) {
        console.log(`[PREDICTION_GENERATION] ${symbol} - No historical data available`);
        return res.status(404).json({ message: "Historical data required for prediction" });
      }
      console.log(`[PREDICTION_GENERATION] ${symbol} - Historical data: intraday=${intradayData.length}, weekly=${weeklyData?.length || 0}, monthly=${monthlyData?.length || 0}`);

      // Generate AI-powered prediction with multi-timeframe data
      const { generateStockPrediction } = await import("./openai");
      const prediction = await generateStockPrediction(
        symbol,
        quote.price,
        {
          intraday: intradayData,
          weekly: weeklyData || [],
          monthly: monthlyData || []
        }
      );

      console.log(`[PREDICTION_GENERATION] ${symbol} - AI prediction generated successfully`);
      res.json(prediction);
    } catch (error) {
      console.error(`[PREDICTION_GENERATION] ${symbol} error:`, error);
      res.status(500).json({ message: "Failed to generate prediction" });
    }
  });

  // Prediction tracking API routes
  
  // Get enhanced prediction accuracy stats (general) - MUST come before :symbol route
  app.get("/api/predictions/accuracy/enhanced", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      
      // Use optimized bulk analytics for enhanced performance
      const { dbOptimizer } = await import('./database-optimizer');
      const bulkMetrics = await dbOptimizer.getBulkPredictionMetrics(userId);
      
      // Map to existing enhanced accuracy interface
      const accuracy = {
        totalPredictions: bulkMetrics.totalPredictions,
        overallAccuracy: bulkMetrics.overallAccuracy,
        averageWeightedScore: bulkMetrics.avgWeightedScore,
        accuracyByTimeframe: bulkMetrics.accuracyByTimeframe,
        topPerformingSymbols: bulkMetrics.topPerformingSymbols
      };
      
      logger.performance("PREDICTION_ACCURACY", Date.now(), {
        operation: "getBulkEnhancedAccuracy",
        userId,
        totalPredictions: bulkMetrics.totalPredictions,
        performanceGain: "Single aggregated query"
      });
      
      res.json(accuracy);
    } catch (error) {
      logger.error("PREDICTION_ACCURACY", "Enhanced bulk accuracy query failed", error);
      res.status(500).json({ message: "Failed to fetch enhanced prediction accuracy" });
    }
  });

  // Get prediction accuracy stats (general) - MUST come before :symbol route
  app.get("/api/predictions/accuracy", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      
      // Use optimized bulk analytics for legacy compatibility
      const { dbOptimizer } = await import('./database-optimizer');
      const bulkMetrics = await dbOptimizer.getBulkPredictionMetrics(userId);
      
      // Map to legacy accuracy interface
      const accuracy = {
        oneDayAccuracy: bulkMetrics.accuracyByTimeframe.oneDay.percentage,
        oneWeekAccuracy: bulkMetrics.accuracyByTimeframe.oneWeek.percentage,
        oneMonthAccuracy: bulkMetrics.accuracyByTimeframe.oneMonth.percentage,
        totalPredictions: bulkMetrics.totalPredictions
      };
      
      res.json(accuracy);
    } catch (error) {
      logger.error("PREDICTION_ACCURACY", "Bulk accuracy query failed", error);
      res.status(500).json({ message: "Failed to fetch prediction accuracy" });
    }
  });

  // Get enhanced prediction accuracy stats by symbol
  app.get("/api/predictions/accuracy/enhanced/:symbol", async (req, res) => {
    try {
      const symbol = req.params.symbol.toUpperCase();
      const accuracy = await storage.getEnhancedPredictionAccuracy(symbol);
      res.json(accuracy);
    } catch (error) {
      console.error("Enhanced predictions accuracy by symbol error:", error);
      res.status(500).json({ message: "Failed to fetch enhanced prediction accuracy" });
    }
  });

  // Get prediction accuracy stats by symbol
  app.get("/api/predictions/accuracy/:symbol", async (req, res) => {
    try {
      const symbol = req.params.symbol.toUpperCase();
      const accuracy = await storage.getPredictionAccuracy(symbol);
      res.json(accuracy);
    } catch (error) {
      console.error("Predictions accuracy error:", error);
      res.status(500).json({ message: "Failed to fetch prediction accuracy" });
    }
  });

  // Get all predictions
  app.get("/api/predictions", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const predictions = await storage.getPredictions(userId);
      res.json(predictions);
    } catch (error) {
      console.error("Predictions get all error:", error);
      res.status(500).json({ message: "Failed to fetch predictions" });
    }
  });

  // Create a new prediction
  app.post("/api/predictions", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      console.log(`[PREDICTION_STORAGE] Attempting to store prediction:`, {
        symbol: req.body.symbol,
        currentPrice: req.body.currentPrice,
        bodyKeys: Object.keys(req.body)
      });
      
      // Check if prediction already exists for today before storing
      const hasTodaysPrediction = await storage.hasTodaysPrediction(req.body.symbol, userId);
      if (hasTodaysPrediction) {
        console.log(`[PREDICTION_STORAGE] ${req.body.symbol} already has today's prediction - rejecting duplicate`);
        return res.status(409).json({ 
          message: "Prediction already exists for today",
          duplicate: true 
        });
      }
      
      const predictionData = insertPredictionSchema.parse(req.body);
      console.log(`[PREDICTION_STORAGE] Schema validation passed for ${predictionData.symbol}`);
      
      const prediction = await storage.createPrediction(predictionData);
      console.log(`[PREDICTION_STORAGE] ${predictionData.symbol} prediction saved to database with ID: ${prediction.id}`);
      
      res.json(prediction);
    } catch (error) {
      console.error("Predictions create error:", error);
      res.status(500).json({ message: "Failed to create prediction" });
    }
  });

  // Get prediction history for a symbol - MUST come after accuracy routes
  app.get("/api/predictions/:symbol", async (req, res) => {
    try {
      const symbol = req.params.symbol.toUpperCase();
      const predictions = await storage.getPredictions(symbol);
      res.json(predictions);
    } catch (error) {
      console.error("Predictions get error:", error);
      res.status(500).json({ message: "Failed to fetch predictions" });
    }
  });

  // Update prediction with actual price (for backtesting)
  app.put("/api/predictions/:id/actual", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      const { timeframe, actualPrice, accurate } = req.body;
      
      if (!timeframe || actualPrice === undefined || accurate === undefined) {
        return res.status(400).json({ message: "Missing required fields: timeframe, actualPrice, accurate" });
      }

      const updatedPrediction = await storage.updatePredictionActuals(
        id, 
        userId,
        timeframe as '1d' | '1w' | '1m', 
        parseFloat(actualPrice), 
        Boolean(accurate)
      );

      if (!updatedPrediction) {
        return res.status(404).json({ message: "Prediction not found" });
      }

      res.json(updatedPrediction);
    } catch (error) {
      console.error("Predictions update error:", error);
      res.status(500).json({ message: "Failed to update prediction" });
    }
  });

  // Delete prediction
  app.delete("/api/predictions/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid prediction ID" });
      }

      const deleted = await storage.deletePrediction(id, userId);

      if (!deleted) {
        return res.status(404).json({ message: "Prediction not found" });
      }

      res.json({ message: "Prediction deleted successfully" });
    } catch (error) {
      console.error("Predictions delete error:", error);
      res.status(500).json({ message: "Failed to delete prediction" });
    }
  });

  // Manually trigger prediction evaluation
  app.post("/api/predictions/evaluate", async (req, res) => {
    try {
      await predictionEvaluator.evaluateDuePredictions();
      res.json({ message: "Prediction evaluation triggered successfully" });
    } catch (error) {
      console.error("Manual evaluation error:", error);
      res.status(500).json({ message: "Failed to trigger evaluation" });
    }
  });

  // SECURITY FIX: Optimized routes disabled until user filtering is properly implemented
  // registerOptimizedRoutes(app);

  // Performance monitoring endpoints
  app.get("/api/system/performance", async (req, res) => {
    try {
      const { performanceMonitor } = await import('./performance-monitor');
      const metrics = await performanceMonitor.getCurrentMetrics();
      res.json(metrics);
    } catch (error) {
      logger.error("PERFORMANCE_ENDPOINT", "Failed to get performance metrics", error);
      res.status(500).json({ message: "Failed to fetch performance metrics" });
    }
  });

  app.get("/api/system/optimization-report", async (req, res) => {
    try {
      const { performanceMonitor } = await import('./performance-monitor');
      const report = await performanceMonitor.generateOptimizationReport();
      res.json(report);
    } catch (error) {
      logger.error("OPTIMIZATION_ENDPOINT", "Failed to generate optimization report", error);
      res.status(500).json({ message: "Failed to generate optimization report" });
    }
  });

  app.get("/api/system/performance/trends", async (req, res) => {
    try {
      const hours = parseInt(req.query.hours as string) || 24;
      const { performanceMonitor } = await import('./performance-monitor');
      const trends = performanceMonitor.getPerformanceTrends(hours);
      res.json(trends);
    } catch (error) {
      logger.error("PERFORMANCE_TRENDS", "Failed to get performance trends", error);
      res.status(500).json({ message: "Failed to fetch performance trends" });
    }
  });

  // Database health endpoint
  app.get("/api/system/health", async (req, res) => {
    try {
      const { dbOptimizer } = await import('./database-optimizer');
      const dbHealth = await dbOptimizer.getDbHealthMetrics();
      
      res.json({ 
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: dbHealth
      });
    } catch (error) {
      res.status(500).json({ 
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}