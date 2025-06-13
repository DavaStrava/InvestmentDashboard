import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ScatterChart, Scatter } from "recharts";
import { TrendingUp, TrendingDown, Brain, Target, BarChart3, Filter } from "lucide-react";
import { useState } from "react";
import { formatCurrency, formatPercent } from "@/lib/utils";

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
  const [minPredictions, setMinPredictions] = useState(0);

  const { data: predictions, isLoading: predictionsLoading } = useQuery({
    queryKey: ["/api/predictions"],
    staleTime: 30 * 1000, // 30 seconds
  });

  const { data: accuracyStats, isLoading: accuracyLoading } = useQuery({
    queryKey: ["/api/predictions/accuracy"],
    staleTime: 30 * 1000,
  });

  const allPredictions = predictions as Prediction[] || [];
  const accuracy = (accuracyStats && typeof accuracyStats === 'object' && !Array.isArray(accuracyStats)) 
    ? accuracyStats as AccuracyStats 
    : { oneDayAccuracy: 0, oneWeekAccuracy: 0, oneMonthAccuracy: 0, totalPredictions: 0 };

  // Process data for charts
  const getDirectionAccuracy = (timeframe: 'oneDay' | 'oneWeek' | 'oneMonth') => {
    const relevantPredictions = allPredictions.filter(p => {
      const actualPrice = timeframe === 'oneDay' ? p.oneDayActualPrice : 
                         timeframe === 'oneWeek' ? p.oneWeekActualPrice : 
                         p.oneMonthActualPrice;
      return actualPrice !== null && actualPrice !== undefined;
    });

    const correct = relevantPredictions.filter(p => {
      return timeframe === 'oneDay' ? p.oneDayAccurate : 
             timeframe === 'oneWeek' ? p.oneWeekAccurate : 
             p.oneMonthAccurate;
    }).length;

    return [
      { name: "Correct", value: correct, color: "#22c55e" },
      { name: "Incorrect", value: relevantPredictions.length - correct, color: "#ef4444" }
    ];
  };

  // Confidence calibration data
  const getConfidenceCalibration = () => {
    const calibrationData: { confidence: number; accuracy: number; count: number }[] = [];
    
    for (let conf = 10; conf <= 100; conf += 10) {
      const predictions1d = allPredictions.filter(p => 
        p.oneDayConfidence >= conf - 5 && p.oneDayConfidence < conf + 5 && 
        p.oneDayActualPrice !== null && p.oneDayActualPrice !== undefined
      );
      
      if (predictions1d.length > 0) {
        const accurate = predictions1d.filter(p => p.oneDayAccurate).length;
        calibrationData.push({
          confidence: conf,
          accuracy: (accurate / predictions1d.length) * 100,
          count: predictions1d.length
        });
      }
    }
    
    return calibrationData;
  };

  // Stock-specific performance
  const getStockPerformance = () => {
    const stockMap = new Map();
    
    allPredictions.forEach(p => {
      if (!stockMap.has(p.symbol)) {
        stockMap.set(p.symbol, {
          symbol: p.symbol,
          total: 0,
          oneDayTotal: 0,
          oneDayCorrect: 0,
          oneWeekTotal: 0,
          oneWeekCorrect: 0,
          oneMonthTotal: 0,
          oneMonthCorrect: 0,
          avgConfidence: 0,
          confidenceSum: 0
        });
      }
      
      const stock = stockMap.get(p.symbol);
      stock.total++;
      stock.confidenceSum += (p.oneDayConfidence + p.oneWeekConfidence + p.oneMonthConfidence) / 3;
      
      if (p.oneDayActualPrice !== null && p.oneDayActualPrice !== undefined) {
        stock.oneDayTotal++;
        if (p.oneDayAccurate) stock.oneDayCorrect++;
      }
      
      if (p.oneWeekActualPrice !== null && p.oneWeekActualPrice !== undefined) {
        stock.oneWeekTotal++;
        if (p.oneWeekAccurate) stock.oneWeekCorrect++;
      }
      
      if (p.oneMonthActualPrice !== null && p.oneMonthActualPrice !== undefined) {
        stock.oneMonthTotal++;
        if (p.oneMonthAccurate) stock.oneMonthCorrect++;
      }
    });
    
    return Array.from(stockMap.values())
      .map(stock => ({
        ...stock,
        avgConfidence: stock.confidenceSum / stock.total,
        oneDayAccuracy: stock.oneDayTotal > 0 ? (stock.oneDayCorrect / stock.oneDayTotal) * 100 : 0,
        oneWeekAccuracy: stock.oneWeekTotal > 0 ? (stock.oneWeekCorrect / stock.oneWeekTotal) * 100 : 0,
        oneMonthAccuracy: stock.oneMonthTotal > 0 ? (stock.oneMonthCorrect / stock.oneMonthTotal) * 100 : 0,
      }))
      .filter(stock => 
        (symbolFilter === "" || stock.symbol.toLowerCase().includes(symbolFilter.toLowerCase())) &&
        stock.total >= minPredictions
      )
      .sort((a, b) => b.total - a.total);
  };

  // Recent predictions
  const getRecentPredictions = () => {
    return allPredictions
      .sort((a, b) => new Date(b.predictionDate).getTime() - new Date(a.predictionDate).getTime())
      .slice(0, 10);
  };

  if (predictionsLoading || accuracyLoading) {
    return (
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
    );
  }

  const oneDayDirectionData = getDirectionAccuracy('oneDay');
  const oneWeekDirectionData = getDirectionAccuracy('oneWeek');
  const oneMonthDirectionData = getDirectionAccuracy('oneMonth');
  const confidenceData = getConfidenceCalibration();
  const stockPerformance = getStockPerformance();
  const recentPredictions = getRecentPredictions();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Brain className="w-6 h-6" />
          <h1 className="text-2xl font-bold">AI Prediction Analytics</h1>
        </div>
        <Badge variant="outline" className="text-sm">
          {accuracy.totalPredictions} Total Predictions
        </Badge>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">1-Day Accuracy</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {accuracy.oneDayAccuracy.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">Short-term predictions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">1-Week Accuracy</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {accuracy.oneWeekAccuracy.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">Medium-term predictions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">1-Month Accuracy</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {accuracy.oneMonthAccuracy.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">Long-term predictions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Predictions</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{accuracy.totalPredictions}</div>
            <p className="text-xs text-muted-foreground">
              Avg: {((accuracy.oneDayAccuracy + accuracy.oneWeekAccuracy + accuracy.oneMonthAccuracy) / 3).toFixed(1)}% accuracy
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Direction Accuracy Charts */}
        <Card>
          <CardHeader>
            <CardTitle>Directional Prediction Accuracy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <h4 className="text-sm font-medium mb-2 text-center">1 Day</h4>
                <ResponsiveContainer width="100%" height={120}>
                  <PieChart>
                    <Pie
                      data={oneDayDirectionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={20}
                      outerRadius={40}
                      dataKey="value"
                    >
                      {oneDayDirectionData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2 text-center">1 Week</h4>
                <ResponsiveContainer width="100%" height={120}>
                  <PieChart>
                    <Pie
                      data={oneWeekDirectionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={20}
                      outerRadius={40}
                      dataKey="value"
                    >
                      {oneWeekDirectionData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2 text-center">1 Month</h4>
                <ResponsiveContainer width="100%" height={120}>
                  <PieChart>
                    <Pie
                      data={oneMonthDirectionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={20}
                      outerRadius={40}
                      dataKey="value"
                    >
                      {oneMonthDirectionData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Confidence Calibration */}
        <Card>
          <CardHeader>
            <CardTitle>Confidence Calibration</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <ScatterChart data={confidenceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="confidence" 
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <YAxis 
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip 
                  formatter={(value, name) => {
                    if (name === 'accuracy') {
                      return [`${Number(value).toFixed(1)}%`, 'Actual Accuracy'];
                    }
                    return [value, 'Sample Size'];
                  }}
                />
                <Scatter dataKey="accuracy" fill="#3b82f6" />
                <Line 
                  type="linear" 
                  dataKey="confidence" 
                  stroke="#94a3b8" 
                  strokeDasharray="5 5"
                  dot={false}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Stock Performance Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Stock-Specific Performance</CardTitle>
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4" />
              <Input
                placeholder="Filter by symbol..."
                value={symbolFilter}
                onChange={(e) => setSymbolFilter(e.target.value)}
                className="w-40"
              />
              <Input
                type="number"
                placeholder="Min predictions"
                value={minPredictions}
                onChange={(e) => setMinPredictions(parseInt(e.target.value) || 0)}
                className="w-32"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>1D Accuracy</TableHead>
                <TableHead>1W Accuracy</TableHead>
                <TableHead>1M Accuracy</TableHead>
                <TableHead>Avg Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stockPerformance.map((stock) => (
                <TableRow key={stock.symbol}>
                  <TableCell className="font-medium">{stock.symbol}</TableCell>
                  <TableCell>{stock.total}</TableCell>
                  <TableCell>
                    <span className={stock.oneDayAccuracy >= 60 ? "text-green-600" : stock.oneDayAccuracy >= 40 ? "text-yellow-600" : "text-red-600"}>
                      {stock.oneDayTotal > 0 ? `${stock.oneDayAccuracy.toFixed(1)}%` : "N/A"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={stock.oneWeekAccuracy >= 60 ? "text-green-600" : stock.oneWeekAccuracy >= 40 ? "text-yellow-600" : "text-red-600"}>
                      {stock.oneWeekTotal > 0 ? `${stock.oneWeekAccuracy.toFixed(1)}%` : "N/A"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={stock.oneMonthAccuracy >= 60 ? "text-green-600" : stock.oneMonthAccuracy >= 40 ? "text-yellow-600" : "text-red-600"}>
                      {stock.oneMonthTotal > 0 ? `${stock.oneMonthAccuracy.toFixed(1)}%` : "N/A"}
                    </span>
                  </TableCell>
                  <TableCell>{stock.avgConfidence.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent Predictions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Predictions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentPredictions.map((prediction) => (
              <div key={prediction.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <Badge variant="outline">{prediction.symbol}</Badge>
                  <div>
                    <p className="text-sm font-medium">
                      {formatCurrency(parseFloat(prediction.currentPrice))} → {formatCurrency(parseFloat(prediction.oneDayPrice))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(prediction.predictionDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge 
                    variant={prediction.oneDayAccurate === true ? "default" : prediction.oneDayAccurate === false ? "destructive" : "secondary"}
                  >
                    {prediction.oneDayAccurate === true ? "Correct" : 
                     prediction.oneDayAccurate === false ? "Incorrect" : "Pending"}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{prediction.oneDayConfidence}%</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}