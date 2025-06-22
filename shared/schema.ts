import { pgTable, text, serial, integer, decimal, timestamp, boolean, varchar, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for authentication
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const holdings = pgTable("holdings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  symbol: text("symbol").notNull(),
  companyName: text("company_name").notNull(),
  shares: decimal("shares", { precision: 10, scale: 4 }).notNull(),
  avgCostPerShare: decimal("avg_cost_per_share", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const watchlist = pgTable("watchlist", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  symbol: text("symbol").notNull(),
  companyName: text("company_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const predictions = pgTable("predictions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  symbol: text("symbol").notNull(),
  predictionDate: timestamp("prediction_date").defaultNow().notNull(),
  currentPrice: decimal("current_price", { precision: 10, scale: 2 }).notNull(),
  
  // 1-day prediction
  oneDayPrice: decimal("one_day_price", { precision: 10, scale: 2 }).notNull(),
  oneDayConfidence: integer("one_day_confidence").notNull(),
  oneDayDirection: varchar("one_day_direction", { length: 10 }).notNull(),
  oneDayActualPrice: decimal("one_day_actual_price", { precision: 10, scale: 2 }),
  oneDayAccurate: boolean("one_day_accurate"),
  oneDayPriceAccurate: boolean("one_day_price_accurate"),
  oneDayDirectionAccurate: boolean("one_day_direction_accurate"),
  oneDayWeightedScore: decimal("one_day_weighted_score", { precision: 5, scale: 4 }),
  
  // 1-week prediction  
  oneWeekPrice: decimal("one_week_price", { precision: 10, scale: 2 }).notNull(),
  oneWeekConfidence: integer("one_week_confidence").notNull(),
  oneWeekDirection: varchar("one_week_direction", { length: 10 }).notNull(),
  oneWeekActualPrice: decimal("one_week_actual_price", { precision: 10, scale: 2 }),
  oneWeekAccurate: boolean("one_week_accurate"),
  oneWeekPriceAccurate: boolean("one_week_price_accurate"),
  oneWeekDirectionAccurate: boolean("one_week_direction_accurate"),
  oneWeekWeightedScore: decimal("one_week_weighted_score", { precision: 5, scale: 4 }),
  
  // 1-month prediction
  oneMonthPrice: decimal("one_month_price", { precision: 10, scale: 2 }).notNull(),
  oneMonthConfidence: integer("one_month_confidence").notNull(),
  oneMonthDirection: varchar("one_month_direction", { length: 10 }).notNull(),
  oneMonthActualPrice: decimal("one_month_actual_price", { precision: 10, scale: 2 }),
  oneMonthAccurate: boolean("one_month_accurate"),
  oneMonthPriceAccurate: boolean("one_month_price_accurate"),
  oneMonthDirectionAccurate: boolean("one_month_direction_accurate"),
  oneMonthWeightedScore: decimal("one_month_weighted_score", { precision: 5, scale: 4 }),
  
  // Evaluation metadata
  lastEvaluatedAt: timestamp("last_evaluated_at"),
  priceThreshold: decimal("price_threshold", { precision: 5, scale: 2 }).default("5.00"), // Default 5% accuracy threshold
  
  // Technical analysis context
  rsi: decimal("rsi", { precision: 5, scale: 2 }),
  trend: varchar("trend", { length: 10 }),
  recommendation: varchar("recommendation", { length: 10 }),
  
  // Narrative analysis storage
  oneDayReasoning: text("one_day_reasoning"),
  oneWeekReasoning: text("one_week_reasoning"), 
  oneMonthReasoning: text("one_month_reasoning"),
  technicalAnalysisNarrative: text("technical_analysis_narrative"),
  overallAssessment: text("overall_assessment"),
  dataLimitations: text("data_limitations"),
  
  // Metadata
  generatedAt: timestamp("generated_at").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  // Index for symbol-based queries (most frequent)
  symbolIdx: index("predictions_symbol_idx").on(table.symbol),
  
  // Index for date-based queries and sorting
  predictionDateIdx: index("predictions_date_idx").on(table.predictionDate),
  
  // Composite index for symbol + date queries
  symbolDateIdx: index("predictions_symbol_date_idx").on(table.symbol, table.predictionDate),
  
  // Index for accuracy queries
  oneDayAccurateIdx: index("predictions_1d_accurate_idx").on(table.oneDayAccurate),
  oneWeekAccurateIdx: index("predictions_1w_accurate_idx").on(table.oneWeekAccurate),
  oneMonthAccurateIdx: index("predictions_1m_accurate_idx").on(table.oneMonthAccurate),
  
  // Index for evaluation timing
  lastEvaluatedIdx: index("predictions_last_evaluated_idx").on(table.lastEvaluatedAt),
}));

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

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Historical stock prices for market-close data storage
export const historicalPrices = pgTable("historical_prices", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  date: timestamp("date").notNull(), // Trading day date
  closePrice: decimal("close_price", { precision: 10, scale: 4 }).notNull(),
  openPrice: decimal("open_price", { precision: 10, scale: 4 }),
  highPrice: decimal("high_price", { precision: 10, scale: 4 }),
  lowPrice: decimal("low_price", { precision: 10, scale: 4 }),
  volume: integer("volume"),
  change: decimal("change", { precision: 10, scale: 4 }),
  changePercent: decimal("change_percent", { precision: 8, scale: 4 }),
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
}, (table) => ({
  // Primary query index for symbol + date lookups
  symbolDateIdx: index("historical_prices_symbol_date_idx").on(table.symbol, table.date),
  
  // Index for date-based queries
  dateIdx: index("historical_prices_date_idx").on(table.date),
  
  // Index for symbol-based queries
  symbolIdx: index("historical_prices_symbol_idx").on(table.symbol),
  
  // Unique constraint to prevent duplicate entries
  uniqueSymbolDate: index("historical_prices_unique_symbol_date").on(table.symbol, table.date),
}));

export const insertHistoricalPriceSchema = createInsertSchema(historicalPrices).omit({
  id: true,
  recordedAt: true,
});

export type InsertHistoricalPrice = z.infer<typeof insertHistoricalPriceSchema>;
export type HistoricalPrice = typeof historicalPrices.$inferSelect;

// Stock quote interface for API responses
export interface StockQuote {
  symbol: string;
  companyName: string;
  price: number;
  change: number;
  changePercent: number;
  afterHoursPrice?: number | null;
  volume?: number;
  marketCap?: number;
  peRatio?: number;
  earningsDate?: number;
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
