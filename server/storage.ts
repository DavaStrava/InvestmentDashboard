/**
 * DATA ACCESS LAYER (STORAGE SERVICE)
 * ===================================
 * 
 * This service implements the Repository pattern to abstract database operations
 * from business logic. It provides a clean interface for CRUD operations with
 * proper multi-tenant data isolation and type safety.
 * 
 * Key Features:
 * - Multi-tenant architecture with userId-based data isolation
 * - Type-safe database operations using Drizzle ORM
 * - Centralized query logic for consistency across the application
 * - Optimized queries with proper indexing strategy
 * - Error handling and validation at the data layer
 * 
 * Security Model:
 * - All operations require userId parameter for data isolation
 * - Foreign key constraints enforce referential integrity
 * - No cross-tenant data access possible through this interface
 */
import { eq, and, gte, lt, sql, desc } from "drizzle-orm";
import { 
  holdings, 
  watchlist, 
  predictions, 
  historicalPrices,
  users,
  type Holding, 
  type InsertHolding, 
  type WatchlistItem, 
  type InsertWatchlistItem, 
  type Prediction, 
  type InsertPrediction,
  type HistoricalPrice,
  type InsertHistoricalPrice,
  type User,
  type UpsertUser
} from "@shared/schema";
import { db } from "./db";

export interface IStorage {
  // Holdings
  getHoldings(userId: string): Promise<Holding[]>;
  getHolding(id: number, userId: string): Promise<Holding | undefined>;
  createHolding(holding: InsertHolding & { userId: string }): Promise<Holding>;
  updateHolding(id: number, userId: string, updates: Partial<InsertHolding>): Promise<Holding | undefined>;
  deleteHolding(id: number, userId: string): Promise<boolean>;
  
  // Watchlist
  getWatchlist(userId: string): Promise<WatchlistItem[]>;
  getWatchlistItem(id: number, userId: string): Promise<WatchlistItem | undefined>;
  createWatchlistItem(item: InsertWatchlistItem & { userId: string }): Promise<WatchlistItem>;
  deleteWatchlistItem(id: number, userId: string): Promise<boolean>;
  isSymbolInWatchlist(symbol: string, userId: string): Promise<boolean>;
  
  // Predictions
  createPrediction(prediction: InsertPrediction & { userId: string }): Promise<Prediction>;
  getPredictions(userId: string, symbol?: string): Promise<Prediction[]>;
  getPredictionById(id: number, userId: string): Promise<Prediction | undefined>;
  updatePredictionActuals(id: number, userId: string, timeframe: '1d' | '1w' | '1m', actualPrice: number, accurate: boolean): Promise<Prediction | undefined>;
  getPredictionAccuracy(userId: string, symbol?: string): Promise<{ 
    oneDayAccuracy: number; 
    oneWeekAccuracy: number; 
    oneMonthAccuracy: number; 
    totalPredictions: number;
  }>;
  hasTodaysPrediction(symbol: string, userId: string): Promise<boolean>;
  getTodaysPrediction(symbol: string, userId: string): Promise<Prediction | undefined>;
  deletePrediction(id: number, userId: string): Promise<boolean>;
  updatePredictionEvaluation(id: number, userId: string, timeframe: '1d' | '1w' | '1m', evaluation: {
    actualPrice: number;
    priceAccurate: boolean;
    directionAccurate: boolean;
    overallAccurate: boolean;
    weightedScore: number;
  }): Promise<Prediction | undefined>;
  updatePredictionEvaluationTimestamp(id: number, userId: string): Promise<void>;
  getEnhancedPredictionAccuracy(userId: string, symbol?: string): Promise<{
    oneDayAccuracy: number;
    oneWeekAccuracy: number; 
    oneMonthAccuracy: number;
    oneDayPriceAccuracy: number;
    oneWeekPriceAccuracy: number;
    oneMonthPriceAccuracy: number;
    oneDayDirectionAccuracy: number;
    oneWeekDirectionAccuracy: number;
    oneMonthDirectionAccuracy: number;
    averageWeightedScore: number;
    totalPredictions: number;
  }>;

  // Historical Prices
  saveHistoricalPrice(price: InsertHistoricalPrice): Promise<HistoricalPrice>;
  getHistoricalPrice(symbol: string, date: Date): Promise<HistoricalPrice | undefined>;
  getLatestHistoricalPrice(symbol: string): Promise<HistoricalPrice | undefined>;

