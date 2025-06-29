import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain } from "lucide-react";

interface Accuracy {
  oneDayAccuracy: number;
  oneWeekAccuracy: number;
  oneMonthAccuracy: number;
  totalPredictions: number;
}

export default function SimpleAccuracyDashboard() {
  const { data: accuracy, isLoading, error } = useQuery<Accuracy>({
    queryKey: ["/api/predictions/accuracy"],
    retry: 1
  });

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Prediction Analytics
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
            Prediction Analytics
          </CardTitle>
          <CardDescription>Loading prediction metrics...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
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
            Prediction Analytics
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          Prediction Analytics
        </CardTitle>
        <CardDescription>
          AI prediction accuracy metrics
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center p-4 border rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {accuracy.totalPredictions}
            </div>
            <div className="text-sm text-muted-foreground">Total Predictions</div>
          </div>
          <div className="text-center p-4 border rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {accuracy.oneDayAccuracy.toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground">1-Day Accuracy</div>
          </div>
          <div className="text-center p-4 border rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">
              {accuracy.oneWeekAccuracy.toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground">1-Week Accuracy</div>
          </div>
          <div className="text-center p-4 border rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {accuracy.oneMonthAccuracy.toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground">1-Month Accuracy</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}