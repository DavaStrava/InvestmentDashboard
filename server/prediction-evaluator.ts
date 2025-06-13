import { storage } from "./storage";
import { logger } from "./logger";

interface EvaluationResult {
  priceAccurate: boolean;
  directionAccurate: boolean;
  overallAccurate: boolean;
  weightedScore: number;
}

export class PredictionEvaluator {
  private readonly DEFAULT_PRICE_THRESHOLD = 5.0; // 5% threshold

  /**
   * Evaluate a prediction based on actual price vs predicted price
   */
  private evaluatePrediction(
    predictedPrice: number,
    actualPrice: number,
    predictedDirection: string,
    currentPrice: number,
    confidence: number,
    priceThreshold: number = this.DEFAULT_PRICE_THRESHOLD
  ): EvaluationResult {
    // Calculate price accuracy (within threshold percentage)
    const priceError = Math.abs(predictedPrice - actualPrice) / actualPrice * 100;
    const priceAccurate = priceError <= priceThreshold;

    // Calculate direction accuracy
    const actualDirection = this.getActualDirection(currentPrice, actualPrice);
    const directionAccurate = predictedDirection.toLowerCase() === actualDirection.toLowerCase();

    // Overall accuracy (both price and direction must be correct)
    const overallAccurate = priceAccurate && directionAccurate;

    // Calculate confidence-weighted score
    const baseScore = overallAccurate ? 1.0 : 0.0;
    const weightedScore = (baseScore * confidence) / 100;

    return {
      priceAccurate,
      directionAccurate,
      overallAccurate,
      weightedScore
    };
  }

  /**
   * Determine actual direction based on price movement
   */
  private getActualDirection(currentPrice: number, actualPrice: number): string {
    const changePercent = ((actualPrice - currentPrice) / currentPrice) * 100;
    
    if (changePercent > 1) return "up";
    if (changePercent < -1) return "down";
    return "sideways";
  }

  /**
   * Fetch current stock price for evaluation
   */
  private async fetchCurrentStockPrice(symbol: string): Promise<number | null> {
    try {
      // Use the same FMP API approach as in routes
      const FMP_API_KEY = process.env.FMP_API_KEY;
      const FMP_BASE_URL = "https://financialmodelingprep.com/api";
      
      if (!FMP_API_KEY) {
        logger.error('EVALUATION', 'FMP API key not configured');
        return null;
      }

      const response = await fetch(
        `${FMP_BASE_URL}/v3/quote/${symbol}?apikey=${FMP_API_KEY}`
      );
      const data = await response.json();
      
      if (Array.isArray(data) && data.length > 0) {
        return data[0].price || null;
      }
      
      return null;
    } catch (error) {
      logger.error('EVALUATION', `Failed to fetch current price for ${symbol}`, error);
      return null;
    }
  }

