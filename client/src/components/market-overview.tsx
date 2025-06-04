import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber, formatPercent, getChangeColor } from "@/lib/utils";

export default function MarketOverview() {
  const { data: indices, isLoading } = useQuery({
    queryKey: ["/api/market/indices"],
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Market Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-3 w-12" />
                </div>
                <div className="space-y-1 text-right">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Market Overview</CardTitle>
      </CardHeader>

      <CardContent>
        {!indices || !Array.isArray(indices) || indices.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500">Market data unavailable</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Market Status Indicator */}
            {Array.isArray(indices) && indices.length > 0 && (
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    indices[0]?.marketOpen ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                  <span className="text-sm font-medium text-gray-700">
                    {indices[0]?.marketOpen ? 'Markets Open' : 'Markets Closed'}
                  </span>
                </div>
                {!indices[0]?.marketOpen && (
                  <span className="text-xs text-gray-500">Showing Futures</span>
                )}
              </div>
            )}
            
            {Array.isArray(indices) && indices.map((index: any) => (
              <div key={index.symbol} className="flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <p className="font-medium text-gray-900">{index.name}</p>
                    {index.isFutures && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                        Futures
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{index.symbol}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">{formatNumber(index.price)}</p>
                  <p className={`text-sm ${getChangeColor(index.change)}`}>
                    {index.change >= 0 ? "+" : ""}{formatNumber(index.change)} ({formatPercent(index.changePercent)})
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
