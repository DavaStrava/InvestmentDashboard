import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portfolioApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatPercent, getChangeColor } from "@/lib/utils";
import { ArrowUpDown, Trash2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useState } from "react";

interface HoldingsListProps {
  onSelectStock: (symbol: string) => void;
}

export default function HoldingsList({ onSelectStock }: HoldingsListProps) {
  const [sortBy, setSortBy] = useState<string>("all");
  const [sortField, setSortField] = useState<string>("symbol");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: holdings, isLoading } = useQuery({
    queryKey: ["/api/holdings/optimized"],
    refetchInterval: 300000, // 5 minutes - much longer due to intelligent caching
  });

  // Type guard to ensure holdings is an array
  const holdingsArray: any[] = Array.isArray(holdings) ? holdings : [];

  const deleteHoldingMutation = useMutation({
    mutationFn: portfolioApi.removeHolding,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/holdings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/summary"] });
      toast({ title: "Holding removed successfully" });
    },
    onError: () => {
      toast({ title: "Failed to remove holding", variant: "destructive" });
    },
  });

  const handleDeleteHolding = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteHoldingMutation.mutate(id);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (change < 0) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const getStockInitials = (symbol: string) => {
    return symbol.slice(0, 2).toUpperCase();
  };

  const getStockColor = (symbol: string) => {
    const colors = [
      "bg-blue-100 text-blue-600",
      "bg-green-100 text-green-600",
      "bg-purple-100 text-purple-600",
      "bg-orange-100 text-orange-600",
      "bg-pink-100 text-pink-600",
      "bg-indigo-100 text-indigo-600",
    ];
    const index = symbol.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const filteredAndSortedHoldings = holdingsArray.filter((holding: any) => {
    if (sortBy === "gainers") return holding.dailyChange > 0;
    if (sortBy === "losers") return holding.dailyChange < 0;
    return true;
  }).sort((a: any, b: any) => {
    const getValue = (holding: any, field: string) => {
      switch (field) {
        case "symbol": return holding.symbol;
        case "company": return holding.companyName;
        case "shares": return parseFloat(holding.shares);
        case "price": return holding.currentPrice || 0;
        case "value": return holding.totalValue || 0;
        case "dailyChange": return holding.dailyChange || 0;
        case "totalGain": return holding.totalGainLoss || 0;
        case "dailyPercent": return holding.dailyChangePercent || 0;
        case "totalPercent": return holding.totalGainLossPercent || 0;
        default: return 0;
      }
    };

    const aVal = getValue(a, sortField);
    const bVal = getValue(b, sortField);
    
    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    
    return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
  });

  const SortableHeader = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <th 
      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center space-x-1">
        <span>{children}</span>
        {sortField === field && (
          <ArrowUpDown className={`w-3 h-3 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
        )}
      </div>
    </th>
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="grid grid-cols-8 gap-4 p-4 border rounded-lg">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-4" />
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
        <div className="flex items-center justify-between">
          <CardTitle>My Holdings ({holdingsArray.length})</CardTitle>
          <div className="flex items-center space-x-2">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Holdings</SelectItem>
                <SelectItem value="gainers">Gainers</SelectItem>
                <SelectItem value="losers">Losers</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {!filteredAndSortedHoldings || filteredAndSortedHoldings.length === 0 ? (
          <div className="text-center py-12 px-6">
            <div className="text-gray-400 mb-4">
              <i className="fas fa-briefcase text-4xl"></i>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Holdings Yet</h3>
            <p className="text-gray-500 mb-4">
              Start building your portfolio by adding your first stock position.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <SortableHeader field="symbol">Stock</SortableHeader>
                  <SortableHeader field="shares">Shares</SortableHeader>
                  <SortableHeader field="price">Price</SortableHeader>
                  <SortableHeader field="dailyChange">Day Change</SortableHeader>
                  <SortableHeader field="value">Market Value</SortableHeader>
                  <SortableHeader field="totalGain">Total P&L</SortableHeader>
                  <SortableHeader field="totalPercent">Return</SortableHeader>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAndSortedHoldings.map((holding: any) => (
                  <tr
                    key={holding.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors group"
                    onClick={() => onSelectStock(holding.symbol)}
                  >
                    {/* Stock Info */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mr-3 ${getStockColor(holding.symbol)}`}>
                          {getStockInitials(holding.symbol)}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{holding.symbol}</div>
                          <div className="text-xs text-gray-500 truncate max-w-32">{holding.companyName}</div>
                        </div>
                      </div>
                    </td>

                    {/* Shares */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {parseFloat(holding.shares).toLocaleString()}
                    </td>

                    {/* Current Price */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {formatCurrency(holding.currentPrice || 0)}
                      </div>
                      <div className="text-xs text-gray-500">
                        Cost: {formatCurrency(parseFloat(holding.avgCostPerShare))}
                      </div>
                    </td>

                    {/* Daily Change */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getTrendIcon(holding.dailyChange || 0)}
                        <div className="ml-2">
                          <div className={`text-sm font-medium ${getChangeColor(holding.dailyChange || 0)}`}>
                            {holding.dailyChange >= 0 ? "+" : ""}{formatCurrency(holding.dailyChange || 0)}
                          </div>
                          <div className={`text-xs ${getChangeColor(holding.dailyChangePercent || 0)}`}>
                            {holding.dailyChangePercent >= 0 ? "+" : ""}{formatPercent(holding.dailyChangePercent || 0)}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Market Value */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {formatCurrency(holding.totalValue || 0)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {((holding.totalValue || 0) / (holdingsArray.reduce((sum: number, h: any) => sum + (h.totalValue || 0), 0) || 1) * 100).toFixed(1)}% of portfolio
                      </div>
                    </td>

                    {/* Total P&L */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium ${getChangeColor(holding.totalGainLoss || 0)}`}>
                        {holding.totalGainLoss >= 0 ? "+" : ""}{formatCurrency(holding.totalGainLoss || 0)}
                      </div>
                      <div className="text-xs text-gray-500">
                        Since purchase
                      </div>
                    </td>

                    {/* Return % */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        (holding.totalGainLossPercent || 0) >= 0 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {holding.totalGainLossPercent >= 0 ? "+" : ""}{formatPercent(holding.totalGainLossPercent || 0)}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => handleDeleteHolding(holding.id, e)}
                        disabled={deleteHoldingMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