  /**
   * Evaluate predictions that are due for evaluation
   */
  async evaluateDuePredictions(): Promise<void> {
    try {
      const predictions = await storage.getPredictions();
      const now = new Date();
      
      logger.info('EVALUATION', `Checking ${predictions.length} predictions for evaluation`);

      for (const prediction of predictions) {
        const predictionDate = new Date(prediction.predictionDate);
        let needsEvaluation = false;

        const hoursSincePrediction = (now.getTime() - predictionDate.getTime()) / (60 * 60 * 1000);
        const daysSincePrediction = hoursSincePrediction / 24;
        
        // Check if market is currently closed (after 4 PM ET or before 9:30 AM ET)
        // Converting to ET: UTC-5 (EST) or UTC-4 (EDT)
        // Market closes at 20:00 UTC (4 PM EDT), opens at 13:30 UTC (9:30 AM EDT)
        const currentHour = now.getUTCHours();
        const currentMinute = now.getUTCMinutes();
        const currentTimeInMinutes = currentHour * 60 + currentMinute;
        const marketCloseTime = 20 * 60; // 20:00 UTC in minutes
        const marketOpenTime = 13 * 60 + 30; // 13:30 UTC in minutes
        const isAfterMarketClose = currentTimeInMinutes >= marketCloseTime || currentTimeInMinutes < marketOpenTime;
        
        // Debug log to verify calculation
        if (prediction.symbol === 'AMZN') {
          logger.info('EVALUATION', 'Market timing debug for AMZN', {
            currentTimeInMinutes,
            marketCloseTime,
            marketOpenTime,
            isAfterClose: currentTimeInMinutes >= marketCloseTime,
            isBeforeOpen: currentTimeInMinutes < marketOpenTime,
            finalIsAfterMarketClose: isAfterMarketClose
          });
        }
        
        logger.info('EVALUATION', `Checking ${prediction.symbol}`, {
          id: prediction.id,
          hoursSince: hoursSincePrediction.toFixed(2),
          daysSince: daysSincePrediction.toFixed(2),
          isAfterMarketClose,
          currentHour,
          currentMinute,
          currentTimeInMinutes,
          marketCloseTime,
          marketOpenTime,
          oneDayAccurate: prediction.oneDayAccurate
        });
        
        // 1-day predictions: evaluate after market close on the same day or next trading day
        // For same-day predictions: evaluate if made more than 30 minutes ago and market is closed
        // For next-day predictions: evaluate if at least 1 day has passed and market is closed
        const shouldEvaluateOneDay = prediction.oneDayAccurate === null && isAfterMarketClose && (
          (daysSincePrediction >= 1) ||  // Next day evaluation
          (hoursSincePrediction >= 0.5 && daysSincePrediction < 1)  // Same day evaluation (30 minutes minimum)
        );
        
        if (shouldEvaluateOneDay) {
          logger.info('EVALUATION', `Evaluating 1-day prediction for ${prediction.symbol}`, {
            hoursSince: hoursSincePrediction.toFixed(2),
            daysSince: daysSincePrediction.toFixed(2),
            isAfterMarketClose
          });
          await this.evaluateOneDayPrediction(prediction);
          needsEvaluation = true;
        }

        // 1-week predictions: evaluate after 7 calendar days + market close
        if (prediction.oneWeekAccurate === null && 
            daysSincePrediction >= 7 && isAfterMarketClose) {
          logger.info('EVALUATION', `Evaluating 1-week prediction for ${prediction.symbol}`, {
            daysSince: daysSincePrediction.toFixed(2),
            isAfterMarketClose
          });
          await this.evaluateOneWeekPrediction(prediction);
          needsEvaluation = true;
        }

        // 1-month predictions: evaluate after 30 calendar days + market close
        if (prediction.oneMonthAccurate === null && 
            daysSincePrediction >= 30 && isAfterMarketClose) {
          logger.info('EVALUATION', `Evaluating 1-month prediction for ${prediction.symbol}`, {
            daysSince: daysSincePrediction.toFixed(2),
            isAfterMarketClose
          });
          await this.evaluateOneMonthPrediction(prediction);
          needsEvaluation = true;
        }

        if (needsEvaluation) {
          await storage.updatePredictionEvaluationTimestamp(prediction.id);
        }
      }
    } catch (error) {
      logger.error('EVALUATION', 'Failed to evaluate due predictions', error);
    }
  }

  /**
   * Evaluate 1-day prediction
   */
  private async evaluateOneDayPrediction(prediction: any): Promise<void> {
    const actualPrice = await this.fetchCurrentStockPrice(prediction.symbol);
    if (!actualPrice) return;

    const priceThreshold = parseFloat(prediction.priceThreshold || this.DEFAULT_PRICE_THRESHOLD);
    const evaluation = this.evaluatePrediction(
      parseFloat(prediction.oneDayPrice),
      actualPrice,
      prediction.oneDayDirection,
      parseFloat(prediction.currentPrice),
      prediction.oneDayConfidence,
      priceThreshold
    );

    await storage.updatePredictionEvaluation(prediction.id, '1d', {
      actualPrice,
      priceAccurate: evaluation.priceAccurate,
      directionAccurate: evaluation.directionAccurate,
      overallAccurate: evaluation.overallAccurate,
      weightedScore: evaluation.weightedScore
    });

    logger.info('EVALUATION', `1-day prediction for ${prediction.symbol} evaluated`, {
      predicted: prediction.oneDayPrice,
      actual: actualPrice,
      accurate: evaluation.overallAccurate,
      weightedScore: evaluation.weightedScore
    });
  }

