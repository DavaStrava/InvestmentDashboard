export interface TechnicalPrediction {
  symbol: string;
  currentPrice: number;
  predictions: {
    timeframe: string;
    predictedPrice: number;
    confidence: number;
    direction: "up" | "down" | "sideways";
    reasoning: string;
    confidenceInterval: {
      low: number;
      high: number;
    };
  }[];
  technicalAnalysis: {
    trend: "bullish" | "bearish" | "neutral";
    support: number;
    resistance: number;
    rsi: string;
    recommendation: string;
    sma20: number;
    sma50: number;
    volatility: number;
    momentum: number;
  };
  generatedAt: string;
}

// Calculate Simple Moving Average
function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1];
  const slice = prices.slice(-period);
  return slice.reduce((sum, price) => sum + price, 0) / slice.length;
}

// Calculate RSI (Relative Strength Index)
function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50;
  
  const changes = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }
  
  const gains = changes.slice(-period).filter(change => change > 0);
  const losses = changes.slice(-period).filter(change => change < 0).map(loss => Math.abs(loss));
  
  const avgGain = gains.length > 0 ? gains.reduce((sum, gain) => sum + gain, 0) / period : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((sum, loss) => sum + loss, 0) / period : 0;
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// Calculate price volatility
function calculateVolatility(prices: number[]): number {
  if (prices.length < 2) return 0;
  
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  
  const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
  const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
  return Math.sqrt(variance) * 100;
}

// Calculate momentum
function calculateMomentum(prices: number[], period: number = 10): number {
  if (prices.length < period + 1) return 0;
  const current = prices[prices.length - 1];
  const past = prices[prices.length - 1 - period];
  return ((current - past) / past) * 100;
}

// Find support and resistance levels
function findSupportResistance(prices: number[]): { support: number; resistance: number } {
  if (prices.length < 10) {
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return { support: min * 0.98, resistance: max * 1.02 };
  }
  
  const recent = prices.slice(-20);
  const sorted = [...recent].sort((a, b) => a - b);
  
  // Support: 25th percentile with slight buffer
  const support = sorted[Math.floor(sorted.length * 0.25)] * 0.995;
  
  // Resistance: 75th percentile with slight buffer
  const resistance = sorted[Math.floor(sorted.length * 0.75)] * 1.005;
  
  return { support, resistance };
}

