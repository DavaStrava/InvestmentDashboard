import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { watchlistApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatPercent, getChangeColor } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";

interface WatchlistProps {
  onSelectStock: (symbol: string) => void;
  expanded?: boolean;
  onAddToWatchlist?: () => void;
}

export default function Watchlist({ onSelectStock, expanded = false, onAddToWatchlist }: WatchlistProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: watchlist, isLoading } = useQuery({
    queryKey: ["/api/watchlist"],
    refetchInterval: 30000,
  });

  const removeFromWatchlistMutation = useMutation({
    mutationFn: watchlistApi.removeFromWatchlist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      toast({ title: "Removed from watchlist" });
    },
    onError: () => {
      toast({ title: "Failed to remove from watchlist", variant: "destructive" });
    },
  });

  const handleRemoveFromWatchlist = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    removeFromWatchlistMutation.mutate(id);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Watchlist</CardTitle>
            <Skeleton className="h-8 w-16" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-2">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <div className="space-y-1">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-3 w-12" />
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
          <CardTitle>Watchlist</CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-primary hover:text-blue-700"
            onClick={onAddToWatchlist}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {!watchlist || watchlist.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-4">
              <i className="fas fa-star text-3xl"></i>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">No Watchlist Items</h3>
            <p className="text-sm text-gray-500 mb-4">
              Add stocks to track their performance without owning them.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {watchlist.slice(0, expanded ? undefined : 6).map((item: any) => (
              <div
                key={item.id}
                className="p-4 hover:bg-gray-50 transition-colors cursor-pointer group"
                onClick={() => onSelectStock(item.symbol)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{item.symbol}</p>
                    <p className="text-xs text-gray-500">{item.companyName}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{formatCurrency(item.currentPrice)}</p>
                      <p className={`text-xs ${getChangeColor(item.dailyChange)}`}>
                        {formatPercent(item.dailyChangePercent)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6"
                      onClick={(e) => handleRemoveFromWatchlist(item.id, e)}
                      disabled={removeFromWatchlistMutation.isPending}
                    >
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
