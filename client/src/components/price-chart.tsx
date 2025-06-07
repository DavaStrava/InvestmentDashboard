import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, ReferenceLine } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

interface PriceChartProps {
  symbol: string;
}

type TimeRange = "1D" | "1W" | "1M" | "3M" | "1Y";

export default function PriceChart({ symbol }: PriceChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("1D");

  // Fetch real historical data from API
  const { data: chartData, isLoading, error } = useQuery({
    queryKey: ["/api/stocks", symbol, "history", timeRange],
    queryFn: async () => {
      const response = await fetch(`/api/stocks/${symbol}/history?range=${timeRange}`);
      if (!response.ok) {
        throw new Error("Failed to fetch historical data");
      }
      return response.json();
    },
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const formatTooltip = (value: any, name: string) => {
    if (name === "price") {
      return [`$${value.toFixed(2)}`, "Price"];
    }
    if (name === "volume") {
      return [value.toLocaleString(), "Volume"];
    }
    return [value, name];
  };

  const formatXAxisTick = (tickItem: string) => {
    // For intraday charts, show only hour:minute
    if (timeRange === "1D") {
      return tickItem; // Already formatted as "HH:mm" from server
    }
    // For longer timeframes, show date format
    return tickItem;
  };

  const formatVolumeNumber = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toString();
  };

  if (error) {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Price Chart</h3>
          <div className="flex space-x-2">
            {(["1D", "1W", "1M", "3M", "1Y"] as TimeRange[]).map((range) => (
              <Button
                key={range}
                variant={timeRange === range ? "default" : "outline"}
                size="sm"
                onClick={() => setTimeRange(range)}
                className={timeRange === range ? "bg-primary text-white" : ""}
              >
                {range}
              </Button>
            ))}
          </div>
        </div>

        <div className="h-80 bg-gray-50 rounded-lg p-4 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 mb-2">Historical data not available</p>
            <p className="text-sm text-gray-400">Chart data requires API access</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Price Chart</h3>
        <div className="flex space-x-2">
          {(["1D", "1W", "1M", "3M", "1Y"] as TimeRange[]).map((range) => (
            <Button
              key={range}
              variant={timeRange === range ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange(range)}
              className={timeRange === range ? "bg-primary text-white" : ""}
            >
              {range}
            </Button>
          ))}
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : chartData && chartData.length > 0 ? (
          <div className="space-y-4">
            {/* Price Chart */}
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                  <XAxis 
                    dataKey="time" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#6B7280" }}
                    interval={Math.max(1, Math.floor(chartData.length / 6))}
                    tickFormatter={formatXAxisTick}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#6B7280" }}
                    domain={[(dataMin: number) => {
                      const min = Math.min(...chartData.map((d: any) => d.price));
                      const max = Math.max(...chartData.map((d: any) => d.price));
                      const range = max - min;
                      return Math.max(0, min - range * 0.05);
                    }, (dataMax: number) => {
                      const min = Math.min(...chartData.map((d: any) => d.price));
                      const max = Math.max(...chartData.map((d: any) => d.price));
                      const range = max - min;
                      return max + range * 0.05;
                    }]}
                    tickFormatter={(value) => `$${value.toFixed(2)}`}
                    width={60}
                  />
                  <Tooltip 
                    formatter={formatTooltip}
                    labelStyle={{ color: "#374151" }}
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #E5E7EB",
                      borderRadius: "8px",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="hsl(207 90% 54%)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: "hsl(207 90% 54%)" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Volume Chart - only show if volume data is available */}
            {chartData.some((d: any) => d.volume) && (
              <div className="h-40">
                <div className="mb-2">
                  <h4 className="text-sm font-medium text-gray-700">Volume</h4>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                    <XAxis 
                      dataKey="time" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#6B7280" }}
                      interval="preserveStartEnd"
                      minTickGap={30}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#6B7280" }}
                      tickFormatter={formatVolumeNumber}
                      width={50}
                    />
                    <Tooltip 
                      formatter={formatTooltip}
                      labelStyle={{ color: "#374151" }}
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #E5E7EB",
                        borderRadius: "8px",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                      }}
                    />
                    <Bar
                      dataKey="volume"
                      fill="hsl(207 90% 54%)"
                      opacity={0.7}
                      radius={[1, 1, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-500">No chart data available for this time range</p>
          </div>
        )}
      </div>
    </div>
  );
}
