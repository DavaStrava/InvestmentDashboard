import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, BarChart3, FileText, TrendingUp } from "lucide-react";
import { formatCurrency, formatPercent, getChangeColor } from "@/lib/utils";
import PredictionNarrative from "@/components/prediction-narrative";
import AIPrediction from "@/components/ai-prediction";
import type { StockQuote } from "@shared/schema";

export default function StockDetailPage() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const symbol = params.symbol?.toUpperCase();

  // Fetch stock quote
  const { data: quote, isLoading: quoteLoading, error: quoteError } = useQuery<StockQuote>({
    queryKey: [`/api/stocks/${symbol}/quote`],
    queryFn: async () => {
      const response = await fetch(`/api/stocks/${symbol}/quote`);
      if (!response.ok) {
        throw new Error('Failed to fetch quote');
      }
      return response.json();
    },
    enabled: !!symbol,
  });

  // Check for existing prediction
  const { 
    data: todayCheck, 
    isLoading: predictionLoading,
    error: predictionError,
    refetch: refetchTodayCheck 
  } = useQuery({
    queryKey: ["/api/stocks", symbol, "prediction/today"],
    queryFn: async () => {
      const response = await fetch(`/api/stocks/${symbol}/prediction/today`);
      if (!response.ok) {
        if (response.status === 404) {
          return { hasTodayCheck: false, prediction: null };
        }
        throw new Error(`Failed to fetch prediction: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!symbol,
    staleTime: 0, // Always fetch fresh data
    gcTime: 30 * 1000, // Keep in cache for 30 seconds
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      // Don't retry on 404 (no prediction exists)
      if (error instanceof Error && error.message.includes('404')) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const existingPrediction = todayCheck?.prediction;
  
  // Debug logging for prediction data
  console.log(`[STOCK_DETAIL] ${symbol}: Prediction data:`, {
    predictionLoading,
    predictionError: predictionError?.message,
    hasTodayCheck: !!todayCheck,
    hasExistingPrediction: !!existingPrediction,
    todayCheckStructure: todayCheck ? Object.keys(todayCheck) : [],
    predictionKeys: existingPrediction ? Object.keys(existingPrediction) : [],
    oneDayReasoning: existingPrediction?.oneDayReasoning,
    technicalAnalysisNarrative: existingPrediction?.technicalAnalysisNarrative
  });

  if (!symbol) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Invalid Stock Symbol</h1>
          <Button 
            onClick={() => setLocation("/")} 
            className="mt-4"
          >
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setLocation("/")}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{symbol}</h1>
          {quote && (
            <p className="text-lg text-gray-600 dark:text-gray-400">{quote.companyName}</p>
          )}
        </div>
      </div>

      {/* Stock Price Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Current Price</span>
            {quote && (
              <Badge variant={quote.change >= 0 ? "default" : "destructive"}>
                {quote.change >= 0 ? "+" : ""}{formatPercent(quote.changePercent)}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {quoteLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          ) : quote ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-3xl font-bold">{formatCurrency(quote.price)}</div>
                <div className={`text-sm ${getChangeColor(quote.change)}`}>
                  {quote.change >= 0 ? "+" : ""}{formatCurrency(quote.change)} ({formatPercent(quote.changePercent)})
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Volume</div>
                <div className="font-semibold">{quote.volume?.toLocaleString() || "N/A"}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Market Cap</div>
                <div className="font-semibold">
                  {quote.marketCap ? `$${(quote.marketCap / 1e9).toFixed(1)}B` : "N/A"}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">P/E Ratio</div>
                <div className="font-semibold">{quote.peRatio?.toFixed(2) || "N/A"}</div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">
              Unable to load stock data
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="prediction" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            AI Predictions
          </TabsTrigger>
          <TabsTrigger value="analysis" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Detailed Analysis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Stock Information</CardTitle>
            </CardHeader>
            <CardContent>
              {quoteLoading ? (
                <div className="grid grid-cols-2 gap-4">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-6 w-16" />
                    </div>
                  ))}
                </div>
              ) : quote ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">52W High</div>
                    <div className="font-semibold">{quote.high52Week ? formatCurrency(quote.high52Week) : "N/A"}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">52W Low</div>
                    <div className="font-semibold">{quote.low52Week ? formatCurrency(quote.low52Week) : "N/A"}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Avg Volume</div>
                    <div className="font-semibold">{quote.avgVolume?.toLocaleString() || "N/A"}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Dividend Yield</div>
                    <div className="font-semibold">{quote.dividendYield ? `${quote.dividendYield.toFixed(2)}%` : "N/A"}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">EPS</div>
                    <div className="font-semibold">{quote.eps?.toFixed(2) || "N/A"}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Beta</div>
                    <div className="font-semibold">{quote.beta?.toFixed(2) || "N/A"}</div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  Stock information unavailable
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prediction">
          <AIPrediction 
            symbol={symbol} 
            existingPrediction={existingPrediction}
            isLoading={predictionLoading}
            onPredictionGenerated={() => refetchTodayCheck()}
          />
        </TabsContent>

        <TabsContent value="analysis">
          {predictionLoading ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <div className="flex justify-center mb-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                  </div>
                  <p className="text-gray-500">Loading prediction analysis...</p>
                </div>
              </CardContent>
            </Card>
          ) : predictionError ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <FileText className="h-12 w-12 text-red-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-red-600 mb-2">Error Loading Analysis</h3>
                  <p className="text-gray-500 mb-4">
                    {predictionError.message || "Failed to load prediction data"}
                  </p>
                  <Button 
                    onClick={() => refetchTodayCheck()} 
                    variant="outline"
                    size="sm"
                  >
                    Retry
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : existingPrediction ? (
            <PredictionNarrative prediction={existingPrediction} />
          ) : (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">No Analysis Available</h3>
                  <p className="text-gray-500 mb-4">
                    Generate an AI prediction first to view detailed analysis and reasoning.
                  </p>
                  <Button 
                    onClick={() => {
                      // Switch to prediction tab to generate
                      const predictionTab = document.querySelector('[value="prediction"]') as HTMLElement;
                      predictionTab?.click();
                    }}
                    variant="outline"
                    size="sm"
                  >
                    Generate Prediction
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}