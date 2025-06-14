import { db } from './db';
import { predictions } from '@shared/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { logger } from './logger';

interface BatchPredictionUpdate {
  id: number;
  timeframe: '1d' | '1w' | '1m';
  actualPrice: number;
  priceAccurate: boolean;
  directionAccurate: boolean;
  overallAccurate: boolean;
  weightedScore: number;
}

export class BatchOperations {
  
  /**
   * Batch update multiple predictions for better performance
   */
  async batchUpdatePredictions(updates: BatchPredictionUpdate[]): Promise<void> {
    if (updates.length === 0) return;

    const startTime = Date.now();
    
    try {
      await db.transaction(async (tx) => {
        // Group updates by timeframe for efficient processing
        const groupedUpdates = updates.reduce((acc, update) => {
          if (!acc[update.timeframe]) acc[update.timeframe] = [];
          acc[update.timeframe].push(update);
          return acc;
        }, {} as Record<string, BatchPredictionUpdate[]>);

        for (const [timeframe, timeframeUpdates] of Object.entries(groupedUpdates)) {
          const ids = timeframeUpdates.map(u => u.id);
          
          if (timeframe === '1d') {
            // Use CASE statements for efficient batch updates
            await tx.execute(sql`
              UPDATE predictions 
              SET 
                one_day_actual_price = CASE ${sql.join(
                  timeframeUpdates.map(u => sql`WHEN id = ${u.id} THEN ${u.actualPrice}`),
                  sql` `
                )} END,
                one_day_accurate = CASE ${sql.join(
                  timeframeUpdates.map(u => sql`WHEN id = ${u.id} THEN ${u.overallAccurate}`),
                  sql` `
                )} END,
                one_day_price_accurate = CASE ${sql.join(
                  timeframeUpdates.map(u => sql`WHEN id = ${u.id} THEN ${u.priceAccurate}`),
                  sql` `
                )} END,
                one_day_direction_accurate = CASE ${sql.join(
                  timeframeUpdates.map(u => sql`WHEN id = ${u.id} THEN ${u.directionAccurate}`),
                  sql` `
                )} END,
                one_day_weighted_score = CASE ${sql.join(
                  timeframeUpdates.map(u => sql`WHEN id = ${u.id} THEN ${u.weightedScore}`),
                  sql` `
                )} END,
                last_evaluated_at = NOW()
              WHERE id IN (${sql.join(ids.map(id => sql`${id}`), sql`,`)})
            `);
          } else if (timeframe === '1w') {
            await tx.execute(sql`
              UPDATE predictions 
              SET 
                one_week_actual_price = CASE ${sql.join(
                  timeframeUpdates.map(u => sql`WHEN id = ${u.id} THEN ${u.actualPrice}`),
                  sql` `
                )} END,
                one_week_accurate = CASE ${sql.join(
                  timeframeUpdates.map(u => sql`WHEN id = ${u.id} THEN ${u.overallAccurate}`),
                  sql` `
                )} END,
                one_week_price_accurate = CASE ${sql.join(
                  timeframeUpdates.map(u => sql`WHEN id = ${u.id} THEN ${u.priceAccurate}`),
                  sql` `
                )} END,
                one_week_direction_accurate = CASE ${sql.join(
                  timeframeUpdates.map(u => sql`WHEN id = ${u.id} THEN ${u.directionAccurate}`),
                  sql` `
                )} END,
                one_week_weighted_score = CASE ${sql.join(
                  timeframeUpdates.map(u => sql`WHEN id = ${u.id} THEN ${u.weightedScore}`),
                  sql` `
                )} END,
                last_evaluated_at = NOW()
              WHERE id IN (${sql.join(ids.map(id => sql`${id}`), sql`,`)})
            `);
          } else if (timeframe === '1m') {
            await tx.execute(sql`
              UPDATE predictions 
              SET 
                one_month_actual_price = CASE ${sql.join(
                  timeframeUpdates.map(u => sql`WHEN id = ${u.id} THEN ${u.actualPrice}`),
                  sql` `
                )} END,
                one_month_accurate = CASE ${sql.join(
                  timeframeUpdates.map(u => sql`WHEN id = ${u.id} THEN ${u.overallAccurate}`),
                  sql` `
                )} END,
                one_month_price_accurate = CASE ${sql.join(
                  timeframeUpdates.map(u => sql`WHEN id = ${u.id} THEN ${u.priceAccurate}`),
                  sql` `
                )} END,
                one_month_direction_accurate = CASE ${sql.join(
                  timeframeUpdates.map(u => sql`WHEN id = ${u.id} THEN ${u.directionAccurate}`),
                  sql` `
                )} END,
                one_month_weighted_score = CASE ${sql.join(
                  timeframeUpdates.map(u => sql`WHEN id = ${u.id} THEN ${u.weightedScore}`),
                  sql` `
                )} END,
                last_evaluated_at = NOW()
              WHERE id IN (${sql.join(ids.map(id => sql`${id}`), sql`,`)})
            `);
          }
        }
      });

      const duration = Date.now() - startTime;
      logger.performance('BATCH_UPDATE_PREDICTIONS', duration, { 
        updatesCount: updates.length,
        timeframes: Object.keys(updates.reduce((acc, u) => ({ ...acc, [u.timeframe]: true }), {}))
      });

    } catch (error) {
      logger.error('BATCH_OPERATIONS', 'Failed to batch update predictions', error);
      throw error;
    }
  }