  batchSaveHistoricalPrices(prices: InsertHistoricalPrice[]): Promise<void>;
  getUniqueSymbolsFromHoldings(userId: string): Promise<string[]>;
  getUniqueSymbolsFromWatchlist(userId: string): Promise<string[]>;

  // User operations for authentication
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
}

// MemStorage removed - using DatabaseStorage with proper user isolation

export class DatabaseStorage implements IStorage {
  // Holdings
  async getHoldings(userId: string): Promise<Holding[]> {
    return await db.select().from(holdings).where(eq(holdings.userId, userId));
  }

  async getHolding(id: number, userId: string): Promise<Holding | undefined> {
    const [holding] = await db.select().from(holdings).where(and(eq(holdings.id, id), eq(holdings.userId, userId)));
    return holding || undefined;
  }

  async createHolding(insertHolding: InsertHolding & { userId: string }): Promise<Holding> {
    const [holding] = await db
      .insert(holdings)
      .values(insertHolding)
      .returning();
    return holding;
  }

  async updateHolding(id: number, userId: string, updates: Partial<InsertHolding>): Promise<Holding | undefined> {
    const [holding] = await db
      .update(holdings)
      .set(updates)
      .where(and(eq(holdings.id, id), eq(holdings.userId, userId)))
      .returning();
    return holding || undefined;
  }

  async deleteHolding(id: number, userId: string): Promise<boolean> {
    const result = await db.delete(holdings).where(and(eq(holdings.id, id), eq(holdings.userId, userId)));
    return (result.rowCount || 0) > 0;
  }

  // Watchlist
  async getWatchlist(userId: string): Promise<WatchlistItem[]> {
    return await db.select().from(watchlist).where(eq(watchlist.userId, userId));
  }

  async getWatchlistItem(id: number, userId: string): Promise<WatchlistItem | undefined> {
    const [item] = await db.select().from(watchlist).where(and(eq(watchlist.id, id), eq(watchlist.userId, userId)));
    return item || undefined;
  }

  async createWatchlistItem(insertItem: InsertWatchlistItem & { userId: string }): Promise<WatchlistItem> {
    const [item] = await db
      .insert(watchlist)
      .values(insertItem)
      .returning();
    return item;
  }

  async deleteWatchlistItem(id: number, userId: string): Promise<boolean> {
    const result = await db.delete(watchlist).where(and(eq(watchlist.id, id), eq(watchlist.userId, userId)));
    return (result.rowCount || 0) > 0;
  }

  async isSymbolInWatchlist(symbol: string, userId: string): Promise<boolean> {
    const [item] = await db.select().from(watchlist).where(and(eq(watchlist.symbol, symbol), eq(watchlist.userId, userId)));
    return !!item;
  }

  // Predictions
  async createPrediction(insertPrediction: InsertPrediction & { userId: string }): Promise<Prediction> {
    const [prediction] = await db
      .insert(predictions)
      .values(insertPrediction)
      .returning();
    return prediction;
  }

  async getPredictions(userId: string, symbol?: string): Promise<Prediction[]> {
    if (symbol) {
      return await db.select().from(predictions).where(and(eq(predictions.symbol, symbol), eq(predictions.userId, userId)));
    }
    return await db.select().from(predictions).where(eq(predictions.userId, userId));
  }

  async getPredictionById(id: number, userId: string): Promise<Prediction | undefined> {
    const [prediction] = await db.select().from(predictions).where(and(eq(predictions.id, id), eq(predictions.userId, userId)));
    return prediction || undefined;
  }

  async updatePredictionActuals(id: number, userId: string, timeframe: '1d' | '1w' | '1m', actualPrice: number, accurate: boolean): Promise<Prediction | undefined> {
    let updateData: any = { updatedAt: new Date() };
    
    switch (timeframe) {
      case '1d':
        updateData.oneDayActualPrice = actualPrice.toString();
        updateData.oneDayAccurate = accurate;
        break;
      case '1w':
        updateData.oneWeekActualPrice = actualPrice.toString();
        updateData.oneWeekAccurate = accurate;
        break;
      case '1m':
        updateData.oneMonthActualPrice = actualPrice.toString();
        updateData.oneMonthAccurate = accurate;
        break;
    }

    const [prediction] = await db
      .update(predictions)
      .set(updateData)
      .where(and(eq(predictions.id, id), eq(predictions.userId, userId)))
      .returning();
    return prediction || undefined;
  }

