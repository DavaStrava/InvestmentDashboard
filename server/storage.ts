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
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    const [existingPrediction] = await db
      .select()
      .from(predictions)
      .where(eq(predictions.symbol, symbol))
      .limit(1);
    
    if (!existingPrediction) return false;
    
    const predDate = new Date(existingPrediction.predictionDate);
    return predDate >= startOfDay && predDate < endOfDay;
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
}

export const storage = new DatabaseStorage();