  /**
   * Get accuracy statistics with database-level aggregation
   */
  async getAccuracyStatistics(symbol?: string): Promise<{
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
    const startTime = Date.now();

    try {
      const whereClause = symbol ? sql`WHERE symbol = ${symbol}` : sql``;
      
      const result = await db.execute(sql`
        SELECT 
          COUNT(*) as total_predictions,
          
          -- 1-day accuracy metrics
          COALESCE(AVG(CASE WHEN one_day_accurate IS NOT NULL THEN 
            CASE WHEN one_day_accurate THEN 1.0 ELSE 0.0 END 
          END) * 100, 0) as one_day_accuracy,
          
          COALESCE(AVG(CASE WHEN one_day_price_accurate IS NOT NULL THEN 
            CASE WHEN one_day_price_accurate THEN 1.0 ELSE 0.0 END 
          END) * 100, 0) as one_day_price_accuracy,
          
          COALESCE(AVG(CASE WHEN one_day_direction_accurate IS NOT NULL THEN 
            CASE WHEN one_day_direction_accurate THEN 1.0 ELSE 0.0 END 
          END) * 100, 0) as one_day_direction_accuracy,
          
          -- 1-week accuracy metrics
          COALESCE(AVG(CASE WHEN one_week_accurate IS NOT NULL THEN 
            CASE WHEN one_week_accurate THEN 1.0 ELSE 0.0 END 
          END) * 100, 0) as one_week_accuracy,
          
          COALESCE(AVG(CASE WHEN one_week_price_accurate IS NOT NULL THEN 
            CASE WHEN one_week_price_accurate THEN 1.0 ELSE 0.0 END 
          END) * 100, 0) as one_week_price_accuracy,
          
          COALESCE(AVG(CASE WHEN one_week_direction_accurate IS NOT NULL THEN 
            CASE WHEN one_week_direction_accurate THEN 1.0 ELSE 0.0 END 
          END) * 100, 0) as one_week_direction_accuracy,
          
          -- 1-month accuracy metrics
          COALESCE(AVG(CASE WHEN one_month_accurate IS NOT NULL THEN 
            CASE WHEN one_month_accurate THEN 1.0 ELSE 0.0 END 
          END) * 100, 0) as one_month_accuracy,
          
          COALESCE(AVG(CASE WHEN one_month_price_accurate IS NOT NULL THEN 
            CASE WHEN one_month_price_accurate THEN 1.0 ELSE 0.0 END 
          END) * 100, 0) as one_month_price_accuracy,
          
          COALESCE(AVG(CASE WHEN one_month_direction_accurate IS NOT NULL THEN 
            CASE WHEN one_month_direction_accurate THEN 1.0 ELSE 0.0 END 
          END) * 100, 0) as one_month_direction_accuracy,
          
          -- Average weighted score
          COALESCE(AVG(
            COALESCE(one_day_weighted_score, 0) + 
            COALESCE(one_week_weighted_score, 0) + 
            COALESCE(one_month_weighted_score, 0)
          ), 0) as average_weighted_score
          
        FROM predictions ${whereClause}
      `);

      const stats = result.rows[0] as any;
      const duration = Date.now() - startTime;

      logger.performance('ACCURACY_STATISTICS', duration, { 
        symbol: symbol || 'ALL',
        totalPredictions: stats.total_predictions 
      });

      return {
        oneDayAccuracy: parseFloat(stats.one_day_accuracy) || 0,
        oneWeekAccuracy: parseFloat(stats.one_week_accuracy) || 0,
        oneMonthAccuracy: parseFloat(stats.one_month_accuracy) || 0,
        oneDayPriceAccuracy: parseFloat(stats.one_day_price_accuracy) || 0,
        oneWeekPriceAccuracy: parseFloat(stats.one_week_price_accuracy) || 0,
        oneMonthPriceAccuracy: parseFloat(stats.one_month_price_accuracy) || 0,
        oneDayDirectionAccuracy: parseFloat(stats.one_day_direction_accuracy) || 0,
        oneWeekDirectionAccuracy: parseFloat(stats.one_week_direction_accuracy) || 0,
        oneMonthDirectionAccuracy: parseFloat(stats.one_month_direction_accuracy) || 0,
        averageWeightedScore: parseFloat(stats.average_weighted_score) || 0,
        totalPredictions: parseInt(stats.total_predictions) || 0,
      };

    } catch (error) {
      logger.error('BATCH_OPERATIONS', 'Failed to get accuracy statistics', error);
      throw error;
    }
  }

