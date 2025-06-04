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
        {!indices || indices.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500">Market data unavailable</p>
          </div>
        ) : (
          <div className="space-y-4">
            {indices.map((index: any) => (
              <div key={index.symbol} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{index.name}</p>
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
