import OpenAI from "openai";

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

interface MultiTimeframeData {
  intraday: any[];
  weekly: any[];
  monthly: any[];
}

export async function generateStockPrediction(
  symbol: string,
  currentPrice: number,
  historicalData: any[] | MultiTimeframeData,
  marketData?: any
): Promise<StockPrediction> {
  try {
    // Handle multi-timeframe data structure
    let intradayData: any[], weeklyData: any[], monthlyData: any[];
    if (Array.isArray(historicalData)) {
      // Legacy format - use as intraday
      intradayData = historicalData;
      weeklyData = [];
      monthlyData = [];
    } else {
      // New multi-timeframe format
      intradayData = historicalData.intraday || [];
      weeklyData = historicalData.weekly || [];
      monthlyData = historicalData.monthly || [];
    }

    // Pre-compute basic technical indicators from intraday data
    const prices = intradayData.map(d => d.price);
    const volumes = intradayData.map(d => d.volume || 0);
    
    // Also get weekly and monthly price trends
    const weeklyPrices = weeklyData.map(d => d.price);
    const monthlyPrices = monthlyData.map(d => d.price);
    
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
    
    // Calculate weekly and monthly trends
    const weeklyTrend = weeklyPrices.length >= 2 ? 
      ((weeklyPrices[weeklyPrices.length - 1] - weeklyPrices[0]) / weeklyPrices[0] * 100).toFixed(2) : 'N/A';
    const monthlyTrend = monthlyPrices.length >= 2 ? 
      ((monthlyPrices[monthlyPrices.length - 1] - monthlyPrices[0]) / monthlyPrices[0] * 100).toFixed(2) : 'N/A';

    const prompt = `
Analyze this stock data and provide detailed price predictions with comprehensive reasoning:

Current Stock: ${symbol}
Current Price: $${currentPrice}

MULTI-TIMEFRAME ANALYSIS:
• Intraday (5min): ${intradayData.length} data points
• Weekly trend: ${weeklyTrend}% over ${weeklyData.length} days
• Monthly trend: ${monthlyTrend}% over ${monthlyData.length} days

TECHNICAL INDICATORS (from intraday data):
• SMA_20: ${sma20 ? sma20.toFixed(2) : 'insufficient data'}
• RSI_14: ${rsi.toFixed(1)}
• Recent Support: $${support.toFixed(2)}
• Recent Resistance: $${resistance.toFixed(2)}
• Short-term Slope: ${slope.toFixed(4)} (recent intraday trend)
• Intraday Range: $${Math.min(...prices).toFixed(2)} - $${Math.max(...prices).toFixed(2)}

MARKET CONTEXT:
Consider broader market trends when making predictions. Use weekly/monthly trends to inform longer-term predictions.

Please provide exactly this output with detailed reasoning for each prediction:
{
  "predictions": {
    "1d": {
      "point": number, 
      "low": number, 
      "high": number, 
      "confidence": integer,
      "detailed_reasoning": "Comprehensive 3-4 sentence analysis explaining the technical factors, price action patterns, and market dynamics that support this 1-day prediction. Include specific references to RSI levels, support/resistance, volume patterns, and any notable price movements."
    },
    "1w": {
      "point": number, 
      "low": number, 
      "high": number, 
      "confidence": integer,
      "detailed_reasoning": "Detailed 3-4 sentence analysis for the 1-week outlook incorporating weekly trend data, momentum indicators, key technical levels, and broader market context. Explain how intraday patterns might extend into weekly movements and any potential catalysts or resistance areas."
    },
    "1m": {
      "point": number, 
      "low": number, 
      "high": number, 
      "confidence": integer,
      "detailed_reasoning": "Comprehensive 3-4 sentence analysis for the 1-month prediction considering longer-term trends, fundamental factors that might be reflected in price action, seasonal patterns, and how current technical setup could evolve. Address any limitations in longer-term technical analysis."
    }
  },
  "technical": {
    "trend": "up" | "down" | "sideways",
    "support_levels": [number],
    "resistance_levels": [number],
    "analysis_summary": "2-3 sentence overall technical assessment summarizing the key findings and overall market bias"
  },
  "recommendation": "buy" | "sell" | "hold",
  "recommendation_reasoning": "Detailed explanation of why this recommendation is appropriate given the technical analysis and risk factors"
}

Use common technical analysis conventions. Provide specific, actionable insights rather than generic statements. If you must estimate a value, include "note":"estimated" for that field. Base all analysis on the current price of $${currentPrice} and provided indicators.
`;

    const requestPayload = {
      model: "gpt-4o" as const,
      messages: [
        {
          role: "system" as const,
          content: "You are a professional financial analyst. Use only the data and indicators provided or computed. If you must estimate a value (e.g., support level), include a \"note\":\"estimated\" for that field. Always respond in valid JSON format."
        },
        {
          role: "user" as const,
          content: prompt
        }
      ],
      response_format: { type: "json_object" as const },
      temperature: 0.3,
    };

    console.log("=== AI ANALYSIS REQUEST ===");
    console.log(JSON.stringify(requestPayload, null, 2));

    const response = await openai.chat.completions.create(requestPayload);

    console.log("=== AI ANALYSIS RESPONSE ===");
    console.log(JSON.stringify(response, null, 2));

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content in AI response");
    }

    console.log("=== PARSED ANALYSIS ===");
    const analysis = JSON.parse(content);
    console.log(JSON.stringify(analysis, null, 2));

    // Transform the AI response to match our interface
    const prediction: StockPrediction = {
      symbol,
      currentPrice,
      predictions: [
        {
          timeframe: "1 Day",
          predictedPrice: analysis.predictions["1d"].point,
          confidence: analysis.predictions["1d"].confidence,
          direction: analysis.technical.trend === "up" ? "up" : analysis.technical.trend === "down" ? "down" : "sideways",
          reasoning: analysis.predictions["1d"].detailed_reasoning || `Based on ${intradayData.length} intraday data points with RSI of ${rsi.toFixed(1)} and recent ${analysis.technical.trend} trend.`,
          confidenceInterval: {
            low: analysis.predictions["1d"].low,
            high: analysis.predictions["1d"].high,
          },
        },
        {
          timeframe: "1 Week",
          predictedPrice: analysis.predictions["1w"].point,
          confidence: analysis.predictions["1w"].confidence,
          direction: weeklyTrend !== 'N/A' && parseFloat(weeklyTrend) > 0 ? "up" : weeklyTrend !== 'N/A' && parseFloat(weeklyTrend) < 0 ? "down" : "sideways",
          reasoning: analysis.predictions["1w"].detailed_reasoning || `Weekly trend of ${weeklyTrend}% suggests ${analysis.technical.trend} momentum with support at $${support.toFixed(2)}.`,
          confidenceInterval: {
            low: analysis.predictions["1w"].low,
            high: analysis.predictions["1w"].high,
          },
        },
        {
          timeframe: "1 Month",
          predictedPrice: analysis.predictions["1m"].point,
          confidence: analysis.predictions["1m"].confidence,
          direction: monthlyTrend !== 'N/A' && parseFloat(monthlyTrend) > 0 ? "up" : monthlyTrend !== 'N/A' && parseFloat(monthlyTrend) < 0 ? "down" : "sideways",
          reasoning: analysis.predictions["1m"].detailed_reasoning || `Monthly trend of ${monthlyTrend}% indicates longer-term ${analysis.recommendation} recommendation with resistance at $${resistance.toFixed(2)}.`,
          confidenceInterval: {
            low: analysis.predictions["1m"].low,
            high: analysis.predictions["1m"].high,
          },
        },
      ],
      technicalAnalysis: {
        trend: analysis.technical.trend === "up" ? "bullish" : analysis.technical.trend === "down" ? "bearish" : "neutral",
        support: analysis.technical.support_levels[0] || support,
        resistance: analysis.technical.resistance_levels[0] || resistance,
        rsi: rsi.toFixed(1),
        recommendation: analysis.recommendation,
      },
      generatedAt: new Date().toISOString(),
      dataLimitations: {
        hasLimitedHistoricalData: intradayData.length < 50,
        isIntradayOnly: weeklyData.length === 0 && monthlyData.length === 0,
        longerTermPredictionsUncertain: monthlyData.length < 20,
      },
    };

    // Store prediction in database for tracking
    try {
      const { storage } = await import("./storage");
      await storage.createPrediction({
        symbol,
        currentPrice: currentPrice.toString(),
        oneDayPrice: prediction.predictions[0].predictedPrice.toString(),
        oneDayConfidence: prediction.predictions[0].confidence,
        oneDayDirection: prediction.predictions[0].direction,
        oneDayReasoning: prediction.predictions[0].reasoning,
        oneWeekPrice: prediction.predictions[1].predictedPrice.toString(),
        oneWeekConfidence: prediction.predictions[1].confidence,
        oneWeekDirection: prediction.predictions[1].direction,
        oneWeekReasoning: prediction.predictions[1].reasoning,
        oneMonthPrice: prediction.predictions[2].predictedPrice.toString(),
        oneMonthConfidence: prediction.predictions[2].confidence,
        oneMonthDirection: prediction.predictions[2].direction,
        oneMonthReasoning: prediction.predictions[2].reasoning,
        rsi: parseFloat(prediction.technicalAnalysis.rsi).toString(),
        trend: prediction.technicalAnalysis.trend,
        recommendation: prediction.technicalAnalysis.recommendation,
        technicalAnalysisNarrative: analysis.technical.analysis_summary || "Technical analysis summary unavailable",
        overallAssessment: analysis.recommendation_reasoning || "Overall assessment unavailable",
        dataLimitations: prediction.dataLimitations ? 
          `Limited data: ${prediction.dataLimitations.hasLimitedHistoricalData ? 'Historical' : ''} ${prediction.dataLimitations.isIntradayOnly ? 'Intraday-only' : ''} ${prediction.dataLimitations.longerTermPredictionsUncertain ? 'Long-term uncertain' : ''}`.trim() : 
          null,
        generatedAt: new Date(prediction.generatedAt),
      });
      console.log(`[PREDICTION_STORED] ${symbol} prediction saved to database`);
    } catch (storageError) {
      console.error("Failed to store prediction:", storageError);
      // Don't fail the prediction if storage fails
    }

    return prediction;
  } catch (error) {
    console.error("AI prediction error:", error);
    
    // Fallback prediction using technical analysis only
    const prices = Array.isArray(historicalData) ? historicalData.map(d => d.price) : historicalData.intraday.map(d => d.price);
    const recentPrices = prices.slice(-10);
    const support = Math.min(...recentPrices);
    const resistance = Math.max(...recentPrices);
    
    return {
      symbol,
      currentPrice,
      predictions: [
        {
          timeframe: "1 Day",
          predictedPrice: currentPrice * (1 + (Math.random() - 0.5) * 0.02),
          confidence: 50,
          direction: "sideways",
          reasoning: "Technical analysis fallback due to AI service unavailability.",
          confidenceInterval: {
            low: currentPrice * 0.99,
            high: currentPrice * 1.01,
          },
        },
        {
          timeframe: "1 Week", 
          predictedPrice: currentPrice * (1 + (Math.random() - 0.5) * 0.05),
          confidence: 40,
          direction: "sideways",
          reasoning: "Limited technical indicators available.",
          confidenceInterval: {
            low: currentPrice * 0.95,
            high: currentPrice * 1.05,
          },
        },
        {
          timeframe: "1 Month",
          predictedPrice: currentPrice * (1 + (Math.random() - 0.5) * 0.10),
          confidence: 30,
          direction: "sideways",
          reasoning: "Long-term prediction requires more comprehensive analysis.",
          confidenceInterval: {
            low: currentPrice * 0.90,
            high: currentPrice * 1.10,
          },
        },
      ],
      technicalAnalysis: {
        trend: "neutral",
        support: support,
        resistance: resistance,
        rsi: "50.0",
        recommendation: "hold",
      },
      generatedAt: new Date().toISOString(),
      dataLimitations: {
        hasLimitedHistoricalData: true,
        isIntradayOnly: true,
        longerTermPredictionsUncertain: true,
      },
    };
  }
}

export async function analyzeTrendConfidence(
  symbol: string,
  prediction: any,
  marketData?: any
): Promise<number> {
  try {
    const prompt = `
Given this stock prediction for ${symbol}, rate the confidence level (0-100) based on:
- Data quality and completeness
- Technical indicator alignment
- Market conditions
- Prediction timeframe

Prediction: ${JSON.stringify(prediction)}
Market Context: ${marketData ? JSON.stringify(marketData) : 'Limited market data'}

Respond with just a number between 0-100.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system" as const,
          content: "You are a risk assessment expert. Provide only a numerical confidence score."
        },
        {
          role: "user" as const,
          content: prompt
        }
      ],
      temperature: 0.1,
    });

    const confidence = parseInt(response.choices[0].message.content || "50");
    return Math.max(0, Math.min(100, confidence));
  } catch (error) {
    console.error("Confidence analysis error:", error);
    return 50; // Default moderate confidence
  }
}