  /**
   * Optimized prediction retrieval with pagination and filtering
   */
  async getPredictionsPaginated(options: {
    symbol?: string;
    limit?: number;
    offset?: number;
    sortBy?: 'date' | 'accuracy' | 'symbol';
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<{ predictions: any[]; total: number }> {
    const { 
      symbol, 
      limit = 50, 
      offset = 0, 
      sortBy = 'date', 
      sortOrder = 'desc' 
    } = options;

    const startTime = Date.now();

    try {
      let whereClause = sql`WHERE 1=1`;
      if (symbol) {
        whereClause = sql`WHERE LOWER(symbol) LIKE ${'%' + symbol.toLowerCase() + '%'}`;
      }

      let orderClause = sql`ORDER BY prediction_date DESC`;
      if (sortBy === 'accuracy') {
        orderClause = sql`ORDER BY (
          COALESCE(one_day_accurate::int, 0) + 
          COALESCE(one_week_accurate::int, 0) + 
          COALESCE(one_month_accurate::int, 0)
        ) ${sortOrder === 'desc' ? sql`DESC` : sql`ASC`}`;
      } else if (sortBy === 'symbol') {
        orderClause = sql`ORDER BY symbol ${sortOrder === 'desc' ? sql`DESC` : sql`ASC`}`;
      }

      // Get total count
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total FROM predictions ${whereClause}
      `);
      const total = parseInt((countResult.rows[0] as any).total);

      // Get paginated results
      const predictions = await db.execute(sql`
        SELECT * FROM predictions 
        ${whereClause}
        ${orderClause}
        LIMIT ${limit} OFFSET ${offset}
      `);

      const duration = Date.now() - startTime;
      logger.performance('PAGINATED_PREDICTIONS', duration, { 
        symbol: symbol || 'ALL',
        limit,
        offset,
        total,
        resultCount: predictions.rows.length
      });

      return {
        predictions: predictions.rows,
        total
      };

    } catch (error) {
      logger.error('BATCH_OPERATIONS', 'Failed to get paginated predictions', error);
      throw error;
    }
  }
}

export const batchOperations = new BatchOperations();