  async getPredictionAccuracy(userId: string, symbol?: string): Promise<{ 
    oneDayAccuracy: number; 
    oneWeekAccuracy: number; 
    oneMonthAccuracy: number; 
    totalPredictions: number;
  }> {
    const allPredictions = symbol 
      ? await db.select().from(predictions).where(and(eq(predictions.symbol, symbol), eq(predictions.userId, userId)))
      : await db.select().from(predictions).where(eq(predictions.userId, userId));
    
    const oneDayPredictions = allPredictions.filter(p => p.oneDayAccurate !== null);
    const oneWeekPredictions = allPredictions.filter(p => p.oneWeekAccurate !== null);
    const oneMonthPredictions = allPredictions.filter(p => p.oneMonthAccurate !== null);
    
    const oneDayAccurate = oneDayPredictions.filter(p => p.oneDayAccurate === true).length;
    const oneWeekAccurate = oneWeekPredictions.filter(p => p.oneWeekAccurate === true).length;
    const oneMonthAccurate = oneMonthPredictions.filter(p => p.oneMonthAccurate === true).length;
    
    return {
      oneDayAccuracy: oneDayPredictions.length > 0 ? (oneDayAccurate / oneDayPredictions.length) * 100 : 0,
      oneWeekAccuracy: oneWeekPredictions.length > 0 ? (oneWeekAccurate / oneWeekPredictions.length) * 100 : 0,
      oneMonthAccuracy: oneMonthPredictions.length > 0 ? (oneMonthAccurate / oneMonthPredictions.length) * 100 : 0,
      totalPredictions: allPredictions.length,
    };
  }

