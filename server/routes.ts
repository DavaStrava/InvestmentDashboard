import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertHoldingSchema, insertWatchlistSchema, type StockQuote, type PortfolioSummary, type HoldingWithQuote } from "@shared/schema";
import { z } from "zod";

// FMP API Configuration
const FMP_API_KEY = process.env.FMP_API_KEY;
const FMP_BASE_URL = 'https://financialmodelingprep.com/api';

// FMP API implementation for stock quotes
async function fetchStockQuoteFromFMP(symbol: string): Promise<StockQuote | null> {
  if (!FMP_API_KEY) return null;
  
  try {
    // Get real-time quote, company profile, and key metrics
    const [quoteResponse, profileResponse, metricsResponse] = await Promise.all([
      fetch(`${FMP_BASE_URL}/v3/quote/${symbol}?apikey=${FMP_API_KEY}`),
      fetch(`${FMP_BASE_URL}/v3/profile/${symbol}?apikey=${FMP_API_KEY}`),
      fetch(`${FMP_BASE_URL}/v3/key-metrics/${symbol}?period=annual&limit=1&apikey=${FMP_API_KEY}`)
    ]);
    
    const [quoteData] = await quoteResponse.json();
    const [profileData] = await profileResponse.json();
    const [metricsData] = await metricsResponse.json();
    
    if (!quoteData || !quoteData.price) return null;
    
    return {
      symbol: quoteData.symbol,
      companyName: profileData?.companyName || quoteData.name || symbol,
      price: quoteData.price,
      change: quoteData.change || 0,
      changePercent: quoteData.changesPercentage || 0,
      volume: quoteData.volume || 0,
      marketCap: profileData?.mktCap,
      peRatio: metricsData?.peRatio,
      earningsDate: profileData?.lastDiv,
      high52Week: quoteData.yearHigh,
      low52Week: quoteData.yearLow,
      avgVolume: quoteData.avgVolume,
      dividendYield: profileData?.lastDiv ? (profileData.lastDiv / quoteData.price * 100) : undefined,
      eps: quoteData.eps,
      beta: profileData?.beta,
      roe: metricsData?.roe,
    };
  } catch (error) {
    console.error(`FMP error for ${symbol}:`, error);
    return null;
  }
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
        volume: item.volume
      }));
    } else {
      // Process daily data
      if (!data.historical || !Array.isArray(data.historical)) return null;
      
      return data.historical.reverse().map((item: any) => ({
        timestamp: new Date(item.date).getTime(),
        time: new Date(item.date).toLocaleDateString("en-US", { 
          month: "short", 
          day: "numeric" 
        }),
        price: item.close,
        open: item.open,
        high: item.high,
        low: item.low,
        volume: item.volume
      }));
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
      const watchlist = await storage.getWatchlist();
      const watchlistWithQuotes = [];

      for (const item of watchlist) {
        const quote = await fetchStockQuote(item.symbol);
        if (quote) {
          watchlistWithQuotes.push({
            ...item,
            currentPrice: quote.price || 0,
            change: quote.change || 0,
            changePercent: quote.changePercent || 0,
            volume: quote.volume || 0,
          });
        } else {
          watchlistWithQuotes.push({
            ...item,
            currentPrice: 0,
            change: 0,
            changePercent: 0,
            volume: 0,
          });
        }
      }

      res.json(watchlistWithQuotes);
    } catch (error) {
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

  // Market indices endpoint using FMP
  app.get("/api/market/indices", async (req, res) => {
    try {
      const indices = [
        { symbol: "SPY", name: "S&P 500" },
        { symbol: "QQQ", name: "NASDAQ-100" },
        { symbol: "IWM", name: "Russell 2000" },
        { symbol: "VTI", name: "Total Stock Market" }
      ];

      const marketData = [];
      for (const index of indices) {
        const quote = await fetchStockQuote(index.symbol);
        if (quote) {
          marketData.push({
            symbol: index.symbol,
            name: index.name,
            price: quote.price,
            change: quote.change,
            changePercent: quote.changePercent,
            volume: quote.volume,
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