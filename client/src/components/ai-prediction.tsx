import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Brain, AlertTriangle } from "lucide-react";
import { formatCurrency, formatPercent, getChangeColor } from "@/lib/utils";

interface AIPredictionProps {
  symbol: string;
}

interface Prediction {
  timeframe: string;
  predictedPrice: number;
  confidence: number;
  direction: "up" | "down" | "sideways";
  reasoning: string;
  confidenceInterval: {
    low: number;
    high: number;
  };
}

interface TechnicalAnalysis {
  trend: "bullish" | "bearish" | "neutral";
  support: number;
  resistance: number;
  rsi: string;
  recommendation: string;
}

interface StockPrediction {
  symbol: string;
  currentPrice: number;
  predictions: Prediction[];
  technicalAnalysis: TechnicalAnalysis;
  generatedAt: string;
}

export default function AIPrediction({ symbol }: AIPredictionProps) {
  const [showDetails, setShowDetails] = useState(false);

  const { data: prediction, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/stocks", symbol, "prediction"],
    queryFn: async () => {
      const response = await fetch(`/api/stocks/${symbol}/prediction`);
      if (!response.ok) {
        throw new Error("Failed to fetch prediction");
      }
      return response.json() as Promise<StockPrediction>;
    },
    refetchOnWindowFocus: false,
    staleTime: 10 * 60 * 1000, // 10 minutes
    enabled: false, // Only fetch when user requests
  });

  const getDirectionIcon = (direction: string) => {
    switch (direction) {
      case "up":
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case "down":
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      default:
        return <Minus className="w-4 h-4 text-gray-600" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "bg-green-100 text-green-800";
    if (confidence >= 60) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "bullish":
        return "text-green-600";
      case "bearish":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="w-5 h-5" />
            <span>AI Prediction</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <AlertTriangle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
            <p className="text-gray-500 mb-3">Prediction unavailable</p>
            <Button onClick={() => refetch()} variant="outline" size="sm">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Brain className="w-5 h-5" />
            <span>AI Prediction</span>
          </div>
          {!prediction && (
            <Button 
              onClick={() => refetch()} 
              size="sm"
              disabled={isLoading}
            >
              Generate
            </Button>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : prediction ? (
          <div className="space-y-6">
            {/* Current Analysis */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-600">Current Analysis</span>
                <Badge variant="outline" className={getTrendColor(prediction.technicalAnalysis.trend)}>
                  {prediction.technicalAnalysis.trend}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Support:</span>
                  <span className="ml-2 font-medium">{formatCurrency(prediction.technicalAnalysis.support)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Resistance:</span>
                  <span className="ml-2 font-medium">{formatCurrency(prediction.technicalAnalysis.resistance)}</span>
                </div>
                <div>
                  <span className="text-gray-500">RSI:</span>
                  <span className="ml-2 font-medium">{prediction.technicalAnalysis.rsi}</span>
                </div>
                <div>
                  <span className="text-gray-500">Recommendation:</span>
                  <span className="ml-2 font-medium capitalize">{prediction.technicalAnalysis.recommendation}</span>
                </div>
              </div>
            </div>

            {/* Predictions */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Price Predictions</h4>
              {prediction.predictions.map((pred, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      {getDirectionIcon(pred.direction)}
                      <span className="font-medium">{pred.timeframe}</span>
                    </div>
                    <Badge className={getConfidenceColor(pred.confidence)}>
                      {pred.confidence}% confidence
                    </Badge>
                  </div>
                  
                  <div className="mb-3">
                    <div className="flex items-center space-x-4">
                      <div>
                        <span className="text-sm text-gray-500">Predicted Price:</span>
                        <div className="font-semibold text-lg">{formatCurrency(pred.predictedPrice)}</div>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Change:</span>
                        <div className={`font-medium ${getChangeColor(pred.predictedPrice - prediction.currentPrice)}`}>
                          {pred.predictedPrice > prediction.currentPrice ? "+" : ""}
                          {formatCurrency(pred.predictedPrice - prediction.currentPrice)} 
                          ({formatPercent((pred.predictedPrice - prediction.currentPrice) / prediction.currentPrice * 100)})
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Confidence Interval */}
                  <div className="mb-3">
                    <span className="text-sm text-gray-500">Confidence Range:</span>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-sm font-medium">{formatCurrency(pred.confidenceInterval.low)}</span>
                      <div className="flex-1 h-2 bg-gray-200 rounded-full relative">
                        <div 
                          className="h-full bg-blue-500 rounded-full"
                          style={{
                            width: `${pred.confidence}%`,
                            opacity: 0.7
                          }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium">{formatCurrency(pred.confidenceInterval.high)}</span>
                    </div>
                  </div>

                  {/* Reasoning */}
                  {showDetails && (
                    <div className="bg-blue-50 rounded p-3">
                      <span className="text-sm font-medium text-blue-900">Analysis:</span>
                      <p className="text-sm text-blue-800 mt-1">{pred.reasoning}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Toggle Details */}
            <div className="flex justify-between items-center pt-4 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? "Hide Details" : "Show Analysis"}
              </Button>
              <span className="text-xs text-gray-500">
                Generated: {new Date(prediction.generatedAt).toLocaleTimeString()}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <Brain className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">Generate AI-powered price predictions</p>
            <Button onClick={() => refetch()}>
              Analyze Stock
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}