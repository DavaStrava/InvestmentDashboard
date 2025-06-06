import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface StockPrediction {
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
  };
  generatedAt: string;
  dataLimitations?: {
    hasLimitedHistoricalData: boolean;
    isIntradayOnly: boolean;
    longerTermPredictionsUncertain: boolean;
  };
}

export async function generateStockPrediction(
  symbol: string,
  currentPrice: number,
  historicalData: any[],
  marketData?: any
): Promise<StockPrediction> {
  try {
    // Pre-compute basic technical indicators
    const prices = historicalData.map(d => d.price);
    const volumes = historicalData.map(d => d.volume || 0);
    
    // Calculate SMA20 if enough data
    const sma20 = prices.length >= 20 ? 
      prices.slice(-20).reduce((a, b) => a + b, 0) / 20 : null;
    
    // Calculate simple RSI approximation
    const gains = [];
    const losses = [];
    for (let i = 1; i < Math.min(prices.length, 15); i++) {
      const change = prices[i] - prices[i-1];
      if (change > 0) gains.push(change);
      else losses.push(Math.abs(change));
    }
    const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / gains.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;
    const rsi = avgLoss > 0 ? 100 - (100 / (1 + (avgGain / avgLoss))) : 50;
    
    // Find support and resistance levels
    const recentPrices = prices.slice(-20);
    const support = Math.min(...recentPrices);
    const resistance = Math.max(...recentPrices);
    
    // Calculate basic regression slope
    const n = Math.min(prices.length, 10);
    const recentData = prices.slice(-n);
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += recentData[i];
      sumXY += i * recentData[i];
      sumXX += i * i;
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    const prompt = `
Current Stock: ${symbol}
Current Price: $${currentPrice}
Data Points: ${historicalData.length} five-minute intervals

Pre-computed indicators:
• SMA_20: ${sma20 ? sma20.toFixed(2) : 'insufficient data'}
• RSI_14: ${rsi.toFixed(1)}
• Recent Support: $${support.toFixed(2)}
• Recent Resistance: $${resistance.toFixed(2)}
• Price Slope: ${slope.toFixed(4)} (recent trend)
• Price Range: $${Math.min(...prices).toFixed(2)} - $${Math.max(...prices).toFixed(2)}

Please provide exactly this output:
{
  "predictions": {
    "1d": {"point": number, "low": number, "high": number, "confidence": integer},
    "1w": {"point": number, "low": number, "high": number, "confidence": integer},
    "1m": {"point": number, "low": number, "high": number, "confidence": integer}
  },
  "technical": {
    "trend": "up" | "down" | "sideways",
    "support_levels": [number],
    "resistance_levels": [number]
  },
  "recommendation": "buy" | "sell" | "hold"
}

Use common technical analysis conventions. If you must estimate a value, include "note":"estimated" for that field. Base predictions on the current price of $${currentPrice} and provided indicators.
`;

    const requestPayload = {
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a professional financial analyst. Use only the data and indicators provided or computed. If you must estimate a value (e.g., support level), include a \"note\":\"estimated\" for that field. Always respond in valid JSON format."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1, // Minimal temperature to reduce hallucinations
    };

    console.log("=== OPENAI REQUEST ===");
    console.log(JSON.stringify(requestPayload, null, 2));

    const response = await openai.chat.completions.create(requestPayload);

    console.log("=== OPENAI RESPONSE ===");
    console.log(JSON.stringify(response, null, 2));

    const analysis = JSON.parse(response.choices[0].message.content || "{}");

    console.log("=== PARSED ANALYSIS ===");
    console.log(JSON.stringify(analysis, null, 2));

    // Handle both old and new JSON formats
    let convertedPredictions = [];
    let convertedTechnical = {};

    // Check if using new simplified format
    if (analysis.predictions && analysis.predictions["1d"]) {
      // New format with 1d, 1w, 1m keys
      if (analysis.predictions["1d"]) {
        convertedPredictions.push({
          timeframe: "1 day",
          predictedPrice: analysis.predictions["1d"].point,
          confidence: analysis.predictions["1d"].confidence,
          direction: analysis.technical?.trend === "up" ? "up" : analysis.technical?.trend === "down" ? "down" : "sideways",
          reasoning: `Based on pre-computed indicators and price patterns`,
          confidenceInterval: {
            low: analysis.predictions["1d"].low,
            high: analysis.predictions["1d"].high
          }
        });
      }
      if (analysis.predictions["1w"]) {
        convertedPredictions.push({
          timeframe: "1 week",
          predictedPrice: analysis.predictions["1w"].point,
          confidence: analysis.predictions["1w"].confidence,
          direction: analysis.technical?.trend === "up" ? "up" : analysis.technical?.trend === "down" ? "down" : "sideways",
          reasoning: `Based on weekly trend analysis and support/resistance levels`,
          confidenceInterval: {
            low: analysis.predictions["1w"].low,
            high: analysis.predictions["1w"].high
          }
        });
      }
      if (analysis.predictions["1m"]) {
        convertedPredictions.push({
          timeframe: "1 month",
          predictedPrice: analysis.predictions["1m"].point,
          confidence: analysis.predictions["1m"].confidence,
          direction: analysis.technical?.trend === "up" ? "up" : analysis.technical?.trend === "down" ? "down" : "sideways",
          reasoning: `Based on longer-term technical indicators and market patterns`,
          confidenceInterval: {
            low: analysis.predictions["1m"].low,
            high: analysis.predictions["1m"].high
          }
        });
      }

      convertedTechnical = {
        trend: analysis.technical?.trend === "up" ? "bullish" : analysis.technical?.trend === "down" ? "bearish" : "neutral",
        support: analysis.technical?.support_levels?.[0] || 0,
        resistance: analysis.technical?.resistance_levels?.[0] || 0,
        rsi: rsi > 70 ? "overbought" : rsi < 30 ? "oversold" : "neutral",
        recommendation: analysis.recommendation || "hold"
      };
    } else if (Array.isArray(analysis.predictions)) {
      // Old format with array of predictions
      convertedPredictions = analysis.predictions;
      convertedTechnical = analysis.technicalAnalysis || {
        trend: "neutral" as const,
        support: 0,
        resistance: 0,
        rsi: "neutral",
        recommendation: "hold"
      };
    }

    // Detect data limitations for dynamic warnings
    const dataLimitations = {
      hasLimitedHistoricalData: historicalData.length < 100, // Less than full day
      isIntradayOnly: true, // Currently only using 1-day intraday data
      longerTermPredictionsUncertain: historicalData.length < 200 // Insufficient for weekly/monthly
    };

    return {
      symbol,
      currentPrice,
      predictions: convertedPredictions,
      technicalAnalysis: convertedTechnical,
      generatedAt: new Date().toISOString(),
      dataLimitations
    };
  } catch (error) {
    console.error("OpenAI prediction error:", error);
    throw new Error("Failed to generate stock prediction");
  }
}

export async function analyzeTrendConfidence(
  symbol: string,
  priceData: number[],
  volumeData: number[]
): Promise<{
  trendStrength: number;
  volatility: number;
  momentum: string;
  riskLevel: "low" | "medium" | "high";
}> {
  try {
    const prompt = `
Analyze the trend confidence for stock ${symbol} based on this data:

Recent Prices: ${priceData.slice(-10).join(', ')}
Recent Volumes: ${volumeData.slice(-10).join(', ')}

Provide a technical analysis focused on:
1. Trend strength (0-100 scale)
2. Price volatility assessment
3. Momentum direction
4. Overall risk level

Return JSON with: {"trendStrength": number, "volatility": number, "momentum": string, "riskLevel": string}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a quantitative analyst specializing in trend analysis and risk assessment. Provide precise numerical assessments."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    return JSON.parse(response.choices[0].message.content || "{}");
  } catch (error) {
    console.error("Trend analysis error:", error);
    return {
      trendStrength: 50,
      volatility: 50,
      momentum: "neutral",
      riskLevel: "medium"
    };
  }
}