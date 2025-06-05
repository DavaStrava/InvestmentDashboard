import { holdings, watchlist, type Holding, type InsertHolding, type WatchlistItem, type InsertWatchlistItem } from "@shared/schema";

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
}

import { db } from "./db";
import { eq } from "drizzle-orm";

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
    return result.rowCount > 0;
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
    return result.rowCount > 0;
  }

  async isSymbolInWatchlist(symbol: string): Promise<boolean> {
    const [item] = await db.select().from(watchlist).where(eq(watchlist.symbol, symbol));
    return !!item;
  }
}

export const storage = new DatabaseStorage();
