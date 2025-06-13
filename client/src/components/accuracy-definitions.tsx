import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InfoIcon, TrendingUpIcon, TargetIcon, BarChartIcon } from "lucide-react";

export function AccuracyDefinitions() {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <InfoIcon className="w-5 h-5" />
          Understanding Accuracy Measures
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <TargetIcon className="w-4 h-4 text-blue-500" />
              <Badge variant="outline" className="text-blue-700 border-blue-200">
                Price Accuracy
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Measures how close the predicted price is to the actual price. 
              A prediction is considered accurate if the actual price falls within 5% of the predicted price.
              This accounts for normal market volatility and provides a realistic accuracy threshold.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUpIcon className="w-4 h-4 text-green-500" />
              <Badge variant="outline" className="text-green-700 border-green-200">
                Direction Accuracy
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Evaluates whether the predicted direction (up, down, or sideways) matches the actual price movement.
              This measures the ability to correctly predict market sentiment and momentum,
              regardless of the exact price target.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <BarChartIcon className="w-4 h-4 text-purple-500" />
              <Badge variant="outline" className="text-purple-700 border-purple-200">
                Overall Accuracy
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Combines both price and direction accuracy. A prediction is considered overall accurate
              only when both the price falls within the 5% threshold AND the direction is correct.
              This is the most stringent measure of prediction quality.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <BarChartIcon className="w-4 h-4 text-orange-500" />
              <Badge variant="outline" className="text-orange-700 border-orange-200">
                Weighted Score
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              A confidence-adjusted accuracy score calculated as (Accuracy × Original Confidence) ÷ 100.
              This rewards predictions that were both accurate and made with high confidence,
              while penalizing lucky guesses made with low confidence.
            </p>
          </div>
        </div>

        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <h4 className="font-medium mb-2">Evaluation Timing</h4>
          <p className="text-sm text-muted-foreground">
            Predictions are evaluated immediately after market close rather than waiting arbitrary time periods.
            This ensures timely and relevant accuracy assessment:
          </p>
          <ul className="text-sm text-muted-foreground mt-2 space-y-1 ml-4">
            <li>• <strong>1-day predictions:</strong> Evaluated after market close on the same or next trading day</li>
            <li>• <strong>1-week predictions:</strong> Evaluated after 7 calendar days when markets close</li>
            <li>• <strong>1-month predictions:</strong> Evaluated after 30 calendar days when markets close</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}