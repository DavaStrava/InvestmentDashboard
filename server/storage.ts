import { eq } from "drizzle-orm";
import { holdings, watchlist, predictions, type Holding, type InsertHolding, type WatchlistItem, type InsertWatchlistItem, type Prediction, type InsertPrediction } from "@shared/schema";
import { db } from "./db";

export interface IStorage {
  // Holdings
  getHoldings(): Promise<Holding[]>;
  getHolding(id: number): Promise<Holding | undefined>;
  createHolding(holding: InsertHolding): Promise<Holding>;
  updateHolding(id: number, updates: Partial<InsertHolding>): Promise<Holding | undefined>;
  deleteHolding(id: number): Promise<boolean>;
  
  // Watchlist
  getWatchlist(): Promise<WatchlistItem[]>;
  getWatchlistItem(id: number): Promise<WatchlistItem | undefined>;
  createWatchlistItem(item: InsertWatchlistItem): Promise<WatchlistItem>;
  deleteWatchlistItem(id: number): Promise<boolean>;
  isSymbolInWatchlist(symbol: string): Promise<boolean>;
  
  // Predictions
  createPrediction(prediction: InsertPrediction): Promise<Prediction>;
  getPredictions(symbol?: string): Promise<Prediction[]>;
  getPredictionById(id: number): Promise<Prediction | undefined>;
  updatePredictionActuals(id: number, timeframe: '1d' | '1w' | '1m', actualPrice: number, accurate: boolean): Promise<Prediction | undefined>;
  getPredictionAccuracy(symbol?: string): Promise<{ 
    oneDayAccuracy: number; 
    oneWeekAccuracy: number; 
    oneMonthAccuracy: number; 
    totalPredictions: number;
  }>;
  hasTodaysPrediction(symbol: string): Promise<boolean>;
  getTodaysPrediction(symbol: string): Promise<Prediction | undefined>;
  deletePrediction(id: number): Promise<boolean>;
  updatePredictionEvaluation(id: number, timeframe: '1d' | '1w' | '1m', evaluation: {
    actualPrice: number;
    priceAccurate: boolean;
    directionAccurate: boolean;
    overallAccurate: boolean;
    weightedScore: number;
  }): Promise<Prediction | undefined>;
  updatePredictionEvaluationTimestamp(id: number): Promise<void>;
  getEnhancedPredictionAccuracy(symbol?: string): Promise<{
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
}

export class MemStorage implements IStorage {
  private holdings: Map<number, Holding>;
  private watchlist: Map<number, WatchlistItem>;
  private currentHoldingId: number;
  private currentWatchlistId: number;

  constructor() {
    this.holdings = new Map();
    this.watchlist = new Map();
    this.currentHoldingId = 1;
    this.currentWatchlistId = 1;
  }

  // Holdings methods
  async getHoldings(): Promise<Holding[]> {
    return Array.from(this.holdings.values());
  }

  async getHolding(id: number): Promise<Holding | undefined> {
    return this.holdings.get(id);
  }

  async createHolding(insertHolding: InsertHolding): Promise<Holding> {
    const id = this.currentHoldingId++;
    const holding: Holding = {
      ...insertHolding,
      id,
      createdAt: new Date(),
    };
    this.holdings.set(id, holding);
    return holding;
  }

  async updateHolding(id: number, updates: Partial<InsertHolding>): Promise<Holding | undefined> {
    const holding = this.holdings.get(id);
    if (!holding) return undefined;

    const updatedHolding = { ...holding, ...updates };
    this.holdings.set(id, updatedHolding);
    return updatedHolding;
  }

  async deleteHolding(id: number): Promise<boolean> {
    return this.holdings.delete(id);
  }

  // Watchlist methods
  async getWatchlist(): Promise<WatchlistItem[]> {
    return Array.from(this.watchlist.values());
  }

  async getWatchlistItem(id: number): Promise<WatchlistItem | undefined> {
    return this.watchlist.get(id);
  }

  async createWatchlistItem(insertItem: InsertWatchlistItem): Promise<WatchlistItem> {
    const id = this.currentWatchlistId++;
    const item: WatchlistItem = {
      ...insertItem,
      id,
      createdAt: new Date(),
    };
    this.watchlist.set(id, item);
    return item;
  }

