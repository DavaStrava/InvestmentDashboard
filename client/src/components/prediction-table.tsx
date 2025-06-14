import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Brain, Trash2, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface PredictionTableProps {
  predictions: any[];
  timeframe: '1d' | '1w' | '1m';
  symbolFilter: string;
  onDeletePrediction: (id: number) => void;
  isDeleting: boolean;
}

const formatCurrency = (value: string | number) => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatTime = (dateString: string) => {
  return new Date(dateString).toLocaleTimeString('en-US', {
    timeZone: 'America/Los_Angeles',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

const getDirectionIcon = (direction: string) => {
  switch (direction) {
    case 'up': return <TrendingUp className="w-3 h-3 text-green-600" />;
    case 'down': return <TrendingDown className="w-3 h-3 text-red-600" />;
    default: return <Minus className="w-3 h-3 text-gray-600" />;
  }
};

const getPredictionData = (prediction: any, timeframe: '1d' | '1w' | '1m') => {
  const timeframeMap = {
    '1d': {
      price: prediction.oneDayPrice,
      actualPrice: prediction.oneDayActualPrice,
      direction: prediction.oneDayDirection,
      confidence: prediction.oneDayConfidence,
      accurate: prediction.oneDayAccurate,
      priceAccurate: prediction.oneDayPriceAccurate,
      directionAccurate: prediction.oneDayDirectionAccurate,
    },
    '1w': {
      price: prediction.oneWeekPrice,
      actualPrice: prediction.oneWeekActualPrice,
      direction: prediction.oneWeekDirection,
      confidence: prediction.oneWeekConfidence,
      accurate: prediction.oneWeekAccurate,
      priceAccurate: prediction.oneWeekPriceAccurate,
      directionAccurate: prediction.oneWeekDirectionAccurate,
    },
    '1m': {
      price: prediction.oneMonthPrice,
      actualPrice: prediction.oneMonthActualPrice,
      direction: prediction.oneMonthDirection,
      confidence: prediction.oneMonthConfidence,
      accurate: prediction.oneMonthAccurate,
      priceAccurate: prediction.oneMonthPriceAccurate,
      directionAccurate: prediction.oneMonthDirectionAccurate,
    }
  };
  
  return timeframeMap[timeframe];
};

export function PredictionTable({ 
  predictions, 
  timeframe, 
  symbolFilter, 
  onDeletePrediction, 
  isDeleting 
}: PredictionTableProps) {
  const filteredPredictions = predictions.filter(
    prediction => !symbolFilter || prediction.symbol.toLowerCase().includes(symbolFilter.toLowerCase())
  );

  const getTableHeaders = () => {
    if (timeframe === '1d') {
      return [
        'Symbol', 'Date', 'Time', 'Opening Price', 'Closing Price', 'Predicted Price',
        'Price Difference', 'Accuracy %', 'Predicted Direction', 'Market Direction',
        'Direction Match', 'Confidence', 'Result', 'Actions'
      ];
    }
    return [
      'Symbol', 'Date', 'Time', 'Starting Price', 'Predicted Price',
      'Actual Price', 'Direction', 'Confidence', 'Result'
    ];
  };

  const headers = getTableHeaders();
  const colspan = headers.length;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((header, index) => (
              <TableHead key={index}>{header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredPredictions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colspan} className="text-center py-8">
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
              const data = getPredictionData(prediction, timeframe);
              const openingPrice = parseFloat(prediction.currentPrice);
              const predictedPrice = parseFloat(data.price);
              const actualPrice = data.actualPrice ? parseFloat(data.actualPrice) : null;

              if (timeframe === '1d') {
                const priceDifference = actualPrice ? actualPrice - predictedPrice : null;
                const accuracyPercentage = actualPrice ? 
                  (100 - Math.abs((actualPrice - predictedPrice) / actualPrice * 100)) : null;
                const marketDirection = actualPrice ? 
                  (actualPrice > openingPrice ? 'up' : actualPrice < openingPrice ? 'down' : 'sideways') : null;

                return (
                  <TableRow key={prediction.id}>
                    <TableCell className="font-medium">{prediction.symbol}</TableCell>
                    <TableCell>{formatDate(prediction.predictionDate)}</TableCell>
                    <TableCell className="text-sm text-gray-600">{formatTime(prediction.predictionDate)}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(prediction.currentPrice)}</TableCell>
                    <TableCell>
                      {actualPrice ? (
                        <span className="font-medium">{formatCurrency(actualPrice)}</span>
                      ) : (
                        <span className="text-gray-500">Pending</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-blue-600">{formatCurrency(data.price)}</TableCell>
                    <TableCell>
                      {priceDifference !== null ? (
                        <span className={`font-medium ${priceDifference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {priceDifference >= 0 ? '+' : ''}{formatCurrency(Math.abs(priceDifference))}
                        </span>
                      ) : (
                        <span className="text-gray-500">Pending</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {accuracyPercentage !== null ? (
                        <Badge variant={accuracyPercentage >= 95 ? 'default' : accuracyPercentage >= 85 ? 'secondary' : 'destructive'}>
                          {accuracyPercentage.toFixed(1)}%
                        </Badge>
                      ) : (
                        <span className="text-gray-500">Pending</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        {getDirectionIcon(data.direction)}
                        <span className="text-sm capitalize">{data.direction}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {marketDirection ? (
                        <div className="flex items-center space-x-1">
                          {getDirectionIcon(marketDirection)}
                          <span className="text-sm capitalize">{marketDirection}</span>
                        </div>
                      ) : (
                        <span className="text-gray-500">Pending</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {data.directionAccurate !== null ? (
                        <Badge variant={data.directionAccurate ? 'default' : 'destructive'}>
                          {data.directionAccurate ? 'Match' : 'No Match'}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{data.confidence}%</Badge>
                    </TableCell>
                    <TableCell>
                      {data.accurate !== null ? (
                        <Badge variant={data.accurate ? 'default' : 'destructive'}>
                          {data.accurate ? 'Accurate' : 'Inaccurate'}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Prediction</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this prediction for {prediction.symbol}? 
                              This action cannot be undone and will remove all associated accuracy data.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => onDeletePrediction(prediction.id)}
                              className="bg-red-600 hover:bg-red-700"
                              disabled={isDeleting}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                );
              }

              // 1-week and 1-month predictions
              return (
                <TableRow key={prediction.id}>
                  <TableCell className="font-medium">{prediction.symbol}</TableCell>
                  <TableCell>{formatDate(prediction.predictionDate)}</TableCell>
                  <TableCell className="text-sm text-gray-600">{formatTime(prediction.predictionDate)}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(prediction.currentPrice)}</TableCell>
                  <TableCell className="font-medium text-blue-600">{formatCurrency(data.price)}</TableCell>
                  <TableCell>
                    {actualPrice ? (
                      <span className="font-medium">{formatCurrency(actualPrice)}</span>
                    ) : (
                      <span className="text-gray-500">Pending</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      {getDirectionIcon(data.direction)}
                      <span className="text-sm capitalize">{data.direction}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{data.confidence}%</Badge>
                  </TableCell>
                  <TableCell>
                    {data.accurate !== null ? (
                      <Badge variant={data.accurate ? 'default' : 'destructive'}>
                        {data.accurate ? 'Accurate' : 'Inaccurate'}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Pending</Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}