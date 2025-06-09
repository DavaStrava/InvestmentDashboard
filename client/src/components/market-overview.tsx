import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber, formatPercent, getChangeColor } from "@/lib/utils";
import { useState } from "react";
import StockDetailModal from "./stock-detail-modal";

export default function MarketOverview() {
  const [selectedIndex, setSelectedIndex] = useState<string | null>(null);
  
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
            {/* Global Market Status Overview */}
            {Array.isArray(indices) && indices.length > 0 && (
              <div className="pb-3 border-b border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-800">Global Markets</h4>
                  <div className="flex items-center space-x-4">
                    {/* US Market Status */}
                    {(() => {
                      const usMarket = indices.find((index: any) => index.exchange === "US");
                      return usMarket ? (
                        <div className="flex items-center space-x-1">
                          <div className={`w-2 h-2 rounded-full ${usMarket.marketOpen ? 'bg-green-500' : 'bg-red-500'}`}></div>
                          <span className="text-xs text-gray-600">US {usMarket.marketOpen ? 'Open' : 'Closed'}</span>
                        </div>
                      ) : null;
                    })()}
                    {/* International Status */}
                    {(() => {
                      const intlOpen = indices.filter((index: any) => index.exchange !== "US" && index.marketOpen).length;
                      const intlTotal = indices.filter((index: any) => index.exchange !== "US").length;
                      return intlTotal > 0 ? (
                        <span className="text-xs text-gray-500">
                          Intl: {intlOpen}/{intlTotal} Open
                        </span>
                      ) : null;
                    })()}
                  </div>
                </div>
              </div>
            )}
            
            {Array.isArray(indices) && (() => {
              // Group indices by region
              const usIndices = indices.filter((index: any) => index.region === "US");
              const intlIndices = indices.filter((index: any) => index.region !== "US");
              
              return (
                <>
                  {/* US Indices */}
                  {usIndices.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-gray-600 border-b border-gray-100 pb-1">
                        United States
                      </h4>
                      {usIndices.map((index: any) => (
                        <div 
                          key={index.symbol} 
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => setSelectedIndex(index.symbol)}
                        >
                          <div>
                            <div className="flex items-center space-x-2">
                              <p className="font-medium text-gray-900">{index.name}</p>
                              <div className="flex items-center space-x-1">
                                <div className={`w-1.5 h-1.5 rounded-full ${index.marketOpen ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                  index.marketOpen 
                                    ? 'bg-green-50 text-green-700' 
                                    : index.isFutures 
                                      ? 'bg-orange-50 text-orange-700' 
                                      : 'bg-gray-50 text-gray-600'
                                }`}>
                                  {index.marketOpen ? 'Live' : index.isFutures ? 'Futures' : 'Closed'}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <p className="text-sm text-gray-500">{index.symbol}</p>
                              {index.marketStatus && (
                                <span className="text-xs text-gray-400">{index.marketStatus}</span>
                              )}
                            </div>
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
                  
                  {/* International Indices */}
                  {intlIndices.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-gray-600 border-b border-gray-100 pb-1">
                        International
                      </h4>
                      {intlIndices.map((index: any) => (
                        <div 
                          key={index.symbol} 
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => setSelectedIndex(index.symbol)}
                        >
                          <div>
                            <div className="flex items-center space-x-2">
                              <p className="font-medium text-gray-900">{index.name}</p>
                              <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                {index.region}
                              </span>
                              <div className="flex items-center space-x-1">
                                <div className={`w-1.5 h-1.5 rounded-full ${index.marketOpen ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                  index.marketOpen 
                                    ? 'bg-green-50 text-green-700' 
                                    : index.isFutures 
                                      ? 'bg-orange-50 text-orange-700' 
                                      : 'bg-gray-50 text-gray-600'
                                }`}>
                                  {index.marketOpen ? 'Live' : index.isFutures ? 'Futures' : 'Closed'}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <p className="text-sm text-gray-500">{index.symbol}</p>
                              {index.marketStatus && (
                                <span className="text-xs text-gray-400">{index.marketStatus}</span>
                              )}
                            </div>
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
                </>
              );
            })()}
          </div>
        )}
      </CardContent>
      
      {/* Index Detail Modal */}
      {selectedIndex && (
        <StockDetailModal
          symbol={selectedIndex}
          onClose={() => setSelectedIndex(null)}
          isIndex={true}
        />
      )}
    </Card>
  );
}
