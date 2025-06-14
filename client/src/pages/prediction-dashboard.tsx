import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import EnhancedAccuracyDashboard from "@/components/enhanced-accuracy-dashboard";
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
  TrendingDown, 
  BarChart3, 
  Filter, 
  ChartLine, 
  Bell, 
  Trash2,
  AlertTriangle,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { Link } from "wouter";
import { AccuracyDefinitions } from "@/components/accuracy-definitions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
}

interface Accuracy {
  oneDayAccuracy: number;
  oneWeekAccuracy: number;
  oneMonthAccuracy: number;
  totalPredictions: number;
}

export default function PredictionDashboard() {
  const [symbolFilter, setSymbolFilter] = useState("");
  const [isOneDayOpen, setIsOneDayOpen] = useState(true);
  const [isOneWeekOpen, setIsOneWeekOpen] = useState(false);
  const [isOneMonthOpen, setIsOneMonthOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: predictions = [], isLoading: predictionsLoading } = useQuery<Prediction[]>({
    queryKey: ["/api/predictions"],
  });

  const { data: accuracy, isLoading: accuracyLoading } = useQuery<Accuracy>({
    queryKey: ["/api/predictions/accuracy"],
  });

  const deletePredictionMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/predictions/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete prediction");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/predictions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/predictions/accuracy"] });
      toast({
        title: "Success",
        description: "Prediction deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete prediction",
        variant: "destructive",
      });
    },
  });

  const filteredPredictions = predictions.filter(prediction =>
    symbolFilter === "" || prediction.symbol.toLowerCase().includes(symbolFilter.toLowerCase())
  );

  const formatCurrency = (value: string | number | undefined) => {
    if (!value) return "N/A";
    const num = typeof value === "string" ? parseFloat(value) : value;
    return `$${num.toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getDirectionIcon = (direction: string) => {
    switch (direction.toLowerCase()) {
      case "up":
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case "down":
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      default:
        return <Target className="w-4 h-4 text-gray-600" />;
    }
  };

  const getAccuracyBadge = (accurate: boolean | null | undefined, predictionDate: string, timeframeHours: number) => {
    // Check if enough time has passed for evaluation
    const now = new Date();
    const predDate = new Date(predictionDate);
    const hoursElapsed = (now.getTime() - predDate.getTime()) / (1000 * 60 * 60);
    
    if (accurate === null || accurate === undefined) {
      if (hoursElapsed < timeframeHours) {
        return <Badge variant="secondary">Pending</Badge>;
      } else {
        return <Badge variant="outline" className="text-yellow-600">Awaiting Evaluation</Badge>;
      }
    }
    
    return accurate ? (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Accurate</Badge>
    ) : (
      <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Inaccurate</Badge>
    );
  };

  if (predictionsLoading || accuracyLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
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

  if (!accuracy) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">No prediction data available</h1>
            <p className="text-muted-foreground">Start by making some predictions in the portfolio section.</p>
          </div>
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

        {/* Enhanced Analytics */}
        <EnhancedAccuracyDashboard />

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

        {/* 1-Day Predictions Table */}
        <Collapsible open={isOneDayOpen} onOpenChange={setIsOneDayOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-gray-50">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Target className="w-5 h-5" />
                    <span>1-Day Predictions</span>
                  </div>
                  {isOneDayOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Opening Price</TableHead>
                    <TableHead>Closing Price</TableHead>
                    <TableHead>Predicted Price</TableHead>
                    <TableHead>Price Difference</TableHead>
                    <TableHead>Accuracy %</TableHead>
                    <TableHead>Predicted Direction</TableHead>
                    <TableHead>Market Direction</TableHead>
                    <TableHead>Direction Match</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPredictions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={14} className="text-center py-8">
                        <div className="flex flex-col items-center space-y-2">
                          <Brain className="w-8 h-8 text-gray-400" />
                          <p className="text-gray-500">
                            {symbolFilter ? `No predictions found for "${symbolFilter}"` : "No predictions available"}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPredictions.map((prediction) => {
                      const openingPrice = parseFloat(prediction.currentPrice);
                      const predictedPrice = parseFloat(prediction.oneDayPrice);
                      const actualPrice = prediction.oneDayActualPrice ? parseFloat(prediction.oneDayActualPrice) : null;
                      const priceDifference = actualPrice ? actualPrice - predictedPrice : null;
                      
                      // Calculate accuracy percentage
                      const accuracyPercentage = actualPrice ? 
                        (100 - Math.abs((actualPrice - predictedPrice) / actualPrice * 100)) : null;
                      
                      // Calculate actual market direction
                      const marketDirection = actualPrice ? 
                        (actualPrice > openingPrice ? 'up' : actualPrice < openingPrice ? 'down' : 'sideways') : null;
                      
                      return (
                        <TableRow key={prediction.id}>
                          <TableCell className="font-medium">{prediction.symbol}</TableCell>
                          <TableCell>{formatDate(prediction.predictionDate)}</TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {new Date(prediction.predictionDate).toLocaleTimeString('en-US', {
                              timeZone: 'America/Los_Angeles',
                              hour12: false,
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(prediction.currentPrice)}
                          </TableCell>
                          <TableCell>
                            {actualPrice ? (
                              <span className="font-medium">
                                {formatCurrency(prediction.oneDayActualPrice)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-sm">Pending</span>
                            )}
                          </TableCell>
                          <TableCell className="font-medium text-blue-600">
                            {formatCurrency(prediction.oneDayPrice)}
                          </TableCell>
                          <TableCell>
                            {priceDifference !== null ? (
                              <div className={`font-medium ${priceDifference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {priceDifference >= 0 ? '+' : ''}{formatCurrency(Math.abs(priceDifference))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {accuracyPercentage !== null ? (
                              <div className={`font-medium ${accuracyPercentage >= 90 ? 'text-green-600' : accuracyPercentage >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                                {accuracyPercentage.toFixed(1)}%
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-1">
                              {getDirectionIcon(prediction.oneDayDirection)}
                              <span className="text-sm capitalize">{prediction.oneDayDirection}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {marketDirection ? (
                              <div className="flex items-center space-x-1">
                                {getDirectionIcon(marketDirection)}
                                <span className="text-sm capitalize">{marketDirection}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">Pending</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {marketDirection ? (
                              <div className="flex items-center justify-center">
                                {prediction.oneDayDirection === marketDirection ? (
                                  <div className="flex items-center space-x-1 text-green-600">
                                    <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                                    <span className="text-xs font-medium">Match</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center space-x-1 text-red-600">
                                    <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                                    <span className="text-xs font-medium">Miss</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {prediction.oneDayConfidence}%
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {getAccuracyBadge(prediction.oneDayAccurate, prediction.predictionDate, 24)}
                          </TableCell>
                          <TableCell>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5 text-red-600" />
                                    Delete Prediction
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this prediction for {prediction.symbol}? 
                                    This action cannot be undone and will remove all associated accuracy data.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deletePredictionMutation.mutate(prediction.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* 1-Week Predictions Table */}
        <Collapsible open={isOneWeekOpen} onOpenChange={setIsOneWeekOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-gray-50">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <BarChart3 className="w-5 h-5" />
                    <span>1-Week Predictions</span>
                  </div>
                  {isOneWeekOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Starting Price</TableHead>
                    <TableHead>Predicted Price</TableHead>
                    <TableHead>Actual Price</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPredictions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        <div className="flex flex-col items-center space-y-2">
                          <Brain className="w-8 h-8 text-gray-400" />
                          <p className="text-gray-500">
                            {symbolFilter ? `No predictions found for "${symbolFilter}"` : "No predictions available"}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPredictions.map((prediction) => (
                      <TableRow key={prediction.id}>
                        <TableCell className="font-medium">{prediction.symbol}</TableCell>
                        <TableCell>{formatDate(prediction.predictionDate)}</TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {new Date(prediction.predictionDate).toLocaleTimeString('en-US', {
                            timeZone: 'America/Los_Angeles',
                            hour12: false,
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(prediction.currentPrice)}
                        </TableCell>
                        <TableCell className="font-medium text-blue-600">
                          {formatCurrency(prediction.oneWeekPrice)}
                        </TableCell>
                        <TableCell>
                          {prediction.oneWeekActualPrice ? (
                            <span className="font-medium">
                              {formatCurrency(prediction.oneWeekActualPrice)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">Pending</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            {getDirectionIcon(prediction.oneWeekDirection)}
                            <span className="text-sm capitalize">{prediction.oneWeekDirection}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {prediction.oneWeekConfidence}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {getAccuracyBadge(prediction.oneWeekAccurate, prediction.predictionDate, 168)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* 1-Month Predictions Table */}
        <Collapsible open={isOneMonthOpen} onOpenChange={setIsOneMonthOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-gray-50">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-5 h-5" />
                    <span>1-Month Predictions</span>
                  </div>
                  {isOneMonthOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Starting Price</TableHead>
                    <TableHead>Predicted Price</TableHead>
                    <TableHead>Actual Price</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPredictions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <div className="flex flex-col items-center space-y-2">
                          <Brain className="w-8 h-8 text-gray-400" />
                          <p className="text-gray-500">
                            {symbolFilter ? `No predictions found for "${symbolFilter}"` : "No predictions available"}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPredictions.map((prediction) => (
                      <TableRow key={prediction.id}>
                        <TableCell className="font-medium">{prediction.symbol}</TableCell>
                        <TableCell>{formatDate(prediction.predictionDate)}</TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(prediction.currentPrice)}
                        </TableCell>
                        <TableCell className="font-medium text-blue-600">
                          {formatCurrency(prediction.oneMonthPrice)}
                        </TableCell>
                        <TableCell>
                          {prediction.oneMonthActualPrice ? (
                            <span className="font-medium">
                              {formatCurrency(prediction.oneMonthActualPrice)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">Pending</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            {getDirectionIcon(prediction.oneMonthDirection)}
                            <span className="text-sm capitalize">{prediction.oneMonthDirection}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {prediction.oneMonthConfidence}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {getAccuracyBadge(prediction.oneMonthAccurate, prediction.predictionDate, 720)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Accuracy Definitions */}
        <AccuracyDefinitions />
      </div>
    </div>
  );
}