  /**
   * Evaluate 1-week prediction
   */
  private async evaluateOneWeekPrediction(prediction: any): Promise<void> {
    const actualPrice = await this.fetchCurrentStockPrice(prediction.symbol);
    if (!actualPrice) return;

    const priceThreshold = parseFloat(prediction.priceThreshold || this.DEFAULT_PRICE_THRESHOLD);
    const evaluation = this.evaluatePrediction(
      parseFloat(prediction.oneWeekPrice),
      actualPrice,
      prediction.oneWeekDirection,
      parseFloat(prediction.currentPrice),
      prediction.oneWeekConfidence,
      priceThreshold
    );

    await storage.updatePredictionEvaluation(prediction.id, '1w', {
      actualPrice,
      priceAccurate: evaluation.priceAccurate,
      directionAccurate: evaluation.directionAccurate,
      overallAccurate: evaluation.overallAccurate,
      weightedScore: evaluation.weightedScore
    });

    logger.info('EVALUATION', `1-week prediction for ${prediction.symbol} evaluated`, {
      predicted: prediction.oneWeekPrice,
      actual: actualPrice,
      accurate: evaluation.overallAccurate,
      weightedScore: evaluation.weightedScore
    });
  }

  /**
   * Evaluate 1-month prediction
   */
  private async evaluateOneMonthPrediction(prediction: any): Promise<void> {
    const actualPrice = await this.fetchCurrentStockPrice(prediction.symbol);
    if (!actualPrice) return;

    const priceThreshold = parseFloat(prediction.priceThreshold || this.DEFAULT_PRICE_THRESHOLD);
    const evaluation = this.evaluatePrediction(
      parseFloat(prediction.oneMonthPrice),
      actualPrice,
      prediction.oneMonthDirection,
      parseFloat(prediction.currentPrice),
      prediction.oneMonthConfidence,
      priceThreshold
    );

    await storage.updatePredictionEvaluation(prediction.id, '1m', {
      actualPrice,
      priceAccurate: evaluation.priceAccurate,
      directionAccurate: evaluation.directionAccurate,
      overallAccurate: evaluation.overallAccurate,
      weightedScore: evaluation.weightedScore
    });

    logger.info('EVALUATION', `1-month prediction for ${prediction.symbol} evaluated`, {
      predicted: prediction.oneMonthPrice,
      actual: actualPrice,
      accurate: evaluation.overallAccurate,
      weightedScore: evaluation.weightedScore
    });
  }

  /**
   * Check if current time is a trading day (Monday-Friday, excluding major holidays)
   */
  private isTradingDay(date: Date): boolean {
    const dayOfWeek = date.getDay();
    // 0 = Sunday, 6 = Saturday
    return dayOfWeek >= 1 && dayOfWeek <= 5;
  }

  /**
   * Get the next trading day after market close for evaluation
   */
  private getNextTradingDay(date: Date): Date {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    
    // Skip weekends
    while (!this.isTradingDay(nextDay)) {
      nextDay.setDate(nextDay.getDate() + 1);
    }
    
    return nextDay;
  }

  /**
   * Start automated evaluation service with market-aware scheduling
   */
  startEvaluationService(): void {
    logger.info('EVALUATION', 'Starting automated prediction evaluation service');
    
    // Run immediately
    this.evaluateDuePredictions();
    
    // Run more frequently during after-market hours (every 30 minutes)
    // and less frequently during market hours (every 2 hours)
    setInterval(() => {
      const now = new Date();
      const currentHour = now.getUTCHours();
      const currentMinute = now.getUTCMinutes();
      const isAfterMarketClose = currentHour >= 21 || (currentHour < 13) || (currentHour === 13 && currentMinute < 30);
      
      if (isAfterMarketClose) {
        // Run more frequently after market close when evaluations are due
        this.evaluateDuePredictions();
      }
    }, 30 * 60 * 1000); // 30 minutes
    
    // Also run every 2 hours during market hours for general maintenance
    setInterval(() => {
      this.evaluateDuePredictions();
    }, 2 * 60 * 60 * 1000); // 2 hours
  }
}

export const predictionEvaluator = new PredictionEvaluator();