import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, BarChart3, FileText } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import PredictionNarrative from "@/components/prediction-narrative";
import AIPrediction from "@/components/ai-prediction";

export default function StockDetailPage() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const symbol = params.symbol?.toUpperCase();

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
        </div>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="prediction" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="prediction" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            AI Predictions
          </TabsTrigger>
          <TabsTrigger value="analysis" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Detailed Analysis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="prediction">
          <AIPrediction symbol={symbol} />
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
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}