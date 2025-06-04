import { apiRequest } from "./queryClient";
import type { StockQuote, PortfolioSummary, HoldingWithQuote, WatchlistItem, InsertHolding, InsertWatchlistItem } from "@shared/schema";

export const stockApi = {
  getQuote: async (symbol: string): Promise<StockQuote> => {
    const response = await apiRequest("GET", `/api/stocks/${symbol}/quote`);
    return response.json();
  },

  search: async (query: string): Promise<any[]> => {
    const response = await apiRequest("GET", `/api/stocks/search?q=${encodeURIComponent(query)}`);
    return response.json();
  },
};

export const portfolioApi = {
  getSummary: async (): Promise<PortfolioSummary> => {
    const response = await apiRequest("GET", "/api/portfolio/summary");
    return response.json();
  },

  getHoldings: async (): Promise<HoldingWithQuote[]> => {
    const response = await apiRequest("GET", "/api/holdings");
    return response.json();
  },

  addHolding: async (holding: InsertHolding): Promise<void> => {
    await apiRequest("POST", "/api/holdings", holding);
  },

  updateHolding: async (id: number, updates: Partial<InsertHolding>): Promise<void> => {
    await apiRequest("PUT", `/api/holdings/${id}`, updates);
  },

  removeHolding: async (id: number): Promise<void> => {
    await apiRequest("DELETE", `/api/holdings/${id}`);
  },
};

export const watchlistApi = {
  getWatchlist: async (): Promise<WatchlistItem[]> => {
    const response = await apiRequest("GET", "/api/watchlist");
    return response.json();
  },

  addToWatchlist: async (item: InsertWatchlistItem): Promise<void> => {
    await apiRequest("POST", "/api/watchlist", item);
  },

  removeFromWatchlist: async (id: number): Promise<void> => {
    await apiRequest("DELETE", `/api/watchlist/${id}`);
  },
};

export const marketApi = {
  getIndices: async (): Promise<any[]> => {
    const response = await apiRequest("GET", "/api/market/indices");
    return response.json();
  },
};
