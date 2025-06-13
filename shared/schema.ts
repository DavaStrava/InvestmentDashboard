import { pgTable, text, serial, integer, decimal, timestamp, boolean, varchar } from "drizzle-orm/pg-core";
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

export const predictions = pgTable("predictions", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  predictionDate: timestamp("prediction_date").defaultNow().notNull(),
  currentPrice: decimal("current_price", { precision: 10, scale: 2 }).notNull(),
  
  // 1-day prediction
  oneDayPrice: decimal("one_day_price", { precision: 10, scale: 2 }).notNull(),
  oneDayConfidence: integer("one_day_confidence").notNull(),
  oneDayDirection: varchar("one_day_direction", { length: 10 }).notNull(),
  oneDayActualPrice: decimal("one_day_actual_price", { precision: 10, scale: 2 }),
  oneDayAccurate: boolean("one_day_accurate"),
  
  // 1-week prediction  
  oneWeekPrice: decimal("one_week_price", { precision: 10, scale: 2 }).notNull(),
  oneWeekConfidence: integer("one_week_confidence").notNull(),
  oneWeekDirection: varchar("one_week_direction", { length: 10 }).notNull(),
  oneWeekActualPrice: decimal("one_week_actual_price", { precision: 10, scale: 2 }),
  oneWeekAccurate: boolean("one_week_accurate"),
  
  // 1-month prediction
  oneMonthPrice: decimal("one_month_price", { precision: 10, scale: 2 }).notNull(),
  oneMonthConfidence: integer("one_month_confidence").notNull(),
  oneMonthDirection: varchar("one_month_direction", { length: 10 }).notNull(),
  oneMonthActualPrice: decimal("one_month_actual_price", { precision: 10, scale: 2 }),
  oneMonthAccurate: boolean("one_month_accurate"),
  
  // Technical analysis context
  rsi: decimal("rsi", { precision: 5, scale: 2 }),
  trend: varchar("trend", { length: 10 }),
  recommendation: varchar("recommendation", { length: 10 }),
  
  // Metadata
  generatedAt: timestamp("generated_at").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertHoldingSchema = createInsertSchema(holdings).omit({
  id: true,
  createdAt: true,
});

export const insertWatchlistSchema = createInsertSchema(watchlist).omit({
  id: true,
  createdAt: true,
});

export const insertPredictionSchema = createInsertSchema(predictions).omit({
  id: true,
  predictionDate: true,
  updatedAt: true,
  oneDayActualPrice: true,
  oneDayAccurate: true,
  oneWeekActualPrice: true,
  oneWeekAccurate: true,
  oneMonthActualPrice: true,
  oneMonthAccurate: true,
});

export type InsertHolding = z.infer<typeof insertHoldingSchema>;
export type Holding = typeof holdings.$inferSelect;
export type InsertWatchlistItem = z.infer<typeof insertWatchlistSchema>;
export type WatchlistItem = typeof watchlist.$inferSelect;
export type InsertPrediction = z.infer<typeof insertPredictionSchema>;
export type Prediction = typeof predictions.$inferSelect;

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
