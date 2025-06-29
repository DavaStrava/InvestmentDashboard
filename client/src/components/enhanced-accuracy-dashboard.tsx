import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Target, Brain, Clock } from "lucide-react";

interface EnhancedAccuracy {
  oneDayAccuracy: number;
  oneWeekAccuracy: number;
  oneMonthAccuracy: number;
  oneDayPriceAccuracy: number;
  oneWeekPriceAccuracy: number;
  oneMonthPriceAccuracy: number;
  oneDayDirectionAccuracy: number;
  oneWeekDirectionAccuracy: number;
  oneMonthDirectionAccuracy: number;
  averageWeightedScore: number;
  totalPredictions: number;
}

interface EnhancedAccuracyDashboardProps {
  symbol?: string;
}

export default function EnhancedAccuracyDashboard({ symbol }: EnhancedAccuracyDashboardProps) {
  const { data: accuracy, isLoading, error } = useQuery<EnhancedAccuracy>({
    queryKey: symbol ? ['/api/predictions/accuracy/enhanced', symbol] : ['/api/predictions/accuracy/enhanced'],
    enabled: true,
    retry: 1
  });

  if (error) {
    console.error('Enhanced accuracy dashboard error:', error);
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Enhanced Prediction Analytics
          </CardTitle>
          <CardDescription>Unable to load prediction analytics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-gray-500">No prediction data available yet.</p>
            <p className="text-sm text-gray-400 mt-2">Generate some predictions to see analytics here.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Enhanced Prediction Analytics
          </CardTitle>
          <CardDescription>Loading comprehensive accuracy metrics...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!accuracy) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Enhanced Prediction Analytics
          </CardTitle>
          <CardDescription>No prediction data available</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-gray-500">No predictions found.</p>
            <p className="text-sm text-gray-400 mt-2">Start making predictions in the portfolio section.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getAccuracyColor = (percentage: number) => {
    if (percentage >= 70) return "text-green-600 dark:text-green-400";
    if (percentage >= 50) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getAccuracyBadge = (percentage: number) => {
    if (percentage >= 70) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    if (percentage >= 50) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
  };

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Enhanced Prediction Analytics
            {symbol && <Badge variant="outline">{symbol}</Badge>}
          </CardTitle>
          <CardDescription>
            Comprehensive accuracy metrics with confidence weighting
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {accuracy.totalPredictions}
              </div>
              <div className="text-sm text-muted-foreground">Total Predictions</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className={`text-2xl font-bold ${getAccuracyColor(accuracy.averageWeightedScore)}`}>
                {accuracy.averageWeightedScore.toFixed(1)}%
              </div>
              <div className="text-sm text-muted-foreground">Weighted Score</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                5%
              </div>
              <div className="text-sm text-muted-foreground">Price Threshold</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overall Accuracy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Overall Accuracy (Price + Direction)
          </CardTitle>
          <CardDescription>
            Combined price and direction prediction accuracy
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>1 Day</span>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={accuracy.oneDayAccuracy} className="w-32" />
                <Badge className={getAccuracyBadge(accuracy.oneDayAccuracy)}>
                  {accuracy.oneDayAccuracy.toFixed(1)}%
                </Badge>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>1 Week</span>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={accuracy.oneWeekAccuracy} className="w-32" />
                <Badge className={getAccuracyBadge(accuracy.oneWeekAccuracy)}>
                  {accuracy.oneWeekAccuracy.toFixed(1)}%
                </Badge>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>1 Month</span>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={accuracy.oneMonthAccuracy} className="w-32" />
                <Badge className={getAccuracyBadge(accuracy.oneMonthAccuracy)}>
                  {accuracy.oneMonthAccuracy.toFixed(1)}%
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Price Accuracy */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Price Accuracy
            </CardTitle>
            <CardDescription>
              Predictions within 5% of actual price
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">1 Day</span>
                <div className="flex items-center gap-2">
                  <Progress value={accuracy.oneDayPriceAccuracy} className="w-24" />
                  <span className={`text-sm font-medium ${getAccuracyColor(accuracy.oneDayPriceAccuracy)}`}>
                    {accuracy.oneDayPriceAccuracy.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">1 Week</span>
                <div className="flex items-center gap-2">
                  <Progress value={accuracy.oneWeekPriceAccuracy} className="w-24" />
                  <span className={`text-sm font-medium ${getAccuracyColor(accuracy.oneWeekPriceAccuracy)}`}>
                    {accuracy.oneWeekPriceAccuracy.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">1 Month</span>
                <div className="flex items-center gap-2">
                  <Progress value={accuracy.oneMonthPriceAccuracy} className="w-24" />
                  <span className={`text-sm font-medium ${getAccuracyColor(accuracy.oneMonthPriceAccuracy)}`}>
                    {accuracy.oneMonthPriceAccuracy.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Direction Accuracy */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-blue-600" />
              Direction Accuracy
            </CardTitle>
            <CardDescription>
              Correct up/down/sideways predictions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">1 Day</span>
                <div className="flex items-center gap-2">
                  <Progress value={accuracy.oneDayDirectionAccuracy} className="w-24" />
                  <span className={`text-sm font-medium ${getAccuracyColor(accuracy.oneDayDirectionAccuracy)}`}>
                    {accuracy.oneDayDirectionAccuracy.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">1 Week</span>
                <div className="flex items-center gap-2">
                  <Progress value={accuracy.oneWeekDirectionAccuracy} className="w-24" />
                  <span className={`text-sm font-medium ${getAccuracyColor(accuracy.oneWeekDirectionAccuracy)}`}>
                    {accuracy.oneWeekDirectionAccuracy.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">1 Month</span>
                <div className="flex items-center gap-2">
                  <Progress value={accuracy.oneMonthDirectionAccuracy} className="w-24" />
                  <span className={`text-sm font-medium ${getAccuracyColor(accuracy.oneMonthDirectionAccuracy)}`}>
                    {accuracy.oneMonthDirectionAccuracy.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}