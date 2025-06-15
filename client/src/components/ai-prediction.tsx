import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Brain, AlertTriangle } from "lucide-react";
import { formatCurrency, formatPercent, getChangeColor } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

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
  dataLimitations?: {
    hasLimitedHistoricalData: boolean;
    isIntradayOnly: boolean;
    longerTermPredictionsUncertain: boolean;
  };
}

export default function AIPrediction({ symbol }: AIPredictionProps) {
  const [showDetails, setShowDetails] = useState(false);
  const queryClient = useQueryClient();

  // Check if prediction already exists for today
  const { data: todayCheck, isLoading: checkingToday, refetch: refetchTodayCheck } = useQuery({
    queryKey: ["/api/stocks", symbol, "prediction/today"],
    staleTime: 5 * 60 * 1000, // 5 minutes cache to reduce API calls
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchInterval: false,
  });

  const [forceGenerate, setForceGenerate] = useState(false);
  const [hasStoredToday, setHasStoredToday] = useState(false);
  const [manualExistingPrediction, setManualExistingPrediction] = useState<any>(null);
  const [storageAttempted, setStorageAttempted] = useState(false);

  // Clear manual prediction when symbol changes
  useEffect(() => {
    setManualExistingPrediction(null);
    setHasStoredToday(false);
  }, [symbol]);

  const hasTodaysPrediction = (todayCheck as any)?.hasPrediction || !!manualExistingPrediction;
  const existingPrediction = (todayCheck as any)?.prediction || manualExistingPrediction;
  const isWeekend = (todayCheck as any)?.isWeekend;
  const mostRecentPrediction = (todayCheck as any)?.mostRecentPrediction;
  const marketStatus = (todayCheck as any)?.marketStatus;

  console.log(`[PREDICTION_STATE] ${symbol}:`, {
    checkingToday,
    hasTodaysPrediction,
    hasExistingPrediction: !!existingPrediction,
    isWeekend,
    mostRecentPrediction: !!mostRecentPrediction,
    marketStatus,
    todayCheckData: todayCheck
  });

  // Clear manual prediction when symbol changes
  useEffect(() => {
    setManualExistingPrediction(null);
    setHasStoredToday(false);
    setStorageAttempted(false);
  }, [symbol]);
  
  const { data: prediction, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/stocks", symbol, "prediction"],
    queryFn: async () => {
      console.log(`[PREDICTION_GENERATION] ${symbol}: Starting new prediction generation`);
      const response = await fetch(`/api/stocks/${symbol}/prediction`);
      
      if (response.status === 409) {
        // Prediction already exists - don't treat as error
        console.log(`[PREDICTION_GENERATION] ${symbol}: Server prevented duplicate prediction`);
        throw new Error("DUPLICATE_PREDICTION");
      }

      if (response.status === 400) {
        // Market is closed - don't treat as error, handle gracefully
        const errorData = await response.json();
        if (errorData.marketClosed) {
          console.log(`[PREDICTION_GENERATION] ${symbol}: Market closed - ${errorData.reason}`);
          throw new Error("MARKET_CLOSED");
        }
      }
      
      if (!response.ok) {
        throw new Error("Failed to fetch prediction");
      }
      const result = await response.json() as StockPrediction;
      console.log(`[PREDICTION_GENERATION] ${symbol}: Generated new prediction:`, result);
      return result;
    },
    refetchOnWindowFocus: false,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours - predictions are valid for a day
    enabled: (!hasTodaysPrediction && !checkingToday && !hasStoredToday && !manualExistingPrediction && !isWeekend) || forceGenerate, // Only generate if no existing prediction, not weekend, OR forced
    retry: (failureCount, error) => {
      // Don't retry duplicate prediction or market closed errors
      if (error.message === "DUPLICATE_PREDICTION" || error.message === "MARKET_CLOSED") {
        return false;
      }
      return failureCount < 3;
    },
  });

  console.log(`[PREDICTION_QUERY_STATE] ${symbol}:`, {
    enabled: !hasTodaysPrediction && !checkingToday,
    isLoading,
    hasPrediction: !!prediction,
    error: error?.message
  });

  // Handle duplicate errors by manually fetching existing prediction
  useEffect(() => {
    if (error?.message === "DUPLICATE_PREDICTION" && !manualExistingPrediction) {
      console.log(`[DUPLICATE_HANDLER] ${symbol}: Duplicate error detected, fetching existing prediction`);
      
      // Manually fetch the existing prediction
      fetch(`/api/stocks/${symbol}/prediction/today`)
        .then(response => response.json())
        .then(data => {
          if (data.hasPrediction && data.prediction) {
            console.log(`[DUPLICATE_HANDLER] ${symbol}: Found existing prediction, setting manually`);
            setManualExistingPrediction(data.prediction);
          }
        })
        .catch(err => {
          console.error(`[DUPLICATE_HANDLER] ${symbol}: Error fetching existing prediction:`, err);
        });
    }
  }, [error?.message, symbol, manualExistingPrediction]);

  // Mutation to store prediction in database
  const storePredictionMutation = useMutation({
    mutationFn: async (predictionData: any) => {
      const response = await fetch("/api/predictions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(predictionData),
      });
      
      if (response.status === 409) {
        // Duplicate prediction - this is expected behavior
        const result = await response.json();
        console.log(`[PREDICTION_STORAGE] ${symbol}: Duplicate prediction prevented by server`);
        return result;
      }
      
      if (!response.ok) {
        throw new Error("Failed to store prediction");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      console.log(`[PREDICTION_STORAGE_SUCCESS] ${symbol}: Prediction operation completed`);
      // Mark as stored today to prevent duplicate generation
      setHasStoredToday(true);
      // Invalidate predictions cache to refresh the analytics dashboard
      queryClient.invalidateQueries({ queryKey: ["/api/predictions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/predictions/accuracy"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stocks", symbol, "prediction/today"] });
      // Force refetch of today's check
      refetchTodayCheck();
    },
    onError: (error) => {
      console.error(`[PREDICTION_STORAGE_ERROR] ${symbol}:`, error);
    }
  });

  // Auto-store prediction when it's successfully generated
  useEffect(() => {
    console.log(`[PREDICTION_STORAGE_EFFECT] ${symbol}:`, {
      hasPrediction: !!prediction,
      hasTodaysPrediction,
      checkingToday,
      isPending: storePredictionMutation.isPending,
      shouldStore: prediction && !hasTodaysPrediction && !checkingToday && !storePredictionMutation.isPending
    });

    if (prediction && !hasTodaysPrediction && !checkingToday && !storePredictionMutation.isPending && !storageAttempted) {
      console.log(`[PREDICTION_STORAGE_EFFECT] ${symbol}: Attempting to store prediction`);
      setStorageAttempted(true);
      
      const oneDayPred = prediction.predictions.find(p => p.timeframe === "1 day" || p.timeframe === "1 Day");
      const oneWeekPred = prediction.predictions.find(p => p.timeframe === "1 week" || p.timeframe === "1 Week");
      const oneMonthPred = prediction.predictions.find(p => p.timeframe === "1 month" || p.timeframe === "1 Month");

      if (oneDayPred && oneWeekPred && oneMonthPred) {
        const predictionData = {
          symbol: prediction.symbol,
          currentPrice: prediction.currentPrice.toString(),
          oneDayPrice: oneDayPred.predictedPrice.toString(),
          oneDayConfidence: oneDayPred.confidence,
          oneDayDirection: oneDayPred.direction,
          oneDayReasoning: oneDayPred.reasoning,
          oneWeekPrice: oneWeekPred.predictedPrice.toString(),
          oneWeekConfidence: oneWeekPred.confidence,
          oneWeekDirection: oneWeekPred.direction,
          oneWeekReasoning: oneWeekPred.reasoning,
          oneMonthPrice: oneMonthPred.predictedPrice.toString(),
          oneMonthConfidence: oneMonthPred.confidence,
          oneMonthDirection: oneMonthPred.direction,
          oneMonthReasoning: oneMonthPred.reasoning,
          trend: prediction.technicalAnalysis.trend,
          recommendation: prediction.technicalAnalysis.recommendation,
          technicalAnalysisNarrative: "Technical analysis from AI prediction",
          overallAssessment: "Overall assessment from AI analysis",
          dataLimitations: prediction.dataLimitations ? 
            `Limited data: ${prediction.dataLimitations.hasLimitedHistoricalData ? 'Historical' : ''} ${prediction.dataLimitations.isIntradayOnly ? 'Intraday-only' : ''} ${prediction.dataLimitations.longerTermPredictionsUncertain ? 'Long-term uncertain' : ''}`.trim() : 
            null,
          generatedAt: new Date(prediction.generatedAt),
        };

        console.log(`[PREDICTION_STORAGE_EFFECT] ${symbol}: Storing prediction data:`, predictionData);
        storePredictionMutation.mutate(predictionData);
        setForceGenerate(false); // Reset force flag after storing
      } else {
        console.log(`[PREDICTION_STORAGE_EFFECT] ${symbol}: Missing prediction timeframes`, {
          has1Day: !!oneDayPred,
          has1Week: !!oneWeekPred,
          has1Month: !!oneMonthPred
        });
      }
    }
  }, [prediction, hasTodaysPrediction, checkingToday, storageAttempted]);

  // Convert existing database prediction to display format
  const convertDbPredictionToDisplay = (dbPrediction: any): StockPrediction => {
    return {
      symbol: dbPrediction.symbol,
      currentPrice: parseFloat(dbPrediction.currentPrice),
      predictions: [
        {
          timeframe: "1 day",
          predictedPrice: parseFloat(dbPrediction.oneDayPrice),
          confidence: dbPrediction.oneDayConfidence,
          direction: dbPrediction.oneDayDirection,
          reasoning: `1-day technical analysis based on current market conditions and RSI of ${dbPrediction.rsi}.`,
          confidenceInterval: {
            low: parseFloat(dbPrediction.oneDayPrice) * 0.98,
            high: parseFloat(dbPrediction.oneDayPrice) * 1.02,
          },
        },
        {
          timeframe: "1 week",
          predictedPrice: parseFloat(dbPrediction.oneWeekPrice),
          confidence: dbPrediction.oneWeekConfidence,
          direction: dbPrediction.oneWeekDirection,
          reasoning: "1-week outlook incorporating weekly trend analysis and momentum indicators.",
          confidenceInterval: {
            low: parseFloat(dbPrediction.oneWeekPrice) * 0.95,
            high: parseFloat(dbPrediction.oneWeekPrice) * 1.05,
          },
        },
        {
          timeframe: "1 month",
          predictedPrice: parseFloat(dbPrediction.oneMonthPrice),
          confidence: dbPrediction.oneMonthConfidence,
          direction: dbPrediction.oneMonthDirection,
          reasoning: "1-month prediction considering longer-term trends and market dynamics.",
          confidenceInterval: {
            low: parseFloat(dbPrediction.oneMonthPrice) * 0.90,
            high: parseFloat(dbPrediction.oneMonthPrice) * 1.10,
          },
        },
      ],
      technicalAnalysis: {
        trend: dbPrediction.trend,
        support: parseFloat(dbPrediction.currentPrice) * 0.95,
        resistance: parseFloat(dbPrediction.currentPrice) * 1.05,
        rsi: dbPrediction.rsi || "N/A",
        recommendation: dbPrediction.recommendation,
      },
      generatedAt: dbPrediction.generatedAt,
    };
  };

  // Handle duplicate prediction error by treating it as success
  const isDuplicateError = error?.message === "DUPLICATE_PREDICTION";
  const effectiveHasPrediction = hasTodaysPrediction || isDuplicateError;

  // Use existing prediction if available, otherwise use newly generated one
  // When duplicate error occurs, always prefer the existing prediction
  const displayPrediction = existingPrediction 
    ? convertDbPredictionToDisplay(existingPrediction)
    : prediction;

  // Debug: Log the conversion process
  if (existingPrediction) {
    console.log(`[DB_CONVERSION] ${symbol}: Converting existing prediction:`, {
      hasExistingPrediction: !!existingPrediction,
      existingPredictionKeys: Object.keys(existingPrediction),
      displayPredictionGenerated: !!displayPrediction,
      oneDayPrice: existingPrediction.oneDayPrice,
      symbol: existingPrediction.symbol
    });
  }

  // Show prediction if we have existing data OR new prediction was generated
  const shouldShowPrediction = !!displayPrediction;

  console.log(`[PREDICTION_DISPLAY_STATE] ${symbol}:`, {
    isDuplicateError,
    effectiveHasPrediction,
    shouldShowPrediction,
    hasDisplayPrediction: !!displayPrediction,
    displayPredictionPreview: displayPrediction ? {
      symbol: displayPrediction.symbol,
      currentPrice: displayPrediction.currentPrice,
      predictionsCount: displayPrediction.predictions?.length
    } : null
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

  // Show weekend/market closed message with recent prediction
  if (isWeekend && mostRecentPrediction) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-orange-600" />
              <CardTitle>Recent AI Prediction - Market Closed</CardTitle>
            </div>
            <Badge variant="secondary">
              {marketStatus?.reason || 'Weekend'}
            </Badge>
          </div>
          <CardDescription>
            {(todayCheck as any)?.message || 'Market is closed. Showing most recent prediction.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-sm text-gray-500">
              Prediction from: {new Date(mostRecentPrediction.predictionDate).toLocaleDateString()}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900">1-Day Prediction</h4>
                <p className="text-2xl font-bold text-blue-600">
                  ${parseFloat(mostRecentPrediction.oneDayPrice).toFixed(2)}
                </p>
                <p className="text-sm text-blue-700">
                  {mostRecentPrediction.oneDayDirection} • {mostRecentPrediction.oneDayConfidence}% confidence
                </p>
              </div>

              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-medium text-green-900">1-Week Prediction</h4>
                <p className="text-2xl font-bold text-green-600">
                  ${parseFloat(mostRecentPrediction.oneWeekPrice).toFixed(2)}
                </p>
                <p className="text-sm text-green-700">
                  {mostRecentPrediction.oneWeekDirection} • {mostRecentPrediction.oneWeekConfidence}% confidence
                </p>
              </div>

              <div className="p-4 bg-purple-50 rounded-lg">
                <h4 className="font-medium text-purple-900">1-Month Prediction</h4>
                <p className="text-2xl font-bold text-purple-600">
                  ${parseFloat(mostRecentPrediction.oneMonthPrice).toFixed(2)}
                </p>
                <p className="text-sm text-purple-700">
                  {mostRecentPrediction.oneMonthDirection} • {mostRecentPrediction.oneMonthConfidence}% confidence
                </p>
              </div>
            </div>

            {mostRecentPrediction.technicalAnalysisNarrative && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Technical Analysis</h4>
                <p className="text-sm text-gray-700">{mostRecentPrediction.technicalAnalysisNarrative}</p>
              </div>
            )}

            <div className="mt-4 text-center">
              <p className="text-sm text-gray-500">
                New predictions will be available when markets reopen on the next trading day.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show weekend message when no recent predictions available
  if (isWeekend && !mostRecentPrediction) {
    return (
      <Card className="mt-6">
        <CardContent className="p-6 text-center">
          <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Market Closed</h3>
          <p className="text-gray-600">
            {(todayCheck as any)?.message || 'AI predictions are only available during trading days (Monday-Friday).'}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            No recent predictions available for {symbol}.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (error && !isDuplicateError && !existingPrediction) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="w-5 h-5" />
            <span>AI Powered Technical Analysis</span>
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
            <span>AI Powered Technical Analysis</span>
          </div>

        </CardTitle>
      </CardHeader>

      <CardContent>
        {(isLoading || checkingToday) ? (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm font-medium text-blue-800">
                  {checkingToday ? "Checking for existing predictions..." : "Generating AI prediction..."}
                </span>
              </div>
              {isLoading && (
                <div className="space-y-2 text-xs text-blue-700">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <span>Fetching current market data</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-100"></div>
                    <span>Analyzing historical price patterns</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-200"></div>
                    <span>Computing technical indicators</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-300"></div>
                    <span>Generating AI-powered predictions</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : shouldShowPrediction ? (
          <div className="space-y-4">
            {/* Always show prediction details when available */}
            {(displayPrediction || existingPrediction) && (
              <div className="space-y-4">
                {/* Show existing prediction from database */}
                {existingPrediction && (
                  <>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                      <div className="flex items-center space-x-2 mb-1">
                        <Brain className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800">Today's Analysis</span>
                      </div>
                      <p className="text-xs text-green-700">
                        Generated on {existingPrediction.predictionDate ? new Date(existingPrediction.predictionDate).toLocaleDateString() : "today"}
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <div className="text-sm text-gray-500 mb-1">1 Day Prediction</div>
                        <div className="font-semibold text-lg">
                          {existingPrediction.oneDayPrice ? formatCurrency(parseFloat(existingPrediction.oneDayPrice)) : "N/A"}
                        </div>
                        <div className="text-sm text-gray-600 mb-2">
                          {existingPrediction.oneDayConfidence || "N/A"}% confidence
                        </div>
                        <div className="flex items-center space-x-1">
                          {existingPrediction.oneDayDirection === "up" && <TrendingUp className="w-3 h-3 text-green-600" />}
                          {existingPrediction.oneDayDirection === "down" && <TrendingDown className="w-3 h-3 text-red-600" />}
                          {existingPrediction.oneDayDirection === "sideways" && <Minus className="w-3 h-3 text-gray-600" />}
                          <span className="text-xs capitalize text-gray-600">{existingPrediction.oneDayDirection}</span>
                        </div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <div className="text-sm text-gray-500 mb-1">1 Week Prediction</div>
                        <div className="font-semibold text-lg">
                          {existingPrediction.oneWeekPrice ? formatCurrency(parseFloat(existingPrediction.oneWeekPrice)) : "N/A"}
                        </div>
                        <div className="text-sm text-gray-600 mb-2">
                          {existingPrediction.oneWeekConfidence || "N/A"}% confidence
                        </div>
                        <div className="flex items-center space-x-1">
                          {existingPrediction.oneWeekDirection === "up" && <TrendingUp className="w-3 h-3 text-green-600" />}
                          {existingPrediction.oneWeekDirection === "down" && <TrendingDown className="w-3 h-3 text-red-600" />}
                          {existingPrediction.oneWeekDirection === "sideways" && <Minus className="w-3 h-3 text-gray-600" />}
                          <span className="text-xs capitalize text-gray-600">{existingPrediction.oneWeekDirection}</span>
                        </div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <div className="text-sm text-gray-500 mb-1">1 Month Prediction</div>
                        <div className="font-semibold text-lg">
                          {existingPrediction.oneMonthPrice ? formatCurrency(parseFloat(existingPrediction.oneMonthPrice)) : "N/A"}
                        </div>
                        <div className="text-sm text-gray-600 mb-2">
                          {existingPrediction.oneMonthConfidence || "N/A"}% confidence
                        </div>
                        <div className="flex items-center space-x-1">
                          {existingPrediction.oneMonthDirection === "up" && <TrendingUp className="w-3 h-3 text-green-600" />}
                          {existingPrediction.oneMonthDirection === "down" && <TrendingDown className="w-3 h-3 text-red-600" />}
                          {existingPrediction.oneMonthDirection === "sideways" && <Minus className="w-3 h-3 text-gray-600" />}
                          <span className="text-xs capitalize text-gray-600">{existingPrediction.oneMonthDirection}</span>
                        </div>
                      </div>
                    </div>

                    {/* Show technical analysis if available */}
                    {existingPrediction.trend && (
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <div className="text-sm font-medium mb-2">Technical Analysis</div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Trend: </span>
                            <span className={`font-medium ${getTrendColor(existingPrediction.trend)}`}>
                              {existingPrediction.trend}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">Recommendation: </span>
                            <span className="font-medium">{existingPrediction.recommendation || "Hold"}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Show generated prediction if no existing prediction */}
                {!existingPrediction && displayPrediction && (
                  <>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <Brain className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800">Fresh Analysis Generated</span>
                      </div>
                      <p className="text-sm text-blue-700">
                        New prediction generated using latest market data and AI analysis.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {displayPrediction.predictions.map((pred, index) => (
                        <div key={index} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                          <div className="text-sm text-gray-500 mb-1">{pred.timeframe} Prediction</div>
                          <div className="font-semibold text-lg">
                            {formatCurrency(pred.predictedPrice)}
                          </div>
                          <div className="text-sm text-gray-600 mb-2">
                            {pred.confidence}% confidence
                          </div>
                          <div className="flex items-center space-x-1">
                            {pred.direction === "up" && <TrendingUp className="w-3 h-3 text-green-600" />}
                            {pred.direction === "down" && <TrendingDown className="w-3 h-3 text-red-600" />}
                            {pred.direction === "sideways" && <Minus className="w-3 h-3 text-gray-600" />}
                            <span className="text-xs capitalize text-gray-600">{pred.direction}</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-2">
                            Range: {formatCurrency(pred.confidenceInterval.low)} - {formatCurrency(pred.confidenceInterval.high)}
                          </div>
                        </div>
                      ))}
                    </div>

                    {displayPrediction.technicalAnalysis && (
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <div className="text-sm font-medium mb-2">Technical Analysis</div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Trend: </span>
                            <span className={`font-medium ${getTrendColor(displayPrediction.technicalAnalysis.trend)}`}>
                              {displayPrediction.technicalAnalysis.trend}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">RSI: </span>
                            <span className="font-medium">{displayPrediction.technicalAnalysis.rsi}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Support: </span>
                            <span className="font-medium">{formatCurrency(displayPrediction.technicalAnalysis.support)}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Resistance: </span>
                            <span className="font-medium">{formatCurrency(displayPrediction.technicalAnalysis.resistance)}</span>
                          </div>
                        </div>
                        <div className="mt-2">
                          <span className="text-gray-600">Recommendation: </span>
                          <span className="font-medium">{displayPrediction.technicalAnalysis.recommendation}</span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        ) : prediction ? (
          <div className="space-y-6">
            {/* Data Limitations Warning - Dynamic */}
            {prediction.dataLimitations?.longerTermPredictionsUncertain && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="text-amber-800 font-medium mb-1">Limited Historical Data</p>
                    <p className="text-amber-700">
                      1-week and 1-month predictions are extrapolated from intraday data only. 
                      These are AI projections, not based on authentic weekly/monthly historical data.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Technical Analysis Overview */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-600">Technical Analysis</span>
                <Badge variant="outline" className={getTrendColor(prediction.technicalAnalysis.trend)}>
                  {prediction.technicalAnalysis.trend}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">RSI:</span>
                  <span className="ml-2 font-medium capitalize">{prediction.technicalAnalysis.rsi}</span>
                </div>
                <div>
                  <span className="text-gray-500">Recommendation:</span>
                  <span className="ml-2 font-medium capitalize">{prediction.technicalAnalysis.recommendation}</span>
                </div>
                <div>
                  <span className="text-gray-500">Support:</span>
                  <span className="ml-2 font-medium">{formatCurrency(prediction.technicalAnalysis.support)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Resistance:</span>
                  <span className="ml-2 font-medium">{formatCurrency(prediction.technicalAnalysis.resistance)}</span>
                </div>
              </div>

              {/* Overall Technical Summary - shown when details are expanded */}
              {showDetails && (
                <div className="mt-4 pt-3 border-t border-gray-200">
                  <div className="flex items-start space-x-2">
                    <Brain className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-sm font-semibold text-gray-700">Overall Assessment:</span>
                      <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                        The current technical setup shows a {prediction.technicalAnalysis.trend} bias with RSI at {prediction.technicalAnalysis.rsi}, 
                        indicating {parseFloat(prediction.technicalAnalysis.rsi) > 70 ? 'potentially overbought' : parseFloat(prediction.technicalAnalysis.rsi) < 30 ? 'potentially oversold' : 'neutral momentum'} conditions. 
                        Key support is established around {formatCurrency(prediction.technicalAnalysis.support)} while resistance sits at {formatCurrency(prediction.technicalAnalysis.resistance)}. 
                        The {prediction.technicalAnalysis.recommendation} recommendation reflects the current risk-reward profile and technical structure.
                      </p>
                    </div>
                  </div>
                </div>
              )}
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
                      {/* Individual prediction reliability indicator */}
                      {prediction.dataLimitations?.longerTermPredictionsUncertain && 
                       (pred.timeframe === "1 week" || pred.timeframe === "1 month") && (
                        <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 text-xs">
                          Extrapolated - not based on historical data
                        </Badge>
                      )}
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

                  {/* Detailed Analysis */}
                  {showDetails && (
                    <div className="bg-blue-50 rounded-lg p-4 mt-3">
                      <div className="flex items-start space-x-2">
                        <Brain className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="text-sm font-semibold text-blue-900">Technical Analysis:</span>
                          <p className="text-sm text-blue-800 mt-2 leading-relaxed">{pred.reasoning}</p>
                        </div>
                      </div>
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