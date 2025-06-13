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
      
      for (const prediction of predictions) {
        const predictionDate = new Date(prediction.predictionDate);
        let needsEvaluation = false;

        // Check 1-day predictions (evaluate after 1 day + 4 hours buffer)
        if (!prediction.oneDayAccurate && 
            now.getTime() - predictionDate.getTime() > (25 * 60 * 60 * 1000)) {
          await this.evaluateOneDayPrediction(prediction);
          needsEvaluation = true;
        }

        // Check 1-week predictions (evaluate after 7 days + 1 day buffer)
        if (!prediction.oneWeekAccurate && 
            now.getTime() - predictionDate.getTime() > (8 * 24 * 60 * 60 * 1000)) {
          await this.evaluateOneWeekPrediction(prediction);
          needsEvaluation = true;
        }

        // Check 1-month predictions (evaluate after 30 days + 2 days buffer)
        if (!prediction.oneMonthAccurate && 
            now.getTime() - predictionDate.getTime() > (32 * 24 * 60 * 60 * 1000)) {
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
   * Start automated evaluation service (runs every hour)
   */
  startEvaluationService(): void {
    logger.info('EVALUATION', 'Starting automated prediction evaluation service');
    
    // Run immediately
    this.evaluateDuePredictions();
    
    // Then run every hour
    setInterval(() => {
      this.evaluateDuePredictions();
    }, 60 * 60 * 1000); // 1 hour
  }
}

export const predictionEvaluator = new PredictionEvaluator();