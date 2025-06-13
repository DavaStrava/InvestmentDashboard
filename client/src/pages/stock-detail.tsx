import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, BarChart3, FileText } from "lucide-react";
import { formatCurrency, formatPercent, getChangeColor } from "@/lib/utils";
import PredictionNarrative from "@/components/prediction-narrative";
import AIPrediction from "@/components/ai-prediction";
import type { StockQuote } from "@shared/schema";

export default function StockDetailPage() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const symbol = params.symbol?.toUpperCase();

  // Fetch stock quote
  const { data: quote, isLoading: quoteLoading } = useQuery<StockQuote>({
    queryKey: ["/api/stocks", symbol, "quote"],
    enabled: !!symbol,
  });

  // Check for existing prediction
  const { data: todayCheck } = useQuery({
    queryKey: ["/api/stocks", symbol, "prediction/today"],
    enabled: !!symbol,
  });

  const existingPrediction = (todayCheck as any)?.prediction;

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

  const changeColor = quote ? getChangeColor(quote.change) : "text-gray-500";

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
            <p className="text-lg text-gray-600">{quote.companyName}</p>
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
                <div className={`text-sm ${changeColor}`}>
                  {quote.change >= 0 ? "+" : ""}{formatCurrency(quote.change)} ({formatPercent(quote.changePercent)})
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Volume</div>
                <div className="font-semibold">{quote.volume?.toLocaleString() || "N/A"}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Market Cap</div>
                <div className="font-semibold">
                  {quote.marketCap ? `$${(quote.marketCap / 1e9).toFixed(1)}B` : "N/A"}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">P/E Ratio</div>
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
          <TabsTrigger value="analysis" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            AI Analysis
          </TabsTrigger>
          <TabsTrigger value="prediction" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Predictions
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
                    <div className="text-sm text-gray-500">52W High</div>
                    <div className="font-semibold">{quote.high52Week ? formatCurrency(quote.high52Week) : "N/A"}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">52W Low</div>
                    <div className="font-semibold">{quote.low52Week ? formatCurrency(quote.low52Week) : "N/A"}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Avg Volume</div>
                    <div className="font-semibold">{quote.avgVolume?.toLocaleString() || "N/A"}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Dividend Yield</div>
                    <div className="font-semibold">{quote.dividendYield ? `${quote.dividendYield.toFixed(2)}%` : "N/A"}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">EPS</div>
                    <div className="font-semibold">{quote.eps?.toFixed(2) || "N/A"}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Beta</div>
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

        <TabsContent value="analysis">
          {existingPrediction ? (
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
                  <Button onClick={() => {
                    const tabs = document.querySelector('[data-state="active"][value="prediction"]') as HTMLElement;
                    if (tabs) tabs.click();
                  }}>
                    Generate Prediction
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="prediction">
          <AIPrediction symbol={symbol} />
        </TabsContent>
      </Tabs>
    </div>
  );
}