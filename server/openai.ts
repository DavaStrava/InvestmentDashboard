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
Below are exactly ${historicalData.length} five-minute data points for ${symbol} with current price $${currentPrice}.

Historical Price Data:
${historicalData.map(d => `{"time": "${d.time}", "price": ${d.price}, "volume": ${d.volume || 0}}`).join(',\n')}

Please output exactly this JSON schema (no additional keys):
{
  "predictions": [
    {
      "timeframe": "1 day",
      "predictedPrice": number or null,
      "confidence": integer 0-100,
      "direction": "up"|"down"|"sideways"|null,
      "reasoning": string,
      "confidenceInterval": {"low": number or null, "high": number or null}
    },
    {
      "timeframe": "1 week", 
      "predictedPrice": number or null,
      "confidence": integer 0-100,
      "direction": "up"|"down"|"sideways"|null,
      "reasoning": string,
      "confidenceInterval": {"low": number or null, "high": number or null}
    },
    {
      "timeframe": "1 month",
      "predictedPrice": number or null,
      "confidence": integer 0-100,
      "direction": "up"|"down"|"sideways"|null,
      "reasoning": string,
      "confidenceInterval": {"low": number or null, "high": number or null}
    }
  ],
  "technicalAnalysis": {
    "trend": "bullish"|"bearish"|"neutral"|null,
    "support": number or null,
    "resistance": number or null,
    "rsi": "overbought"|"oversold"|"neutral"|null,
    "recommendation": "buy"|"sell"|"hold"|null
  }
}

Use these definitions:
• 20-period SMA = average of last 20 closing prices
• 14-period RSI = 100 - (100 / (1 + (avg_gain/avg_loss))) over last 14 closes
• Trend is "bullish" if 20-period SMA is rising over last 4 intervals by ≥$0.10; "bearish" if falling similarly; otherwise "neutral"
• Support = local minima where price rebounded at least twice within ±0.5%
• Resistance = local maxima meeting same ±0.5% rebound criteria
• For predictions: use linear regression on available data. If R² < 0.2, set prediction to null and confidence to 0
• Confidence = integer 0-100 proportional to data quality and trend strength

If you cannot compute a field exactly from the provided data, output null and set confidence to 0. Use only the provided ${historicalData.length} data points - do not fabricate any values.
`;

    const requestPayload = {
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a professional financial analyst with expertise in technical analysis and stock prediction. Rely strictly on the data provided. If you cannot derive a metric from the provided data points, return null for that field and include a brief reason. Do not fabricate any numbers, prices, dates, or volumes. Never invent price levels or technical indicators that aren't explicitly calculable from the given data. Always respond with valid JSON only."
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