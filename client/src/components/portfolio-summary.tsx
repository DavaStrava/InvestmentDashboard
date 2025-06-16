import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatPercent, getChangeColor } from "@/lib/utils";
import { TrendingUp, ArrowUp, ChartLine, Briefcase } from "lucide-react";

export default function PortfolioSummary() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ["/api/portfolio/summary/optimized"],
    refetchInterval: 300000, // 5 minutes - optimized caching reduces API load
  });

  if (isLoading) {
    return (
      <div className="mb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-32" />
                  </div>
                  <Skeleton className="h-12 w-12 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="mb-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Portfolio Value</p>
                <p className="text-3xl font-bold text-gray-900">
                  {formatCurrency(summary.totalValue)}
                </p>
              </div>
              <div className="bg-green-100 p-3 rounded-full">
                <TrendingUp className="text-green-600 w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Today's Change</p>
                <p className={`text-2xl font-bold ${getChangeColor(summary.dailyChange)}`}>
                  {summary.dailyChange >= 0 ? "+" : ""}{formatCurrency(summary.dailyChange)}
                </p>
                <p className={`text-sm ${getChangeColor(summary.dailyChange)}`}>
                  {summary.dailyChangePercent >= 0 ? "+" : ""}{formatPercent(summary.dailyChangePercent)}
                </p>
              </div>
              <div className={`p-3 rounded-full ${summary.dailyChange >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                <ArrowUp className={`w-6 h-6 ${summary.dailyChange >= 0 ? 'text-green-600' : 'text-red-600 rotate-180'}`} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Gain/Loss</p>
                <p className={`text-2xl font-bold ${getChangeColor(summary.totalGainLoss)}`}>
                  {summary.totalGainLoss >= 0 ? "+" : ""}{formatCurrency(summary.totalGainLoss)}
                </p>
                <p className={`text-sm ${getChangeColor(summary.totalGainLoss)}`}>
                  {summary.totalGainLossPercent >= 0 ? "+" : ""}{formatPercent(summary.totalGainLossPercent)}
                </p>
              </div>
              <div className={`p-3 rounded-full ${summary.totalGainLoss >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                <ChartLine className={`w-6 h-6 ${summary.totalGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Holdings</p>
                <p className="text-2xl font-bold text-gray-900">{summary.holdingsCount}</p>
                <p className="text-sm text-gray-500">Active positions</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <Briefcase className="text-primary w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
