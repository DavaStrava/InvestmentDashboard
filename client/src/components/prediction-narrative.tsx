import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, TrendingDown, Minus, Brain, AlertTriangle } from "lucide-react";

interface PredictionNarrativeProps {
  prediction: any;
}

export default function PredictionNarrative({ prediction }: PredictionNarrativeProps) {
  if (!prediction) return null;

  const getDirectionIcon = (direction: string) => {
    switch (direction) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-600" />;
      default: return <Minus className="h-4 w-4 text-gray-600" />;
    }
  };

  const getDirectionColor = (direction: string) => {
    switch (direction) {
      case 'up': return 'text-green-600';
      case 'down': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const formatPrice = (price: string | number) => {
    return `$${parseFloat(price.toString()).toFixed(2)}`;
  };

  return (
    <div className="space-y-4">
      {/* 1-Day Prediction */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            {getDirectionIcon(prediction.oneDayDirection)}
            1-Day Prediction
            <Badge variant="outline" className={getDirectionColor(prediction.oneDayDirection)}>
              {formatPrice(prediction.oneDayPrice)} ({prediction.oneDayConfidence}% confidence)
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {prediction.oneDayReasoning || "No detailed reasoning available for 1-day prediction."}
          </p>
        </CardContent>
      </Card>

      {/* 1-Week Prediction */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            {getDirectionIcon(prediction.oneWeekDirection)}
            1-Week Prediction
            <Badge variant="outline" className={getDirectionColor(prediction.oneWeekDirection)}>
              {formatPrice(prediction.oneWeekPrice)} ({prediction.oneWeekConfidence}% confidence)
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {prediction.oneWeekReasoning || "No detailed reasoning available for 1-week prediction."}
          </p>
        </CardContent>
      </Card>

      {/* 1-Month Prediction */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            {getDirectionIcon(prediction.oneMonthDirection)}
            1-Month Prediction
            <Badge variant="outline" className={getDirectionColor(prediction.oneMonthDirection)}>
              {formatPrice(prediction.oneMonthPrice)} ({prediction.oneMonthConfidence}% confidence)
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {prediction.oneMonthReasoning || "No detailed reasoning available for 1-month prediction."}
          </p>
        </CardContent>
      </Card>

      <Separator />

      {/* Technical Analysis */}
      {prediction.technicalAnalysisNarrative && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Brain className="h-5 w-5 text-blue-600" />
              Technical Analysis Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {prediction.technicalAnalysisNarrative}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Overall Assessment */}
      {prediction.overallAssessment && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Brain className="h-5 w-5 text-purple-600" />
              Overall Assessment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {prediction.overallAssessment}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Data Limitations */}
      {prediction.dataLimitations && (
        <Card className="border-orange-200 dark:border-orange-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-orange-600 dark:text-orange-400">
              <AlertTriangle className="h-5 w-5" />
              Data Limitations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-orange-700 dark:text-orange-300 leading-relaxed">
              {prediction.dataLimitations}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-4">
        Generated: {new Date(prediction.generatedAt || prediction.predictionDate).toLocaleString()}
        {prediction.trend && (
          <span className="ml-4">
            Trend: <span className="capitalize">{prediction.trend}</span>
          </span>
        )}
        {prediction.recommendation && (
          <span className="ml-4">
            Recommendation: <span className="capitalize">{prediction.recommendation}</span>
          </span>
        )}
      </div>
    </div>
  );
}