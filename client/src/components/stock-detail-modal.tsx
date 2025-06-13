import { useQuery } from "@tanstack/react-query";
import { stockApi } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatPercent, formatMarketCap, formatNumber, getChangeColor } from "@/lib/utils";
import PriceChart from "./price-chart";
import AIPrediction from "./ai-prediction";

interface StockDetailModalProps {
  symbol: string;
  onClose: () => void;
  isIndex?: boolean;
}

export default function StockDetailModal({ symbol, onClose, isIndex = false }: StockDetailModalProps) {
  const { data: quote, isLoading } = useQuery({
    queryKey: [`/api/stocks/${symbol}/quote`],
    enabled: !!symbol,
  });

  const stockQuote = quote as any;

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
      <DialogContent className="max-w-[95vw] w-full max-h-[95vh] overflow-y-auto p-0 m-2 sm:m-4">
        <div className="p-2 sm:p-4">
          {isLoading ? (
            <div className="space-y-6">
              <DialogHeader>
                <DialogTitle className="sr-only">Loading stock data</DialogTitle>
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
          ) : !stockQuote ? (
            <div className="text-center py-12">
              <DialogHeader>
                <DialogTitle>Error Loading Stock</DialogTitle>
              </DialogHeader>
              <p className="text-gray-500">Failed to load stock data</p>
              <Button onClick={onClose} className="mt-4">Close</Button>
            </div>
          ) : (
            <>
              <DialogHeader>
                <div className="flex items-center space-x-3">
                  <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center ${getStockColor(symbol)}`}>
                    <span className="font-bold text-sm sm:text-lg">{getStockInitials(symbol)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <DialogTitle className="text-lg sm:text-2xl font-bold truncate">{stockQuote.companyName}</DialogTitle>
                    <p className="text-gray-500 text-sm">NASDAQ: {stockQuote.symbol}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <div className="sm:col-span-2 lg:col-span-1">
                    <p className="text-xs sm:text-sm text-gray-500">Current Price</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">{formatCurrency(stockQuote.price)}</p>
                    <p className={`text-xs sm:text-sm ${getChangeColor(stockQuote.change)}`}>
                      {stockQuote.change >= 0 ? "+" : ""}{formatCurrency(stockQuote.change)} ({formatPercent(stockQuote.changePercent)})
                    </p>
                  </div>
                  {stockQuote.marketCap && (
                    <div>
                      <p className="text-sm text-gray-500">Market Cap</p>
                      <p className="text-lg font-semibold text-gray-900">{formatMarketCap(stockQuote.marketCap)}</p>
                    </div>
                  )}
                  {stockQuote.peRatio && (
                    <div>
                      <p className="text-sm text-gray-500">P/E Ratio</p>
                      <p className="text-lg font-semibold text-gray-900">{formatNumber(stockQuote.peRatio)}</p>
                    </div>
                  )}
                  {stockQuote.earningsDate && (
                    <div>
                      <p className="text-sm text-gray-500">Next Earnings</p>
                      <p className="text-lg font-semibold text-gray-900">{stockQuote.earningsDate}</p>
                    </div>
                  )}
                </div>
              </DialogHeader>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                <div className={`${isIndex ? 'lg:col-span-2' : 'lg:col-span-2 xl:col-span-1'} order-1`}>
                  <PriceChart symbol={symbol} />
                </div>
                {!isIndex && (
                  <div className="lg:col-span-2 xl:col-span-1 order-2">
                    <AIPrediction symbol={symbol} />
                  </div>
                )}
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Metrics</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {stockQuote.high52Week && (
                    <div>
                      <p className="text-sm text-gray-500">52 Week High</p>
                      <p className="font-semibold text-gray-900">{formatCurrency(stockQuote.high52Week)}</p>
                    </div>
                  )}
                  {stockQuote.low52Week && (
                    <div>
                      <p className="text-sm text-gray-500">52 Week Low</p>
                      <p className="font-semibold text-gray-900">{formatCurrency(stockQuote.low52Week)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-500">Volume</p>
                    <p className="font-semibold text-gray-900">{formatNumber(stockQuote.volume)}</p>
                  </div>
                  {stockQuote.avgVolume && (
                    <div>
                      <p className="text-sm text-gray-500">Avg Volume</p>
                      <p className="font-semibold text-gray-900">{formatNumber(stockQuote.avgVolume)}</p>
                    </div>
                  )}
                  {stockQuote.dividendYield && (
                    <div>
                      <p className="text-sm text-gray-500">Dividend Yield</p>
                      <p className="font-semibold text-gray-900">{formatPercent(stockQuote.dividendYield)}</p>
                    </div>
                  )}
                  {stockQuote.eps && (
                    <div>
                      <p className="text-sm text-gray-500">EPS</p>
                      <p className="font-semibold text-gray-900">{formatCurrency(stockQuote.eps)}</p>
                    </div>
                  )}
                  {stockQuote.beta && (
                    <div>
                      <p className="text-sm text-gray-500">Beta</p>
                      <p className="font-semibold text-gray-900">{formatNumber(stockQuote.beta)}</p>
                    </div>
                  )}
                  {stockQuote.roe && (
                    <div>
                      <p className="text-sm text-gray-500">ROE</p>
                      <p className="font-semibold text-gray-900">{formatPercent(stockQuote.roe)}</p>
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