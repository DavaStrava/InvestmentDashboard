import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, TrendingDown, Minus, Brain, AlertTriangle } from "lucide-react";

interface PredictionNarrativeProps {
  prediction: any;
}

export default function PredictionNarrative({ prediction }: PredictionNarrativeProps) {
  if (!prediction) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-yellow-600 mb-2">No Prediction Data</h3>
            <p className="text-gray-500">
              Prediction data is not available or could not be loaded.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Validate that we have the essential prediction data
  const hasEssentialData = prediction.oneDayPrice || prediction.oneWeekPrice || prediction.oneMonthPrice;
  if (!hasEssentialData) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-600 mb-2">Invalid Prediction Data</h3>
            <p className="text-gray-500">
              The prediction data appears to be incomplete or corrupted.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

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

  const formatPrice = (price: string | number | null | undefined) => {
    if (price === null || price === undefined || price === '') {
      return 'N/A';
    }
    try {
      const numPrice = parseFloat(price.toString());
      if (isNaN(numPrice)) {
        return 'N/A';
      }
      return `$${numPrice.toFixed(2)}`;
    } catch {
      return 'N/A';
    }
  };

  const formatConfidence = (confidence: string | number | null | undefined) => {
    if (confidence === null || confidence === undefined || confidence === '') {
      return 'N/A';
    }
    try {
      const numConfidence = parseFloat(confidence.toString());
      if (isNaN(numConfidence)) {
        return 'N/A';
      }
      return `${numConfidence}%`;
    } catch {
      return 'N/A';
    }
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
              {formatPrice(prediction.oneDayPrice)} ({formatConfidence(prediction.oneDayConfidence)} confidence)
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
              {formatPrice(prediction.oneWeekPrice)} ({formatConfidence(prediction.oneWeekConfidence)} confidence)
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
              {formatPrice(prediction.oneMonthPrice)} ({formatConfidence(prediction.oneMonthConfidence)} confidence)
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