  async deleteWatchlistItem(id: number): Promise<boolean> {
    return this.watchlist.delete(id);
  }

  async isSymbolInWatchlist(symbol: string): Promise<boolean> {
    return Array.from(this.watchlist.values()).some(item => item.symbol === symbol);
  }

  // Predictions (stub implementation for MemStorage)
  async createPrediction(insertPrediction: InsertPrediction): Promise<Prediction> {
    throw new Error("Predictions not supported in MemStorage");
  }

  async getPredictions(symbol?: string): Promise<Prediction[]> {
    return [];
  }

  async getPredictionById(id: number): Promise<Prediction | undefined> {
    return undefined;
  }

  async updatePredictionActuals(id: number, timeframe: '1d' | '1w' | '1m', actualPrice: number, accurate: boolean): Promise<Prediction | undefined> {
    return undefined;
  }

  async getPredictionAccuracy(symbol?: string): Promise<{ 
    oneDayAccuracy: number; 
    oneWeekAccuracy: number; 
    oneMonthAccuracy: number; 
    totalPredictions: number;
  }> {
    return {
      oneDayAccuracy: 0,
      oneWeekAccuracy: 0,
      oneMonthAccuracy: 0,
      totalPredictions: 0,
    };
  }

  async hasTodaysPrediction(symbol: string): Promise<boolean> {
    return false; // MemStorage doesn't persist predictions across sessions
  }

  async getTodaysPrediction(symbol: string): Promise<Prediction | undefined> {
    return undefined; // MemStorage doesn't persist predictions across sessions
  }

  async deletePrediction(id: number): Promise<boolean> {
    return false; // MemStorage doesn't persist predictions across sessions
  }

  async updatePredictionEvaluation(id: number, timeframe: '1d' | '1w' | '1m', evaluation: {
    actualPrice: number;
    priceAccurate: boolean;
    directionAccurate: boolean;
    overallAccurate: boolean;
    weightedScore: number;
  }): Promise<Prediction | undefined> {
    return undefined; // MemStorage doesn't persist predictions across sessions
  }

  async updatePredictionEvaluationTimestamp(id: number): Promise<void> {
    // MemStorage doesn't persist predictions across sessions
  }

