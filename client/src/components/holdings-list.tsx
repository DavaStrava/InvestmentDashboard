import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portfolioApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatPercent, getChangeColor } from "@/lib/utils";
import { ArrowUpDown, Trash2 } from "lucide-react";
import { useState } from "react";

interface HoldingsListProps {
  onSelectStock: (symbol: string) => void;
}

export default function HoldingsList({ onSelectStock }: HoldingsListProps) {
  const [sortBy, setSortBy] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: holdings, isLoading } = useQuery({
    queryKey: ["/api/holdings"],
    refetchInterval: 30000,
  });

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

  const getStockInitials = (symbol: string) => {
    return symbol.slice(0, 4).toUpperCase();
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

  const filteredHoldings = holdings?.filter(holding => {
    if (sortBy === "gainers") return holding.dailyChange > 0;
    if (sortBy === "losers") return holding.dailyChange < 0;
    return true;
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-24" />
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
        <div className="flex items-center justify-between">
          <CardTitle>My Holdings</CardTitle>
          <div className="flex items-center space-x-2">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Holdings</SelectItem>
                <SelectItem value="gainers">Gainers</SelectItem>
                <SelectItem value="losers">Losers</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon">
              <ArrowUpDown className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {!filteredHoldings || filteredHoldings.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <i className="fas fa-briefcase text-4xl"></i>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Holdings Yet</h3>
            <p className="text-gray-500 mb-4">
              Start building your portfolio by adding your first stock position.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredHoldings.map((holding) => (
              <div
                key={holding.id}
                className="p-4 hover:bg-gray-50 transition-colors cursor-pointer group"
                onClick={() => onSelectStock(holding.symbol)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getStockColor(holding.symbol)}`}>
                      <span className="font-bold text-sm">{getStockInitials(holding.symbol)}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{holding.companyName}</h3>
                      <p className="text-sm text-gray-500">{parseFloat(holding.shares)} shares</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{formatCurrency(holding.currentPrice)}</p>
                    <p className={`text-sm ${getChangeColor(holding.dailyChange)}`}>
                      {holding.dailyChange >= 0 ? "+" : ""}{formatCurrency(holding.dailyChange)} ({formatPercent(holding.dailyChangePercent)})
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{formatCurrency(holding.totalValue)}</p>
                    <p className={`text-sm ${getChangeColor(holding.totalGainLoss)}`}>
                      {holding.totalGainLoss >= 0 ? "+" : ""}{formatCurrency(holding.totalGainLoss)} ({formatPercent(holding.totalGainLossPercent)})
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => handleDeleteHolding(holding.id, e)}
                    disabled={deleteHoldingMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}

            {filteredHoldings.length > 3 && (
              <div className="p-4 text-center">
                <Button variant="ghost" className="text-primary hover:text-blue-700">
                  View all holdings <i className="fas fa-arrow-right ml-1"></i>
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
