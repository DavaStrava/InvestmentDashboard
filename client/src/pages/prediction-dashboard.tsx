import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Brain, 
  Target, 
  TrendingUp, 
  BarChart3, 
  Filter,
  ArrowUp,
  ArrowDown,
  Minus,
  CheckCircle,
  XCircle,
  Clock,
  ChartLine,
  Bell
} from "lucide-react";
import { Link } from "wouter";

interface Prediction {
  id: number;
  symbol: string;
  predictionDate: string;
  currentPrice: string;
  oneDayPrice: string;
  oneDayConfidence: number;
  oneDayDirection: string;
  oneDayActualPrice?: string;
  oneDayAccurate?: boolean;
  oneWeekPrice: string;
  oneWeekConfidence: number;
  oneWeekDirection: string;
  oneWeekActualPrice?: string;
  oneWeekAccurate?: boolean;
  oneMonthPrice: string;
  oneMonthConfidence: number;
  oneMonthDirection: string;
  oneMonthActualPrice?: string;
  oneMonthAccurate?: boolean;
  trend: string;
  recommendation: string;
  generatedAt: string;
}

interface AccuracyStats {
  oneDayAccuracy: number;
  oneWeekAccuracy: number;
  oneMonthAccuracy: number;
  totalPredictions: number;
}

