import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface PriceChartProps {
  symbol: string;
}

type TimeRange = "1D" | "1W" | "1M" | "3M" | "1Y";

export default function PriceChart({ symbol }: PriceChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("1D");

  // Mock data for demonstration - in production, this would fetch real historical data
  const generateMockData = (range: TimeRange) => {
    const basePrice = 178.45;
    const dataPoints = range === "1D" ? 13 : range === "1W" ? 7 : range === "1M" ? 30 : range === "3M" ? 90 : 252;
    
    const data = [];
    for (let i = 0; i < dataPoints; i++) {
      const variation = (Math.random() - 0.5) * 10;
      const price = basePrice + variation + (Math.sin(i / 10) * 5);
      
      let label = "";
      if (range === "1D") {
        const hour = 9 + Math.floor(i / 2);
        const minute = (i % 2) * 30;
        label = `${hour}:${minute.toString().padStart(2, "0")}`;
      } else {
        const date = new Date();
        date.setDate(date.getDate() - (dataPoints - i));
        label = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      }
      
      data.push({
        time: label,
        price: price,
      });
    }
    return data;
  };

  const chartData = generateMockData(timeRange);

  const formatTooltip = (value: any, name: string) => {
    if (name === "price") {
      return [`$${value.toFixed(2)}`, "Price"];
    }
    return [value, name];
  };

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

      <div className="h-80 bg-gray-50 rounded-lg p-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
            <XAxis 
              dataKey="time" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "#6B7280" }}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "#6B7280" }}
              domain={["dataMin - 2", "dataMax + 2"]}
              tickFormatter={(value) => `$${value.toFixed(0)}`}
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
    </div>
  );
}
