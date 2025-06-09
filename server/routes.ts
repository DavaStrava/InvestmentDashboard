import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertHoldingSchema, insertWatchlistSchema, type StockQuote, type PortfolioSummary, type HoldingWithQuote } from "@shared/schema";
import { z } from "zod";
import { logger, validateNumeric, timeAsyncOperation } from "./logger";

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
      
      // Get real-time quote, company profile, and key metrics
      const [quoteResponse, profileResponse, metricsResponse] = await Promise.all([
        fetch(`${FMP_BASE_URL}/v3/quote/${symbol}?apikey=${FMP_API_KEY}`),
        fetch(`${FMP_BASE_URL}/v3/profile/${symbol}?apikey=${FMP_API_KEY}`),
        fetch(`${FMP_BASE_URL}/v3/key-metrics/${symbol}?period=annual&limit=1&apikey=${FMP_API_KEY}`)
      ]);
      
      const [quoteData] = await quoteResponse.json();
      const [profileData] = await profileResponse.json();
      const [metricsData] = await metricsResponse.json();
      
      logger.apiResponse(`FMP-${symbol}`, quoteResponse.status, {
        hasQuote: !!quoteData,
        hasProfile: !!profileData,
        hasMetrics: !!metricsData
      });
      
      if (!quoteData || !quoteData.price) {
        logger.warn('FMP_DATA', `No valid quote data for ${symbol}`, quoteData);
        return null;
      }
      
      const stockQuote: StockQuote = {
        symbol: quoteData.symbol,
        companyName: profileData?.companyName || quoteData.name || symbol,
        price: validateNumeric(quoteData.price, `${symbol}.price`),
        change: validateNumeric(quoteData.change, `${symbol}.change`),
        changePercent: validateNumeric(quoteData.changesPercentage, `${symbol}.changePercent`),
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
  return await fetchStockQuoteFromFMP(symbol);
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

export async function registerRoutes(app: Express): Promise<Server> {
  // Stock quote endpoint
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

  // Portfolio summary endpoint
  app.get("/api/portfolio/summary", async (req, res) => {
    try {
      const holdings = await storage.getHoldings();
      
      if (holdings.length === 0) {
        const summary: PortfolioSummary = {
          totalValue: 0,
          dailyChange: 0,
          dailyChangePercent: 0,
          totalGainLoss: 0,
          totalGainLossPercent: 0,
          holdingsCount: 0,
        };
        return res.json(summary);
      }

      let totalValue = 0;
      let totalCost = 0;
      let dailyChange = 0;

      for (const holding of holdings) {
        const quote = await fetchStockQuote(holding.symbol);
        if (quote) {
          const shares = parseFloat(holding.shares);
          const costBasis = parseFloat(holding.avgCostPerShare);
          const positionValue = quote.price * shares;
          const positionCost = costBasis * shares;
          const positionDailyChange = quote.change * shares;

          totalValue += positionValue;
          totalCost += positionCost;
          dailyChange += positionDailyChange;
        }
      }

      const totalGainLoss = totalValue - totalCost;
      const totalGainLossPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;
      const dailyChangePercent = totalValue > 0 ? (dailyChange / (totalValue - dailyChange)) * 100 : 0;

      const summary: PortfolioSummary = {
        totalValue,
        dailyChange,
        dailyChangePercent,
        totalGainLoss,
        totalGainLossPercent,
        holdingsCount: holdings.length,
      };

      res.json(summary);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch portfolio summary" });
    }
  });

  // Holdings endpoints
  app.get("/api/holdings", async (req, res) => {
    try {
      const holdings = await storage.getHoldings();
      const holdingsWithQuotes: HoldingWithQuote[] = [];

      for (const holding of holdings) {
        const quote = await fetchStockQuote(holding.symbol);
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
        }
      }

      res.json(holdingsWithQuotes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch holdings" });
    }
  });

  app.post("/api/holdings", async (req, res) => {
    try {
      const result = insertHoldingSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid holding data", errors: result.error.issues });
      }

      const holding = await storage.createHolding(result.data);
      res.status(201).json(holding);
    } catch (error) {
      res.status(500).json({ message: "Failed to create holding" });
    }
  });

  app.patch("/api/holdings/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertHoldingSchema.partial().safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ message: "Invalid holding data", errors: result.error.issues });
      }

      const holding = await storage.updateHolding(id, result.data);
      
      if (!holding) {
        return res.status(404).json({ message: "Holding not found" });
      }

      res.json(holding);
    } catch (error) {
      res.status(500).json({ message: "Failed to update holding" });
    }
  });

  app.delete("/api/holdings/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteHolding(id);
      
      if (!success) {
        return res.status(404).json({ message: "Holding not found" });
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete holding" });
    }
  });

  // Watchlist endpoints
  app.get("/api/watchlist", async (req, res) => {
    try {
      logger.info('WATCHLIST_REQUEST', 'Fetching watchlist data');
      const watchlist = await storage.getWatchlist();
      logger.debug('WATCHLIST_STORAGE', `Retrieved ${watchlist.length} items from storage`);
      
      const watchlistWithQuotes = [];

      for (const item of watchlist) {
        const quote = await fetchStockQuote(item.symbol);
        
        if (quote) {
          const enhancedItem = {
            ...item,
            currentPrice: validateNumeric(quote.price, `watchlist.${item.symbol}.currentPrice`),
            change: validateNumeric(quote.change, `watchlist.${item.symbol}.change`),
            changePercent: validateNumeric(quote.changePercent, `watchlist.${item.symbol}.changePercent`),
            dailyChange: validateNumeric(quote.change, `watchlist.${item.symbol}.dailyChange`),
            dailyChangePercent: validateNumeric(quote.changePercent, `watchlist.${item.symbol}.dailyChangePercent`),
            volume: validateNumeric(quote.volume, `watchlist.${item.symbol}.volume`),
          };
          
          logger.debug('WATCHLIST_ITEM', `Enhanced ${item.symbol}`, {
            price: enhancedItem.currentPrice,
            changePercent: enhancedItem.dailyChangePercent,
            hasNaN: isNaN(enhancedItem.dailyChangePercent)
          });
          
          watchlistWithQuotes.push(enhancedItem);
        } else {
          logger.warn('WATCHLIST_NO_QUOTE', `No quote data for ${item.symbol}`);
          watchlistWithQuotes.push({
            ...item,
            currentPrice: 0,
            change: 0,
            changePercent: 0,
            dailyChange: 0,
            dailyChangePercent: 0,
            volume: 0,
          });
        }
      }

      logger.watchlistData(watchlistWithQuotes);
      res.json(watchlistWithQuotes);
    } catch (error) {
      logger.error('WATCHLIST_ERROR', 'Failed to fetch watchlist', error);
      res.status(500).json({ message: "Failed to fetch watchlist" });
    }
  });

  app.post("/api/watchlist", async (req, res) => {
    try {
      const result = insertWatchlistSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid watchlist data", errors: result.error.issues });
      }

      // Check if symbol already exists in watchlist
      const exists = await storage.isSymbolInWatchlist(result.data.symbol);
      if (exists) {
        return res.status(409).json({ message: "Symbol already in watchlist" });
      }

      const item = await storage.createWatchlistItem(result.data);
      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ message: "Failed to add to watchlist" });
    }
  });

  app.delete("/api/watchlist/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteWatchlistItem(id);
      
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

  // AI prediction endpoint
  app.get("/api/stocks/:symbol/prediction", async (req, res) => {
    const { symbol } = req.params;
    
    try {
      // Get current quote
      const quote = await fetchStockQuote(symbol);
      if (!quote) {
        return res.status(404).json({ message: "Stock data not available" });
      }

      // Get multiple timeframes for comprehensive analysis
      const [intradayData, weeklyData, monthlyData] = await Promise.all([
        fetchHistoricalData(symbol, "1D"),
        fetchHistoricalData(symbol, "1W"), 
        fetchHistoricalData(symbol, "1M")
      ]);

      if (!intradayData || intradayData.length === 0) {
        return res.status(404).json({ message: "Historical data required for prediction" });
      }

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

      res.json(prediction);
    } catch (error) {
      console.error("Prediction error:", error);
      res.status(500).json({ message: "Failed to generate prediction" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}