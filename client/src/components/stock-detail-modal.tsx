import { useQuery } from "@tanstack/react-query";
import { stockApi } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatPercent, formatMarketCap, formatNumber, getChangeColor } from "@/lib/utils";
import PriceChart from "./price-chart";
import AIPrediction from "./ai-prediction";
import { X } from "lucide-react";

interface StockDetailModalProps {
  symbol: string;
  onClose: () => void;
}

export default function StockDetailModal({ symbol, onClose }: StockDetailModalProps) {
  const { data: quote, isLoading } = useQuery({
    queryKey: [`/api/stocks/${symbol}/quote`],
    enabled: !!symbol,
  });

  const getStockInitials = (symbol: string) => {
    return symbol.slice(0, 4).toUpperCase();
  };

  const getStockColor = (symbol: string) => {
    const colors = [
      "bg-blue-100 text-blue-600",
      "bg-green-100 text-green-600",
      "bg-purple-100 text-purple-600",
      "bg-orange-100 text-orange-600",
    ];
    const index = symbol.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <Dialog open={!!symbol} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto p-0">
        <div className="p-6">
          {isLoading ? (
            <div className="space-y-6">
              <DialogHeader>
                <div className="flex items-center space-x-4">
                  <Skeleton className="w-16 h-16 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              </DialogHeader>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                ))}
              </div>
              <Skeleton className="h-80 w-full" />
            </div>
          ) : !quote ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Failed to load stock data</p>
              <Button onClick={onClose} className="mt-4">Close</Button>
            </div>
          ) : (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center ${getStockColor(symbol)}`}>
                      <span className="font-bold text-lg">{getStockInitials(symbol)}</span>
                    </div>
                    <div>
                      <DialogTitle className="text-2xl font-bold">{(quote as any).companyName}</DialogTitle>
                      <p className="text-gray-500">NASDAQ: {(quote as any).symbol}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={onClose}>
                    <X className="w-6 h-6" />
                </Button>
              </div>

              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Current Price</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency((quote as any).price)}</p>
                  <p className={`text-sm ${getChangeColor((quote as any).change)}`}>
                    {(quote as any).change >= 0 ? "+" : ""}{formatCurrency((quote as any).change)} ({formatPercent((quote as any).changePercent)})
                  </p>
                </div>
                {(quote as any).marketCap && (
                  <div>
                    <p className="text-sm text-gray-500">Market Cap</p>
                    <p className="text-lg font-semibold text-gray-900">{formatMarketCap((quote as any).marketCap)}</p>
                  </div>
                )}
                {(quote as any).peRatio && (
                  <div>
                    <p className="text-sm text-gray-500">P/E Ratio</p>
                    <p className="text-lg font-semibold text-gray-900">{formatNumber((quote as any).peRatio)}</p>
                  </div>
                )}
                {(quote as any).earningsDate && (
                  <div>
                    <p className="text-sm text-gray-500">Next Earnings</p>
                    <p className="text-lg font-semibold text-gray-900">{(quote as any).earningsDate}</p>
                  </div>
                )}
              </div>
            </DialogHeader>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <PriceChart symbol={symbol} />
              </div>
              <div>
                <AIPrediction symbol={symbol} />
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Metrics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {quote.high52Week && (
                  <div>
                    <p className="text-sm text-gray-500">52 Week High</p>
                    <p className="font-semibold text-gray-900">{formatCurrency(quote.high52Week)}</p>
                  </div>
                )}
                {quote.low52Week && (
                  <div>
                    <p className="text-sm text-gray-500">52 Week Low</p>
                    <p className="font-semibold text-gray-900">{formatCurrency(quote.low52Week)}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-500">Volume</p>
                  <p className="font-semibold text-gray-900">{formatNumber(quote.volume)}</p>
                </div>
                {quote.avgVolume && (
                  <div>
                    <p className="text-sm text-gray-500">Avg Volume</p>
                    <p className="font-semibold text-gray-900">{formatNumber(quote.avgVolume)}</p>
                  </div>
                )}
                {quote.dividendYield && (
                  <div>
                    <p className="text-sm text-gray-500">Dividend Yield</p>
                    <p className="font-semibold text-gray-900">{formatPercent(quote.dividendYield)}</p>
                  </div>
                )}
                {quote.eps && (
                  <div>
                    <p className="text-sm text-gray-500">EPS</p>
                    <p className="font-semibold text-gray-900">{formatCurrency(quote.eps)}</p>
                  </div>
                )}
                {quote.beta && (
                  <div>
                    <p className="text-sm text-gray-500">Beta</p>
                    <p className="font-semibold text-gray-900">{formatNumber(quote.beta)}</p>
                  </div>
                )}
                {quote.roe && (
                  <div>
                    <p className="text-sm text-gray-500">ROE</p>
                    <p className="font-semibold text-gray-900">{formatPercent(quote.roe)}</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