  async getEnhancedPredictionAccuracy(symbol?: string): Promise<{
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

export class DatabaseStorage implements IStorage {
  // Holdings
  async getHoldings(): Promise<Holding[]> {
    return await db.select().from(holdings);
  }

  async getHolding(id: number): Promise<Holding | undefined> {
    const [holding] = await db.select().from(holdings).where(eq(holdings.id, id));
    return holding || undefined;
  }

  async createHolding(insertHolding: InsertHolding): Promise<Holding> {
    const [holding] = await db
      .insert(holdings)
      .values(insertHolding)
      .returning();
    return holding;
  }

  async updateHolding(id: number, updates: Partial<InsertHolding>): Promise<Holding | undefined> {
    const [holding] = await db
      .update(holdings)
      .set(updates)
      .where(eq(holdings.id, id))
      .returning();
    return holding || undefined;
  }

  async deleteHolding(id: number): Promise<boolean> {
    const result = await db.delete(holdings).where(eq(holdings.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Watchlist
  async getWatchlist(): Promise<WatchlistItem[]> {
    return await db.select().from(watchlist);
  }

  async getWatchlistItem(id: number): Promise<WatchlistItem | undefined> {
    const [item] = await db.select().from(watchlist).where(eq(watchlist.id, id));
    return item || undefined;
  }

  async createWatchlistItem(insertItem: InsertWatchlistItem): Promise<WatchlistItem> {
    const [item] = await db
      .insert(watchlist)
      .values(insertItem)
      .returning();
    return item;
  }

  async deleteWatchlistItem(id: number): Promise<boolean> {
    const result = await db.delete(watchlist).where(eq(watchlist.id, id));
    return (result.rowCount || 0) > 0;
  }

  async isSymbolInWatchlist(symbol: string): Promise<boolean> {
    const [item] = await db.select().from(watchlist).where(eq(watchlist.symbol, symbol));
    return !!item;
  }

  // Predictions
  async createPrediction(insertPrediction: InsertPrediction): Promise<Prediction> {
    const [prediction] = await db
      .insert(predictions)
      .values(insertPrediction)
      .returning();
    return prediction;
  }

  async getPredictions(symbol?: string): Promise<Prediction[]> {
    if (symbol) {
      return await db.select().from(predictions).where(eq(predictions.symbol, symbol));
    }
    return await db.select().from(predictions);
  }

  async getPredictionById(id: number): Promise<Prediction | undefined> {
    const [prediction] = await db.select().from(predictions).where(eq(predictions.id, id));
    return prediction || undefined;
  }

  async updatePredictionActuals(id: number, timeframe: '1d' | '1w' | '1m', actualPrice: number, accurate: boolean): Promise<Prediction | undefined> {
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
      .where(eq(predictions.id, id))
      .returning();
    return prediction || undefined;
  }

  async getPredictionAccuracy(symbol?: string): Promise<{ 
    oneDayAccuracy: number; 
    oneWeekAccuracy: number; 
    oneMonthAccuracy: number; 
    totalPredictions: number;
  }> {
    const allPredictions = symbol 
      ? await db.select().from(predictions).where(eq(predictions.symbol, symbol))
      : await db.select().from(predictions);
    
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

  async hasTodaysPrediction(symbol: string): Promise<boolean> {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      
      console.log(`[STORAGE_CHECK] ${symbol}: Checking predictions between ${startOfDay.toISOString()} and ${endOfDay.toISOString()}`);
      
      const todaysPredictions = await db
        .select()
        .from(predictions)
        .where(eq(predictions.symbol, symbol));
      
      console.log(`[STORAGE_CHECK] ${symbol}: Found ${todaysPredictions.length} total predictions`);
      
      todaysPredictions.forEach((pred, index) => {
        const predDate = new Date(pred.predictionDate);
        const isToday = predDate >= startOfDay && predDate < endOfDay;
        console.log(`[STORAGE_CHECK] ${symbol}: Prediction ${index + 1} - ID:${pred.id}, Date:${predDate.toISOString()}, IsToday:${isToday}`);
      });
      
      const hasTodayPrediction = todaysPredictions.some(pred => {
        const predDate = new Date(pred.predictionDate);
        return predDate >= startOfDay && predDate < endOfDay;
      });
      
      console.log(`[STORAGE_CHECK] ${symbol}: Final result - ${hasTodayPrediction ? 'HAS' : 'NO'} today's prediction`);
      return hasTodayPrediction;
    } catch (error) {
      console.error(`[STORAGE_CHECK] ${symbol}: Error checking today's prediction:`, error);
      return false;
    }
  }

  async getTodaysPrediction(symbol: string): Promise<Prediction | undefined> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    const allPredictions = await db
      .select()
      .from(predictions)
      .where(eq(predictions.symbol, symbol));
    
    return allPredictions.find(pred => {
      const predDate = new Date(pred.predictionDate);
      return predDate >= startOfDay && predDate < endOfDay;
    });
  }

  async deletePrediction(id: number): Promise<boolean> {
    try {
      const result = await db
        .delete(predictions)
        .where(eq(predictions.id, id))
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error("Delete prediction error:", error);
      return false;
    }
  }

  async updatePredictionEvaluation(id: number, timeframe: '1d' | '1w' | '1m', evaluation: {
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
        .where(eq(predictions.id, id))
        .returning();

      return prediction || undefined;
    } catch (error) {
      console.error("Update prediction evaluation error:", error);
      return undefined;
    }
  }

  async updatePredictionEvaluationTimestamp(id: number): Promise<void> {
    try {
      await db
        .update(predictions)
        .set({ lastEvaluatedAt: new Date() })
        .where(eq(predictions.id, id));
    } catch (error) {
      console.error("Update prediction timestamp error:", error);
    }
  }

  async getEnhancedPredictionAccuracy(symbol?: string): Promise<{
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
        ? await db.select().from(predictions).where(eq(predictions.symbol, symbol))
        : await db.select().from(predictions);

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
}

export const storage = new DatabaseStorage();