export function generateTechnicalPrediction(
  symbol: string,
  currentPrice: number,
  historicalData: { price: number; time: string; volume?: number }[]
): TechnicalPrediction {
  const prices = historicalData.map(d => d.price);
  
  // Technical indicators
  const sma20 = calculateSMA(prices, 20);
  const sma50 = calculateSMA(prices, 50);
  const rsi = calculateRSI(prices);
  const volatility = calculateVolatility(prices);
  const momentum = calculateMomentum(prices);
  const { support, resistance } = findSupportResistance(prices);
  
  // Trend analysis
  let trend: "bullish" | "bearish" | "neutral" = "neutral";
  if (currentPrice > sma20 && sma20 > sma50 && momentum > 0) {
    trend = "bullish";
  } else if (currentPrice < sma20 && sma20 < sma50 && momentum < 0) {
    trend = "bearish";
  }
  
  // RSI interpretation
  let rsiDescription = "neutral";
  if (rsi > 70) rsiDescription = "overbought";
  else if (rsi < 30) rsiDescription = "oversold";
  
  // Recommendation
  let recommendation = "hold";
  if (trend === "bullish" && rsi < 70) recommendation = "buy";
  else if (trend === "bearish" && rsi > 30) recommendation = "sell";
  
  // Generate predictions
  const predictions = [
    {
      timeframe: "1 day",
      predictedPrice: generateDayPrediction(currentPrice, trend, volatility, momentum),
      confidence: calculateConfidence(trend, volatility, prices.length),
      direction: getDirection(momentum, trend),
      reasoning: `Based on ${trend} trend, RSI at ${rsi.toFixed(1)}, and ${volatility.toFixed(1)}% volatility. Current price ${currentPrice > sma20 ? 'above' : 'below'} 20-day SMA.`,
      confidenceInterval: {
        low: currentPrice * (1 - volatility / 100 * 0.5),
        high: currentPrice * (1 + volatility / 100 * 0.5)
      }
    },
    {
      timeframe: "1 week",
      predictedPrice: generateWeekPrediction(currentPrice, trend, momentum, support, resistance),
      confidence: calculateConfidence(trend, volatility, prices.length) * 0.8,
      direction: getDirection(momentum, trend),
      reasoning: `Technical analysis suggests ${trend} momentum with support at $${support.toFixed(2)} and resistance at $${resistance.toFixed(2)}. RSI indicates ${rsiDescription} conditions.`,
      confidenceInterval: {
        low: Math.max(support * 0.98, currentPrice * (1 - volatility / 100 * 1.2)),
        high: Math.min(resistance * 1.02, currentPrice * (1 + volatility / 100 * 1.2))
      }
    },
    {
      timeframe: "1 month",
      predictedPrice: generateMonthPrediction(currentPrice, trend, sma20, sma50),
      confidence: calculateConfidence(trend, volatility, prices.length) * 0.6,
      direction: getDirection(momentum, trend),
      reasoning: `Long-term analysis based on moving average crossover and trend strength. ${sma20 > sma50 ? 'Golden cross pattern' : 'Death cross pattern'} ${sma20 > sma50 ? 'supports upward' : 'suggests downward'} movement.`,
      confidenceInterval: {
        low: currentPrice * 0.85,
        high: currentPrice * 1.15
      }
    }
  ];
  
  return {
    symbol,
    currentPrice,
    predictions,
    technicalAnalysis: {
      trend,
      support,
      resistance,
      rsi: rsiDescription,
      recommendation,
      sma20,
      sma50,
      volatility,
      momentum
    },
    generatedAt: new Date().toISOString()
  };
}

function generateDayPrediction(price: number, trend: string, volatility: number, momentum: number): number {
  let change = 0;
  
  if (trend === "bullish") {
    change = (momentum / 100) * 0.3 + (volatility / 100) * 0.1;
  } else if (trend === "bearish") {
    change = (momentum / 100) * 0.3 - (volatility / 100) * 0.1;
  } else {
    change = (momentum / 100) * 0.1;
  }
  
  return price * (1 + change);
}

function generateWeekPrediction(price: number, trend: string, momentum: number, support: number, resistance: number): number {
  if (trend === "bullish") {
    return Math.min(price * 1.05, (resistance + price) / 2);
  } else if (trend === "bearish") {
    return Math.max(price * 0.95, (support + price) / 2);
  }
  return price * (1 + momentum / 100 * 0.2);
}

function generateMonthPrediction(price: number, trend: string, sma20: number, sma50: number): number {
  const smaRatio = sma20 / sma50;
  
  if (trend === "bullish" && smaRatio > 1.02) {
    return price * 1.08;
  } else if (trend === "bearish" && smaRatio < 0.98) {
    return price * 0.92;
  }
  
  return price * (0.98 + Math.random() * 0.04); // Small random variation for neutral trend
}

function calculateConfidence(trend: string, volatility: number, dataPoints: number): number {
  let confidence = 50;
  
  // Trend strength
  if (trend === "bullish" || trend === "bearish") confidence += 20;
  
  // Volatility (lower volatility = higher confidence)
  confidence += Math.max(0, 30 - volatility);
  
  // Data quality (more data points = higher confidence)
  confidence += Math.min(20, dataPoints);
  
  return Math.min(95, Math.max(30, confidence));
}

function getDirection(momentum: number, trend: string): "up" | "down" | "sideways" {
  if (trend === "bullish" || momentum > 2) return "up";
  if (trend === "bearish" || momentum < -2) return "down";
  return "sideways";
}