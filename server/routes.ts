import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertHoldingSchema, insertWatchlistSchema, type StockQuote, type PortfolioSummary, type HoldingWithQuote } from "@shared/schema";
import { z } from "zod";

// API Configuration - supports multiple providers
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY;
const POLYGON_API_KEY = process.env.POLYGON_API_KEY;

// Finnhub API implementation
async function fetchStockQuoteFromFinnhub(symbol: string): Promise<StockQuote | null> {
  if (!FINNHUB_API_KEY) return null;
  
  try {
    const [quoteResponse, profileResponse] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`),
      fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_API_KEY}`)
    ]);
    
    const quoteData = await quoteResponse.json();
    const profileData = await profileResponse.json();
    
    if (quoteData.error || !quoteData.c) return null;
    
    const price = quoteData.c;
    const change = quoteData.d || 0;
    const changePercent = quoteData.dp || 0;
    
    return {
      symbol: symbol.toUpperCase(),
      companyName: profileData.name || symbol,
      price,
      change,
      changePercent,
      volume: quoteData.v || 0,
      marketCap: profileData.marketCapitalization,
      peRatio: undefined,
      earningsDate: undefined,
      high52Week: quoteData.h,
      low52Week: quoteData.l,
      dividendYield: undefined,
      eps: undefined,
      beta: undefined,
      roe: undefined,
    };
  } catch (error) {
    console.error(`Finnhub error for ${symbol}:`, error);
    return null;
  }
}

// Twelve Data API implementation  
async function fetchStockQuoteFromTwelveData(symbol: string): Promise<StockQuote | null> {
  if (!TWELVE_DATA_API_KEY) return null;
  
  try {
    const response = await fetch(
      `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${TWELVE_DATA_API_KEY}`
    );
    const data = await response.json();
    
    if (data.status === "error" || !data.close) return null;
    
    const price = parseFloat(data.close);
    const change = parseFloat(data.change) || 0;
    const changePercent = parseFloat(data.percent_change) || 0;
    
    return {
      symbol: data.symbol || symbol.toUpperCase(),
      companyName: data.name || symbol,
      price,
      change,
      changePercent,
      volume: parseInt(data.volume) || 0,
      marketCap: undefined,
      peRatio: undefined,
      earningsDate: undefined,
      high52Week: parseFloat(data.fifty_two_week?.high) || undefined,
      low52Week: parseFloat(data.fifty_two_week?.low) || undefined,
      dividendYield: undefined,
      eps: undefined,
      beta: undefined,
      roe: undefined,
    };
  } catch (error) {
    console.error(`Twelve Data error for ${symbol}:`, error);
    return null;
  }
}

// Alpha Vantage API implementation (existing)
async function fetchStockQuoteFromAlphaVantage(symbol: string): Promise<StockQuote | null> {
  if (!ALPHA_VANTAGE_API_KEY) return null;
  
  try {
    const quoteResponse = await fetch(
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`
    );
    const quoteData = await quoteResponse.json();
    
    if (quoteData["Error Message"] || quoteData["Note"] || quoteData["Information"]) {
      return null;
    }

    const quote = quoteData["Global Quote"];
    if (!quote) return null;

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
    console.error(`Alpha Vantage error for ${symbol}:`, error);
    return null;
  }
}

// Main quote function that tries multiple providers
async function fetchStockQuote(symbol: string): Promise<StockQuote | null> {
  // Try providers in order of preference
  const providers = [
    fetchStockQuoteFromFinnhub,
    fetchStockQuoteFromTwelveData,
    fetchStockQuoteFromAlphaVantage
  ];
  
  for (const provider of providers) {
    try {
      const result = await provider(symbol);
      if (result) return result;
    } catch (error) {
      console.error(`Provider failed for ${symbol}:`, error);
      continue;
    }
  }
  
  return null;
}

// Search implementation for multiple providers
async function searchStocksFromFinnhub(query: string): Promise<any[]> {
  if (!FINNHUB_API_KEY) return [];
  
  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/search?q=${query}&token=${FINNHUB_API_KEY}`
    );
    const data = await response.json();
    
    if (data.error) return [];
    
    return (data.result || []).map((item: any) => ({
      "1. symbol": item.symbol,
      "2. name": item.description,
      "3. type": item.type,
      "4. region": "US",
    }));
  } catch (error) {
    console.error("Finnhub search error:", error);
    return [];
  }
}

async function searchStocksFromTwelveData(query: string): Promise<any[]> {
  if (!TWELVE_DATA_API_KEY) return [];
  
  try {
    const response = await fetch(
      `https://api.twelvedata.com/symbol_search?symbol=${query}&apikey=${TWELVE_DATA_API_KEY}`
    );
    const data = await response.json();
    
    if (data.status === "error") return [];
    
    return (data.data || []).map((item: any) => ({
      "1. symbol": item.symbol,
      "2. name": item.instrument_name,
      "3. type": item.instrument_type,
      "4. region": item.country,
    }));
  } catch (error) {
    console.error("Twelve Data search error:", error);
    return [];
  }
}

