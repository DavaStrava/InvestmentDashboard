import { pgTable, text, serial, integer, decimal, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const holdings = pgTable("holdings", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  companyName: text("company_name").notNull(),
  shares: decimal("shares", { precision: 10, scale: 4 }).notNull(),
  avgCostPerShare: decimal("avg_cost_per_share", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const watchlist = pgTable("watchlist", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull().unique(),
  companyName: text("company_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertHoldingSchema = createInsertSchema(holdings).omit({
  id: true,
  createdAt: true,
});

export const insertWatchlistSchema = createInsertSchema(watchlist).omit({
  id: true,
  createdAt: true,
});

export type InsertHolding = z.infer<typeof insertHoldingSchema>;
export type Holding = typeof holdings.$inferSelect;
export type InsertWatchlistItem = z.infer<typeof insertWatchlistSchema>;
export type WatchlistItem = typeof watchlist.$inferSelect;

// API response types
export interface StockQuote {
  symbol: string;
  companyName: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  peRatio?: number;
  earningsDate?: string;
  high52Week?: number;
  low52Week?: number;
  avgVolume?: number;
  dividendYield?: number;
  eps?: number;
  beta?: number;
  roe?: number;
}

export interface PortfolioSummary {
  totalValue: number;
  dailyChange: number;
  dailyChangePercent: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  holdingsCount: number;
}

export interface HoldingWithQuote extends Holding {
  currentPrice: number;
  dailyChange: number;
  dailyChangePercent: number;
  totalValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
}