  async hasTodaysPrediction(symbol: string, userId: string): Promise<boolean> {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      
      // Optimized query: filter by symbol AND date range in SQL instead of memory
      const [result] = await db
        .select({ count: sql<number>`count(*)` })
        .from(predictions)
        .where(
          and(
            eq(predictions.symbol, symbol),
            eq(predictions.userId, userId),
            gte(predictions.predictionDate, startOfDay),
            lt(predictions.predictionDate, endOfDay)
          )
        );
      
      const hasTodayPrediction = result.count > 0;
      console.log(`[STORAGE_CHECK] ${symbol}: ${hasTodayPrediction ? 'HAS' : 'NO'} today's prediction (count: ${result.count})`);
      return hasTodayPrediction;
    } catch (error) {
      console.error(`[STORAGE_CHECK] ${symbol}: Error checking today's prediction:`, error);
      return false;
    }
  }

  async getTodaysPrediction(symbol: string, userId: string): Promise<Prediction | undefined> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    // Optimized query: filter by symbol AND date range in SQL
    const [result] = await db
      .select()
      .from(predictions)
      .where(
        and(
          eq(predictions.symbol, symbol),
          eq(predictions.userId, userId),
          gte(predictions.predictionDate, startOfDay),
          lt(predictions.predictionDate, endOfDay)
        )
      )
      .limit(1);
    
    return result;
  }

  async deletePrediction(id: number, userId: string): Promise<boolean> {
    try {
      const result = await db
        .delete(predictions)
        .where(and(eq(predictions.id, id), eq(predictions.userId, userId)))
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error("Delete prediction error:", error);
      return false;
    }
  }

  async updatePredictionEvaluation(id: number, userId: string, timeframe: '1d' | '1w' | '1m', evaluation: {
    actualPrice: number;
    priceAccurate: boolean;
    directionAccurate: boolean;
    overallAccurate: boolean;
    weightedScore: number;
  }): Promise<Prediction | undefined> {
    try {
      let updateData: any = {};

      if (timeframe === '1d') {
        updateData = {
          oneDayActualPrice: evaluation.actualPrice.toString(),
          oneDayAccurate: evaluation.overallAccurate,
          oneDayPriceAccurate: evaluation.priceAccurate,
          oneDayDirectionAccurate: evaluation.directionAccurate,
          oneDayWeightedScore: evaluation.weightedScore.toString(),
        };
      } else if (timeframe === '1w') {
        updateData = {
          oneWeekActualPrice: evaluation.actualPrice.toString(),
          oneWeekAccurate: evaluation.overallAccurate,
          oneWeekPriceAccurate: evaluation.priceAccurate,
          oneWeekDirectionAccurate: evaluation.directionAccurate,
          oneWeekWeightedScore: evaluation.weightedScore.toString(),
        };
      } else if (timeframe === '1m') {
        updateData = {
          oneMonthActualPrice: evaluation.actualPrice.toString(),
          oneMonthAccurate: evaluation.overallAccurate,
          oneMonthPriceAccurate: evaluation.priceAccurate,
          oneMonthDirectionAccurate: evaluation.directionAccurate,
          oneMonthWeightedScore: evaluation.weightedScore.toString(),
        };
      }

      const [prediction] = await db
        .update(predictions)
        .set(updateData)
        .where(and(eq(predictions.id, id), eq(predictions.userId, userId)))
        .returning();

      return prediction || undefined;
    } catch (error) {
      console.error("Update prediction evaluation error:", error);
      return undefined;
    }
  }

  async updatePredictionEvaluationTimestamp(id: number, userId: string): Promise<void> {
    try {
      await db
        .update(predictions)
        .set({ lastEvaluatedAt: new Date() })
        .where(and(eq(predictions.id, id), eq(predictions.userId, userId)));
    } catch (error) {
      console.error("Update prediction timestamp error:", error);
    }
  }

  async getEnhancedPredictionAccuracy(userId: string, symbol?: string): Promise<{
    oneDayAccuracy: number;
    oneWeekAccuracy: number; 
    oneMonthAccuracy: number;
    oneDayPriceAccuracy: number;
    oneWeekPriceAccuracy: number;
    oneMonthPriceAccuracy: number;
    oneDayDirectionAccuracy: number;
    oneWeekDirectionAccuracy: number;
    oneMonthDirectionAccuracy: number;
    averageWeightedScore: number;
    totalPredictions: number;
  }> {
    try {
      const allPredictions = symbol 
        ? await db.select().from(predictions).where(and(eq(predictions.symbol, symbol), eq(predictions.userId, userId)))
        : await db.select().from(predictions).where(eq(predictions.userId, userId));

      // Overall accuracy
      const oneDayPredictions = allPredictions.filter(p => p.oneDayAccurate !== null);
      const oneWeekPredictions = allPredictions.filter(p => p.oneWeekAccurate !== null);
      const oneMonthPredictions = allPredictions.filter(p => p.oneMonthAccurate !== null);

      const oneDayAccurate = oneDayPredictions.filter(p => p.oneDayAccurate === true).length;
      const oneWeekAccurate = oneWeekPredictions.filter(p => p.oneWeekAccurate === true).length;
      const oneMonthAccurate = oneMonthPredictions.filter(p => p.oneMonthAccurate === true).length;

      // Price accuracy
      const oneDayPriceAccurate = allPredictions.filter(p => p.oneDayPriceAccurate === true).length;
      const oneWeekPriceAccurate = allPredictions.filter(p => p.oneWeekPriceAccurate === true).length;
      const oneMonthPriceAccurate = allPredictions.filter(p => p.oneMonthPriceAccurate === true).length;

      // Direction accuracy
      const oneDayDirectionAccurate = allPredictions.filter(p => p.oneDayDirectionAccurate === true).length;
      const oneWeekDirectionAccurate = allPredictions.filter(p => p.oneWeekDirectionAccurate === true).length;
      const oneMonthDirectionAccurate = allPredictions.filter(p => p.oneMonthDirectionAccurate === true).length;

      // Weighted score calculation
      const weightedScores = allPredictions
        .map(p => [p.oneDayWeightedScore, p.oneWeekWeightedScore, p.oneMonthWeightedScore])
        .flat()
        .filter(score => score !== null)
        .map(score => parseFloat(score as string));

      const averageWeightedScore = weightedScores.length > 0 
        ? weightedScores.reduce((sum, score) => sum + score, 0) / weightedScores.length 
        : 0;

      return {
        oneDayAccuracy: oneDayPredictions.length > 0 ? (oneDayAccurate / oneDayPredictions.length) * 100 : 0,
        oneWeekAccuracy: oneWeekPredictions.length > 0 ? (oneWeekAccurate / oneWeekPredictions.length) * 100 : 0,
        oneMonthAccuracy: oneMonthPredictions.length > 0 ? (oneMonthAccurate / oneMonthPredictions.length) * 100 : 0,
        oneDayPriceAccuracy: oneDayPredictions.length > 0 ? (oneDayPriceAccurate / oneDayPredictions.length) * 100 : 0,
        oneWeekPriceAccuracy: oneWeekPredictions.length > 0 ? (oneWeekPriceAccurate / oneWeekPredictions.length) * 100 : 0,
        oneMonthPriceAccuracy: oneMonthPredictions.length > 0 ? (oneMonthPriceAccurate / oneMonthPredictions.length) * 100 : 0,
        oneDayDirectionAccuracy: oneDayPredictions.length > 0 ? (oneDayDirectionAccurate / oneDayPredictions.length) * 100 : 0,
        oneWeekDirectionAccuracy: oneWeekPredictions.length > 0 ? (oneWeekDirectionAccurate / oneWeekPredictions.length) * 100 : 0,
        oneMonthDirectionAccuracy: oneMonthPredictions.length > 0 ? (oneMonthDirectionAccurate / oneMonthPredictions.length) * 100 : 0,
        averageWeightedScore: averageWeightedScore * 100, // Convert to percentage
        totalPredictions: allPredictions.length,
      };
    } catch (error) {
      console.error("Get enhanced prediction accuracy error:", error);
      return {
        oneDayAccuracy: 0,
        oneWeekAccuracy: 0,
        oneMonthAccuracy: 0,
        oneDayPriceAccuracy: 0,
        oneWeekPriceAccuracy: 0,
        oneMonthPriceAccuracy: 0,
        oneDayDirectionAccuracy: 0,
        oneWeekDirectionAccuracy: 0,
        oneMonthDirectionAccuracy: 0,
        averageWeightedScore: 0,
        totalPredictions: 0,
      };
    }
  }

  // Historical Prices implementation
  async saveHistoricalPrice(price: InsertHistoricalPrice): Promise<HistoricalPrice> {
    try {
      const [savedPrice] = await db
        .insert(historicalPrices)
        .values(price)
        .onConflictDoUpdate({
          target: [historicalPrices.symbol, historicalPrices.date],
          set: {
            closePrice: price.closePrice,
            openPrice: price.openPrice,
            highPrice: price.highPrice,
            lowPrice: price.lowPrice,
            volume: price.volume,
            change: price.change,
            changePercent: price.changePercent,
          },
        })
        .returning();
      return savedPrice;
    } catch (error) {
      console.error("Save historical price error:", error);
      throw error;
    }
  }

  async getHistoricalPrice(symbol: string, date: Date): Promise<HistoricalPrice | undefined> {
    try {
      const [price] = await db
        .select()
        .from(historicalPrices)
        .where(and(
          eq(historicalPrices.symbol, symbol),
          eq(historicalPrices.date, date)
        ));
      return price;
    } catch (error) {
      console.error("Get historical price error:", error);
      return undefined;
    }
  }

  async getLatestHistoricalPrice(symbol: string): Promise<HistoricalPrice | undefined> {
    try {
      const [price] = await db
        .select()
        .from(historicalPrices)
        .where(eq(historicalPrices.symbol, symbol))
        .orderBy(desc(historicalPrices.date))
        .limit(1);
      return price;
    } catch (error) {
      console.error("Get latest historical price error:", error);
      return undefined;
    }
  }

  async batchSaveHistoricalPrices(prices: InsertHistoricalPrice[]): Promise<void> {
    try {
      if (prices.length === 0) return;
      
      await db.insert(historicalPrices).values(prices).onConflictDoNothing();
    } catch (error) {
      console.error("Batch save historical prices error:", error);
      throw error;
    }
  }

  async getUniqueSymbolsFromHoldings(userId: string): Promise<string[]> {
    try {
      const symbols = await db
        .selectDistinct({ symbol: holdings.symbol })
        .from(holdings)
        .where(eq(holdings.userId, userId));
      return symbols.map(row => row.symbol);
    } catch (error) {
      console.error("Get unique symbols from holdings error:", error);
      return [];
    }
  }

  async getUniqueSymbolsFromWatchlist(userId: string): Promise<string[]> {
    try {
      const symbols = await db
        .selectDistinct({ symbol: watchlist.symbol })
        .from(watchlist)
        .where(eq(watchlist.userId, userId));
      return symbols.map(row => row.symbol);
    } catch (error) {
      console.error("Get unique symbols from watchlist error:", error);
      return [];
    }
  }

  // User operations for authentication
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }
}

export const storage = new DatabaseStorage();