async function searchStocksFromAlphaVantage(query: string): Promise<any[]> {
  if (!ALPHA_VANTAGE_API_KEY) return [];
  
  try {
    const response = await fetch(
      `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${query}&apikey=${ALPHA_VANTAGE_API_KEY}`
    );
    const data = await response.json();
    
    if (data["Error Message"] || data["Note"] || data["Information"]) {
      return [];
    }

    return data["bestMatches"] || [];
  } catch (error) {
    console.error("Alpha Vantage search error:", error);
    return [];
  }
}

async function searchStocks(query: string): Promise<any[]> {
  // Try search providers in order
  const searchProviders = [
    searchStocksFromFinnhub,
    searchStocksFromTwelveData,
    searchStocksFromAlphaVantage
  ];
  
  for (const provider of searchProviders) {
    try {
      const results = await provider(query);
      if (results && results.length > 0) return results;
    } catch (error) {
      console.error(`Search provider failed for ${query}:`, error);
      continue;
    }
  }
  
  return [];
}

// Data quality filters to clean market data
function applyDataQualityFilters(data: any[], range: string): any[] {
  console.log(`[DATA_FILTER] Starting filter for ${data?.length || 0} points, range: ${range}`);
  if (!data || data.length === 0) return data;

  let filtered = [...data];

  // For intraday data, filter to market hours only (9:30 AM - 4:00 PM EST)
  if (range === "1D") {
    filtered = filtered.filter(point => {
      const date = new Date(point.timestamp);
      const hour = date.getHours();
      const minute = date.getMinutes();
      const timeInMinutes = hour * 60 + minute;
      
      // Market hours: 9:30 AM (570 minutes) to 4:00 PM (960 minutes) EST
      return timeInMinutes >= 570 && timeInMinutes <= 960;
    });
  }

  // Remove price outliers using statistical method
  if (filtered.length > 5) {
    const prices = filtered.map(p => p.price).filter(p => p > 0);
    const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
    const stdDev = Math.sqrt(variance);
    
    // Remove data points more than 3 standard deviations from mean
    const threshold = 3 * stdDev;
    filtered = filtered.filter(point => {
      const deviation = Math.abs(point.price - mean);
      return deviation <= threshold;
    });
  }

  // Remove impossible price movements (> 10% in 5 minutes for intraday)
  if (range === "1D" && filtered.length > 1) {
    const cleanedPoints = [filtered[0]];
    
    for (let i = 1; i < filtered.length; i++) {
      const current = filtered[i];
      const previous = filtered[i - 1];
      
      if (previous.price > 0) {
        const changePercent = Math.abs((current.price - previous.price) / previous.price);
        
        // Skip points with > 10% change in 5 minutes (likely data errors)
        if (changePercent <= 0.10) {
          cleanedPoints.push(current);
        } else {
          console.log(`Data quality filter: Removed price spike from ${previous.price} to ${current.price} (${(changePercent * 100).toFixed(2)}% change)`);
        }
      } else {
        cleanedPoints.push(current);
      }
    }
    
    filtered = cleanedPoints;
  }

  // Remove zero or negative prices
  filtered = filtered.filter(point => point.price > 0);

  return filtered;
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

  // Check if markets are open (NYSE hours: 9:30 AM - 4:00 PM ET)
  function isMarketOpen(): boolean {
    const now = new Date();
    const et = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    const dayOfWeek = et.getDay(); // 0 = Sunday, 6 = Saturday
    const hour = et.getHours();
    const minute = et.getMinutes();
    const timeInMinutes = hour * 60 + minute;
    
    // Markets closed on weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) return false;
    
    // Market hours: 9:30 AM (570 minutes) to 4:00 PM (960 minutes) ET
    return timeInMinutes >= 570 && timeInMinutes <= 960;
  }

  // Fetch index data from Finnhub
  async function fetchIndexData(symbol: string): Promise<any> {
    if (!FINNHUB_API_KEY) return null;
    
    try {
      const response = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`
      );
      const data = await response.json();
      
      if (data.error || !data.c) return null;
      
      return {
        price: data.c,
        change: data.d || 0,
        changePercent: data.dp || 0,
        previousClose: data.pc || 0,
      };
    } catch (error) {
      console.error(`Error fetching index data for ${symbol}:`, error);
      return null;
    }
  }

  // Fetch futures data from Finnhub
  async function fetchFuturesData(symbol: string): Promise<any> {
    if (!FINNHUB_API_KEY) return null;
    
    try {
      const response = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`
      );
      const data = await response.json();
      
      if (data.error || !data.c) return null;
      
      return {
        price: data.c,
        change: data.d || 0,
        changePercent: data.dp || 0,
      };
    } catch (error) {
      console.error(`Error fetching futures data for ${symbol}:`, error);
      return null;
    }
  }



  // Fetch historical price data
  async function fetchHistoricalData(symbol: string, range: string): Promise<any> {
    // Try Finnhub first for historical data
    if (FINNHUB_API_KEY) {
      try {
        const now = Math.floor(Date.now() / 1000);
        let from = now;
        let resolution = "D";
        
        switch (range) {
          case "1D":
            from = now - 86400; // 1 day
            resolution = "5";
            break;
          case "1W":
            from = now - 604800; // 1 week
            resolution = "60";
            break;
          case "1M":
            from = now - 2592000; // 1 month
            resolution = "D";
            break;
          case "3M":
            from = now - 7776000; // 3 months
            resolution = "D";
            break;
          case "1Y":
            from = now - 31536000; // 1 year
            resolution = "D";
            break;
        }

        const response = await fetch(
          `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${now}&token=${FINNHUB_API_KEY}`
        );
        const data = await response.json();
        
        if (data.s === "ok" && data.c && data.t) {
          console.log(`[FINNHUB] Received ${data.t.length} data points for ${symbol} range ${range}`);
          
          const rawData = data.t.map((timestamp: number, index: number) => ({
            timestamp: timestamp * 1000,
            time: range === "1D" 
              ? new Date(timestamp * 1000).toLocaleTimeString("en-US", { 
                  hour: "numeric", 
                  minute: "2-digit",
                  hour12: false 
                })
              : new Date(timestamp * 1000).toLocaleDateString("en-US", { 
                  month: "short", 
                  day: "numeric" 
                }),
            price: data.c[index],
            open: data.o[index],
            high: data.h[index],
            low: data.l[index],
            volume: data.v[index]
          }));
          
          // Apply data quality filters
          console.log(`[FILTER] Starting data quality filtering with ${rawData.length} points`);
          
          // Filter market hours and remove bad data
          let filtered = rawData;
          
          // For intraday data, filter to market hours only (9:30 AM - 4:00 PM EST)
          if (range === "1D") {
            const marketHoursData = filtered.filter(point => {
              const date = new Date(point.timestamp);
              const hour = date.getHours();
              const minute = date.getMinutes();
              const timeInMinutes = hour * 60 + minute;
              
              // Market hours: 9:30 AM (570 minutes) to 4:00 PM (960 minutes) EST
              return timeInMinutes >= 570 && timeInMinutes <= 960;
            });
            
            console.log(`[DEBUG] After market hours filter: ${marketHoursData.length} points`);
            filtered = marketHoursData;
          }
          
          // Remove price outliers using statistical method
          if (filtered.length > 5) {
            const prices = filtered.map(p => p.price).filter(p => p > 0);
            const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
            const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
            const stdDev = Math.sqrt(variance);
            
            // Remove data points more than 3 standard deviations from mean
            const threshold = 3 * stdDev;
            const outlierFilteredData = filtered.filter(point => {
              const deviation = Math.abs(point.price - mean);
              return deviation <= threshold;
            });
            
            console.log(`[DEBUG] After outlier filter: ${outlierFilteredData.length} points (removed ${filtered.length - outlierFilteredData.length} outliers)`);
            filtered = outlierFilteredData;
          }
          
          // Remove impossible price movements (> 10% in 5 minutes for intraday)
          if (range === "1D" && filtered.length > 1) {
            const cleanedPoints = [filtered[0]];
            
            for (let i = 1; i < filtered.length; i++) {
              const current = filtered[i];
              const previous = filtered[i - 1];
              
              if (previous.price > 0) {
                const changePercent = Math.abs((current.price - previous.price) / previous.price);
                
                // Skip points with > 10% change in 5 minutes (likely data errors)
                if (changePercent <= 0.10) {
                  cleanedPoints.push(current);
                } else {
                  console.log(`[DEBUG] Removed price spike from ${previous.price} to ${current.price} (${(changePercent * 100).toFixed(2)}% change)`);
                }
              } else {
                cleanedPoints.push(current);
              }
            }
            
            console.log(`[DEBUG] After price movement filter: ${cleanedPoints.length} points`);
            filtered = cleanedPoints;
          }
          
          console.log(`[DEBUG] Final filtered data: ${filtered.length} points`);
          return filtered;
        }
      } catch (error) {
        console.error("Finnhub historical data error:", error);
      }
    }

    // Fallback to Alpha Vantage for intraday data if Finnhub fails
    if (ALPHA_VANTAGE_API_KEY && range === "1D") {
      try {
        const response = await fetch(
          `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=5min&apikey=${ALPHA_VANTAGE_API_KEY}`
        );
        const data = await response.json();
        
        if (data["Time Series (5min)"]) {
          const timeSeries = data["Time Series (5min)"];
          const chartData = Object.entries(timeSeries)
            .slice(0, 78) // Last 6.5 hours of trading
            .reverse()
            .map(([time, values]: [string, any]) => ({
              time: new Date(time).toLocaleTimeString("en-US", { 
                hour: "numeric", 
                minute: "2-digit",
                hour12: false 
              }),
              price: parseFloat(values["4. close"]),
              volume: parseInt(values["5. volume"])
            }));
          
          return chartData;
        }
      } catch (error) {
        console.error("Alpha Vantage intraday error:", error);
      }
    }

    return null;
  }

  // AI prediction endpoint
  app.get("/api/stocks/:symbol/prediction", async (req, res) => {
    const { symbol } = req.params;
    
    try {
      // Get current quote
      const quote = await fetchStockQuote(symbol);
      if (!quote) {
        return res.status(404).json({ message: "Stock data not available" });
      }

      // Get historical data for analysis
      const historicalData = await fetchHistoricalData(symbol, "1D");
      if (!historicalData || historicalData.length === 0) {
        return res.status(404).json({ message: "Historical data required for prediction" });
      }

      // Generate AI-powered prediction
      const { generateStockPrediction } = await import("./openai");
      const prediction = await generateStockPrediction(
        symbol,
        quote.price,
        historicalData
      );

      res.json(prediction);
    } catch (error) {
      console.error("Prediction error:", error);
      res.status(500).json({ message: "Failed to generate prediction" });
    }
  });

  // Historical price data endpoint
  app.get("/api/stocks/:symbol/history", async (req, res) => {
    const { symbol } = req.params;
    const { range = "1M" } = req.query;
    
    try {
      const historicalData = await fetchHistoricalData(symbol as string, range as string);
      if (!historicalData) {
        return res.status(404).json({ message: "Historical data not available for this symbol" });
      }
      res.json(historicalData);
    } catch (error) {
      console.error("Historical data error:", error);
      res.status(500).json({ message: "Failed to fetch historical data" });
    }
  });

  // Market data endpoint
  app.get("/api/market/indices", async (req, res) => {
    try {
      const marketData = [];
      const marketOpen = isMarketOpen();
      
      // Major US and international indices (using ETFs as proxies due to API limitations)
      const indices = [
        // US Indices
        { symbol: "SPY", futuresSymbol: "ES=F", name: "S&P 500", description: "SPDR S&P 500 ETF", region: "US" },
        { symbol: "QQQ", futuresSymbol: "NQ=F", name: "NASDAQ 100", description: "Invesco QQQ ETF", region: "US" },
        { symbol: "DIA", futuresSymbol: "YM=F", name: "Dow Jones", description: "SPDR Dow Jones ETF", region: "US" },
        { symbol: "IWM", futuresSymbol: "RTY=F", name: "Russell 2000", description: "iShares Russell 2000 ETF", region: "US" },
        
        // International Indices
        { symbol: "EFA", futuresSymbol: null, name: "EAFE", description: "iShares MSCI EAFE ETF", region: "Europe/Asia" },
        { symbol: "EEM", futuresSymbol: null, name: "Emerging Markets", description: "iShares MSCI Emerging Markets ETF", region: "Emerging" },
        { symbol: "FXI", futuresSymbol: null, name: "China Large-Cap", description: "iShares China Large-Cap ETF", region: "China" },
        { symbol: "EWJ", futuresSymbol: null, name: "Japan", description: "iShares MSCI Japan ETF", region: "Japan" },
        { symbol: "EWG", futuresSymbol: null, name: "Germany", description: "iShares MSCI Germany ETF", region: "Germany" },
        { symbol: "EWU", futuresSymbol: null, name: "United Kingdom", description: "iShares MSCI United Kingdom ETF", region: "UK" }
      ];

      for (const index of indices) {
        let data = null;
        let isFutures = false;
        
        // Always get ETF data as proxy for index
        data = await fetchIndexData(index.symbol);
        
        if (!data) {
          continue;
        }
        
        // If market is closed and futures are available, try to get futures data
        if (!marketOpen && index.futuresSymbol && data) {
          const futuresData = await fetchFuturesData(index.futuresSymbol);
          if (futuresData) {
            // Use futures data if available when markets are closed
            data = futuresData;
            isFutures = true;
          }
        }
        
        marketData.push({
          symbol: index.symbol,
          name: index.name + (isFutures ? " Futures" : ""),
          price: data.price,
          change: data.change,
          changePercent: data.changePercent,
          region: index.region,
          isFutures,
          marketOpen,
        });
      }

      res.json(marketData);
    } catch (error) {
      console.error("Market data error:", error);
      res.status(500).json({ message: "Failed to fetch market data" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
