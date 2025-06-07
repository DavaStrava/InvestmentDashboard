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
    // Parse the time string and format properly
    if (timeRange === "1D") {
      // For intraday, show clean time format like "9:30 AM"
      const timeMatch = tickItem.match(/(\d{1,2}):(\d{2})/);
      if (timeMatch) {
        const hour = parseInt(timeMatch[1]);
        const minute = timeMatch[2];
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        return `${displayHour}:${minute} ${ampm}`;
      }
      return tickItem;
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Price Chart</h3>
          {chartData && chartData.length > 1 && (
            <div className="flex items-center space-x-3 mt-1">
              <span className="text-sm text-gray-600">
                Range: ${Math.min(...chartData.map((d: any) => d.price)).toFixed(2)} - ${Math.max(...chartData.map((d: any) => d.price)).toFixed(2)}
              </span>
              <span className={`text-sm font-medium ${
                chartData[chartData.length - 1].price >= chartData[0].price ? 'text-green-600' : 'text-red-600'
              }`}>
                {chartData[chartData.length - 1].price >= chartData[0].price ? '↗' : '↘'} 
                {((chartData[chartData.length - 1].price - chartData[0].price) / chartData[0].price * 100).toFixed(2)}%
              </span>
            </div>
          )}
        </div>
        <div className="flex space-x-1">
          {(["1D", "1W", "1M", "3M", "1Y"] as TimeRange[]).map((range) => (
            <Button
              key={range}
              variant={timeRange === range ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange(range)}
              className={`min-w-12 ${timeRange === range ? "bg-blue-600 text-white hover:bg-blue-700" : "hover:bg-gray-100"}`}
            >
              {range}
            </Button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : chartData && chartData.length > 0 ? (
          <div className="space-y-6">
            {/* Price Chart */}
            <div className="h-[500px] bg-gray-50 rounded-lg p-6">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 30, right: 40, left: 80, bottom: 80 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke="rgba(0,0,0,0.08)" horizontal={true} vertical={false} />
                  <XAxis 
                    dataKey="time" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "#374151" }}
                    interval={Math.max(0, Math.floor(chartData.length / 8))}
                    tickFormatter={formatXAxisTick}
                    height={60}
                    angle={-35}
                    textAnchor="end"
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "#374151" }}
                    domain={['dataMin - 1', 'dataMax + 1']}
                    tickFormatter={(value) => `$${value.toFixed(2)}`}
                    width={90}
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
                    stroke={chartData && chartData.length > 1 ? 
                      (chartData[chartData.length - 1].price >= chartData[0].price ? "#10B981" : "#EF4444") : 
                      "hsl(207 90% 54%)"
                    }
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5, fill: "white", stroke: "hsl(207 90% 54%)", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Volume Chart - only show if volume data is available */}
            {chartData.some((d: any) => d.volume) && (
              <div className="h-[300px] bg-gray-50 rounded-lg p-6">
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700">Trading Volume</h4>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 40, left: 80, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="2 2" stroke="rgba(0,0,0,0.08)" horizontal={true} vertical={false} />
                    <XAxis 
                      dataKey="time" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "#374151" }}
                      interval={Math.max(0, Math.floor(chartData.length / 8))}
                      tickFormatter={formatXAxisTick}
                      height={50}
                      angle={-35}
                      textAnchor="end"
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "#374151" }}
                      tickFormatter={formatVolumeNumber}
                      width={90}
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
                      fill="rgba(99, 102, 241, 0.5)"
                      stroke="rgba(99, 102, 241, 0.7)"
                      strokeWidth={0}
                      radius={[2, 2, 0, 0]}
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
