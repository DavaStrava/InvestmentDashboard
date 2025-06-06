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
}

export async function generateStockPrediction(
  symbol: string,
  currentPrice: number,
  historicalData: any[],
  marketData?: any
): Promise<StockPrediction> {
  try {
    const prompt = `
Analyze the stock ${symbol} with current price $${currentPrice} and provide comprehensive predictions.

Historical Price Data (last ${historicalData.length} data points):
${historicalData.slice(-20).map(d => `Time: ${d.time}, Price: $${d.price}, Volume: ${d.volume || 'N/A'}`).join('\n')}

Please provide a detailed analysis in JSON format with:
1. Price predictions for 1 day, 1 week, 1 month timeframes
2. Confidence levels (0-100) for each prediction
3. Price confidence intervals (low/high estimates)
4. Technical analysis including trend, support/resistance levels
5. Clear reasoning for each prediction
6. Overall recommendation

Return valid JSON only with this structure:
{
  "predictions": [
    {
      "timeframe": "1 day",
      "predictedPrice": number,
      "confidence": number (0-100),
      "direction": "up|down|sideways",
      "reasoning": "detailed explanation",
      "confidenceInterval": {"low": number, "high": number}
    }
  ],
  "technicalAnalysis": {
    "trend": "bullish|bearish|neutral",
    "support": number,
    "resistance": number,
    "rsi": "overbought|oversold|neutral",
    "recommendation": "buy|sell|hold"
  }
}
`;

    const requestPayload = {
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a professional financial analyst with expertise in technical analysis and stock prediction. Provide accurate, data-driven predictions with realistic confidence levels. Always respond with valid JSON only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3, // Lower temperature for more consistent financial analysis
    };

    console.log("=== OPENAI REQUEST ===");
    console.log(JSON.stringify(requestPayload, null, 2));

    const response = await openai.chat.completions.create(requestPayload);

    console.log("=== OPENAI RESPONSE ===");
    console.log(JSON.stringify(response, null, 2));

    const analysis = JSON.parse(response.choices[0].message.content || "{}");

    console.log("=== PARSED ANALYSIS ===");
    console.log(JSON.stringify(analysis, null, 2));

    return {
      symbol,
      currentPrice,
      predictions: analysis.predictions || [],
      technicalAnalysis: analysis.technicalAnalysis || {},
      generatedAt: new Date().toISOString(),
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