export default function PredictionDashboard() {
  const [symbolFilter, setSymbolFilter] = useState("");

  const { data: predictions, isLoading: predictionsLoading } = useQuery({
    queryKey: ["/api/predictions"],
    staleTime: 30 * 1000,
  });

  const { data: accuracyStats, isLoading: accuracyLoading } = useQuery({
    queryKey: ["/api/predictions/accuracy"],
    staleTime: 30 * 1000,
  });

  const allPredictions = predictions as Prediction[] || [];
  const accuracy = (accuracyStats && typeof accuracyStats === 'object' && !Array.isArray(accuracyStats)) 
    ? accuracyStats as AccuracyStats 
    : { oneDayAccuracy: 0, oneWeekAccuracy: 0, oneMonthAccuracy: 0, totalPredictions: 0 };

  // Filter predictions by symbol
  const filteredPredictions = allPredictions.filter(p => 
    symbolFilter === "" || p.symbol.toLowerCase().includes(symbolFilter.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPrice = (price: string | number) => {
    return typeof price === 'string' ? `$${parseFloat(price).toFixed(2)}` : `$${price.toFixed(2)}`;
  };

  const getDirectionIcon = (direction: string) => {
    switch (direction.toLowerCase()) {
      case 'up': return <ArrowUp className="h-4 w-4 text-green-600" />;
      case 'down': return <ArrowDown className="h-4 w-4 text-red-600" />;
      default: return <Minus className="h-4 w-4 text-gray-600" />;
    }
  };

  const getAccuracyIcon = (accurate: boolean | null | undefined) => {
    if (accurate === null || accurate === undefined) return <Clock className="h-4 w-4 text-gray-400" />;
    return accurate ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-600" />;
  };

  const getTrendBadge = (trend: string) => {
    const color = trend === 'bullish' ? 'bg-green-100 text-green-800' : 
                  trend === 'bearish' ? 'bg-red-100 text-red-800' : 
                  'bg-yellow-100 text-yellow-800';
    return <Badge className={color}>{trend}</Badge>;
  };

  if (predictionsLoading || accuracyLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
            <div className="flex justify-between items-center h-14 sm:h-16">
              <div className="flex items-center space-x-4 sm:space-x-8 min-w-0">
                <div className="flex items-center space-x-2 min-w-0">
                  <ChartLine className="text-primary text-lg sm:text-2xl flex-shrink-0" />
                  <h1 className="text-base sm:text-xl font-bold text-gray-900 truncate">PortfolioTracker</h1>
                </div>
                <nav className="hidden sm:flex space-x-4 lg:space-x-6">
                  <Link href="/portfolio">
                    <button className="font-medium pb-1 text-gray-600 hover:text-gray-900">
                      Portfolio
                    </button>
                  </Link>
                  <button className="font-medium pb-1 text-primary border-b-2 border-primary">
                    AI Predictions Dashboard
                  </button>
                </nav>
              </div>
              <div className="flex items-center space-x-2 sm:space-x-4">
                <Link href="/portfolio">
                  <Button variant="outline" size="sm" className="h-8 sm:h-9">
                    Back to Portfolio
                  </Button>
                </Link>
                <Button variant="ghost" size="icon" className="text-gray-600 hover:text-gray-900 h-8 w-8 sm:h-10 sm:w-10">
                  <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                </Button>
              </div>
            </div>
          </div>
        </header>
        <div className="p-6 space-y-6">
          <div className="flex items-center space-x-2">
            <Brain className="w-6 h-6" />
            <h1 className="text-2xl font-bold">AI Prediction Analytics</h1>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-4 w-20" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center space-x-4 sm:space-x-8 min-w-0">
              <div className="flex items-center space-x-2 min-w-0">
                <ChartLine className="text-primary text-lg sm:text-2xl flex-shrink-0" />
                <h1 className="text-base sm:text-xl font-bold text-gray-900 truncate">PortfolioTracker</h1>
              </div>
              <nav className="hidden sm:flex space-x-4 lg:space-x-6">
                <Link href="/portfolio">
                  <button className="font-medium pb-1 text-gray-600 hover:text-gray-900">
                    Portfolio
                  </button>
                </Link>
                <button className="font-medium pb-1 text-primary border-b-2 border-primary">
                  AI Predictions Dashboard
                </button>
              </nav>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-4">
              <Link href="/portfolio">
                <Button variant="outline" size="sm" className="h-8 sm:h-9">
                  Back to Portfolio
                </Button>
              </Link>
              <Button variant="ghost" size="icon" className="text-gray-600 hover:text-gray-900 h-8 w-8 sm:h-10 sm:w-10">
                <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Brain className="w-6 h-6" />
            <h1 className="text-2xl font-bold">AI Prediction Analytics</h1>
          </div>
          <Badge variant="outline" className="text-sm">
            {accuracy.totalPredictions} Total Predictions
          </Badge>
        </div>

        {/* Overall Accuracy Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="w-5 h-5" />
              <span>Overall Accuracy Summary</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {accuracy.oneDayAccuracy.toFixed(1)}%
                </div>
                <p className="text-sm text-muted-foreground">1-Day Accuracy</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {accuracy.oneWeekAccuracy.toFixed(1)}%
                </div>
                <p className="text-sm text-muted-foreground">1-Week Accuracy</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {accuracy.oneMonthAccuracy.toFixed(1)}%
                </div>
                <p className="text-sm text-muted-foreground">1-Month Accuracy</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {accuracy.totalPredictions}
                </div>
                <p className="text-sm text-muted-foreground">Total Predictions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Filter className="w-5 h-5" />
              <span>Filters</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <div className="flex-1 max-w-sm">
                <Input
                  placeholder="Filter by symbol (e.g., AAPL)"
                  value={symbolFilter}
                  onChange={(e) => setSymbolFilter(e.target.value)}
                />
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSymbolFilter("")}
              >
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Predictions Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5" />
              <span>Prediction Performance Tracking</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Current Price</TableHead>
                    <TableHead>1-Day Prediction</TableHead>
                    <TableHead>1-Day Result</TableHead>
                    <TableHead>1-Week Prediction</TableHead>
                    <TableHead>1-Week Result</TableHead>
                    <TableHead>1-Month Prediction</TableHead>
                    <TableHead>1-Month Result</TableHead>
                    <TableHead>Trend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPredictions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        {symbolFilter ? `No predictions found for "${symbolFilter}"` : "No predictions generated yet"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPredictions.map((prediction) => (
                      <TableRow key={prediction.id}>
                        <TableCell className="font-medium">{prediction.symbol}</TableCell>
                        <TableCell>{formatDate(prediction.predictionDate)}</TableCell>
                        <TableCell>{formatPrice(prediction.currentPrice)}</TableCell>
                        
                        {/* 1-Day Prediction */}
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {getDirectionIcon(prediction.oneDayDirection)}
                            <span>{formatPrice(prediction.oneDayPrice)}</span>
                            <Badge variant="outline" className="text-xs">
                              {prediction.oneDayConfidence}%
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {getAccuracyIcon(prediction.oneDayAccurate)}
                            <span className="text-sm">
                              {prediction.oneDayActualPrice ? formatPrice(prediction.oneDayActualPrice) : "Pending"}
                            </span>
                          </div>
                        </TableCell>

                        {/* 1-Week Prediction */}
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {getDirectionIcon(prediction.oneWeekDirection)}
                            <span>{formatPrice(prediction.oneWeekPrice)}</span>
                            <Badge variant="outline" className="text-xs">
                              {prediction.oneWeekConfidence}%
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {getAccuracyIcon(prediction.oneWeekAccurate)}
                            <span className="text-sm">
                              {prediction.oneWeekActualPrice ? formatPrice(prediction.oneWeekActualPrice) : "Pending"}
                            </span>
                          </div>
                        </TableCell>

                        {/* 1-Month Prediction */}
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {getDirectionIcon(prediction.oneMonthDirection)}
                            <span>{formatPrice(prediction.oneMonthPrice)}</span>
                            <Badge variant="outline" className="text-xs">
                              {prediction.oneMonthConfidence}%
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {getAccuracyIcon(prediction.oneMonthAccurate)}
                            <span className="text-sm">
                              {prediction.oneMonthActualPrice ? formatPrice(prediction.oneMonthActualPrice) : "Pending"}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell>{getTrendBadge(prediction.trend)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}