import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertHoldingSchema, insertWatchlistSchema, type StockQuote, type PortfolioSummary, type HoldingWithQuote } from "@shared/schema";
import { z } from "zod";

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY || process.env.VITE_ALPHA_VANTAGE_API_KEY || "demo";

async function fetchStockQuote(symbol: string): Promise<StockQuote | null> {
  try {
    // Real-time quote
    const quoteResponse = await fetch(
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`
    );
    const quoteData = await quoteResponse.json();
    
    if (quoteData["Error Message"] || quoteData["Note"]) {
      return null;
    }

    const quote = quoteData["Global Quote"];
    if (!quote) return null;

    // Company overview for additional metrics
    const overviewResponse = await fetch(
      `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`
    );
    const overviewData = await overviewResponse.json();

    const price = parseFloat(quote["05. price"]);
    const change = parseFloat(quote["09. change"]);
    const changePercent = parseFloat(quote["10. change percent"].replace("%", ""));

    return {
      symbol: quote["01. symbol"],
      companyName: overviewData.Name || symbol,
      price,
      change,
      changePercent,
      volume: parseInt(quote["06. volume"]) || 0,
      marketCap: overviewData.MarketCapitalization ? parseInt(overviewData.MarketCapitalization) : undefined,
      peRatio: overviewData.PERatio ? parseFloat(overviewData.PERatio) : undefined,
      earningsDate: overviewData.QuarterlyEarningsGrowthYOY || undefined,
      high52Week: overviewData["52WeekHigh"] ? parseFloat(overviewData["52WeekHigh"]) : undefined,
      low52Week: overviewData["52WeekLow"] ? parseFloat(overviewData["52WeekLow"]) : undefined,
      dividendYield: overviewData.DividendYield ? parseFloat(overviewData.DividendYield) : undefined,
      eps: overviewData.EPS ? parseFloat(overviewData.EPS) : undefined,
      beta: overviewData.Beta ? parseFloat(overviewData.Beta) : undefined,
      roe: overviewData.ReturnOnEquityTTM ? parseFloat(overviewData.ReturnOnEquityTTM) : undefined,
    };
  } catch (error) {
    console.error(`Error fetching quote for ${symbol}:`, error);
    return null;
  }
}

async function searchStocks(query: string): Promise<any[]> {
  try {
    const response = await fetch(
      `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${query}&apikey=${ALPHA_VANTAGE_API_KEY}`
    );
    const data = await response.json();
    
    if (data["Error Message"] || data["Note"]) {
      return [];
    }

    return data["bestMatches"] || [];
  } catch (error) {
    console.error("Error searching stocks:", error);
    return [];
  }
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
      res.status(500).json({ message: "Failed to fetch stock quote" });
    }
  });

  // Stock search endpoint
  app.get("/api/stocks/search", async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== "string") {
        return res.status(400).json({ message: "Query parameter 'q' is required" });
      }
      
      const results = await searchStocks(q);
      res.json(results);
    } catch (error) {
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
          const totalValue = quote.price * shares;
          const totalCost = costBasis * shares;
          const totalGainLoss = totalValue - totalCost;
          const totalGainLossPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

          holdingsWithQuotes.push({
            ...holding,
            currentPrice: quote.price,
            dailyChange: quote.change,
            dailyChangePercent: quote.changePercent,
            totalValue,
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
      const validatedData = insertHoldingSchema.parse(req.body);
      
      // Verify the stock exists
      const quote = await fetchStockQuote(validatedData.symbol);
      if (!quote) {
        return res.status(400).json({ message: "Invalid stock symbol" });
      }

      const holding = await storage.createHolding({
        ...validatedData,
        companyName: quote.companyName,
      });
      
      res.status(201).json(holding);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create holding" });
    }
  });

  app.put("/api/holdings/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertHoldingSchema.partial().parse(req.body);
      
      const holding = await storage.updateHolding(id, validatedData);
      if (!holding) {
        return res.status(404).json({ message: "Holding not found" });
      }
      
      res.json(holding);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update holding" });
    }
  });

  app.delete("/api/holdings/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteHolding(id);
      
      if (!deleted) {
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
            currentPrice: quote.price,
            dailyChange: quote.change,
            dailyChangePercent: quote.changePercent,
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
      const validatedData = insertWatchlistSchema.parse(req.body);
      
      // Verify the stock exists
      const quote = await fetchStockQuote(validatedData.symbol);
      if (!quote) {
        return res.status(400).json({ message: "Invalid stock symbol" });
      }

      // Check if already in watchlist
      const exists = await storage.isSymbolInWatchlist(validatedData.symbol);
      if (exists) {
        return res.status(400).json({ message: "Stock already in watchlist" });
      }

      const item = await storage.createWatchlistItem({
        ...validatedData,
        companyName: quote.companyName,
      });
      
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to add to watchlist" });
    }
  });

  app.delete("/api/watchlist/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteWatchlistItem(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Watchlist item not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to remove from watchlist" });
    }
  });

  // Market data endpoint
  app.get("/api/market/indices", async (req, res) => {
    try {
      const indices = ["SPY", "QQQ", "DIA"]; // S&P 500, NASDAQ, Dow Jones ETFs
      const marketData = [];

      for (const symbol of indices) {
        const quote = await fetchStockQuote(symbol);
        if (quote) {
          let name = symbol;
          if (symbol === "SPY") name = "S&P 500";
          else if (symbol === "QQQ") name = "NASDAQ";
          else if (symbol === "DIA") name = "Dow Jones";

          marketData.push({
            symbol,
            name,
            price: quote.price,
            change: quote.change,
            changePercent: quote.changePercent,
          });
        }
      }

      res.json(marketData);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch market data" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
