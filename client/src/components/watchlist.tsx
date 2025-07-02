import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { watchlistApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatPercent, getChangeColor } from "@/lib/utils";
import { Plus, Trash2, ExternalLink, CheckSquare, Square } from "lucide-react";
import { Link } from "wouter";

interface WatchlistProps {
  onSelectStock: (symbol: string) => void;
  expanded?: boolean;
  onAddToWatchlist?: () => void;
}

export default function Watchlist({ onSelectStock, expanded = false, onAddToWatchlist }: WatchlistProps) {
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{id: number, symbol: string} | null>(null);
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
      setSelectedItems(new Set());
      setShowDeleteConfirm(false);
      setItemToDelete(null);
      toast({ title: "Removed from watchlist" });
    },
    onError: () => {
      toast({ title: "Failed to remove from watchlist", variant: "destructive" });
    },
  });

  const removeBulkFromWatchlistMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await Promise.all(ids.map(id => watchlistApi.removeFromWatchlist(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      setSelectedItems(new Set());
      toast({ title: `${selectedItems.size} items removed from watchlist` });
    },
    onError: () => {
      toast({ title: "Failed to remove selected items", variant: "destructive" });
    },
  });

  const handleRemoveFromWatchlist = (id: number, symbol: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setItemToDelete({ id, symbol });
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (itemToDelete) {
      removeFromWatchlistMutation.mutate(itemToDelete.id);
    }
  };

  const handleBulkDelete = () => {
    if (selectedItems.size > 0) {
      removeBulkFromWatchlistMutation.mutate(Array.from(selectedItems));
    }
  };

  const toggleSelectItem = (id: number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const toggleSelectAll = () => {
    if (!watchlist || !Array.isArray(watchlist)) return;
    
    if (selectedItems.size === watchlist.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(watchlist.map((item: any) => item.id)));
    }
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
          <div className="flex items-center space-x-4">
            <CardTitle>Watchlist</CardTitle>
            {selectedItems.size > 0 && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">
                  {selectedItems.size} selected
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={removeBulkFromWatchlistMutation.isPending}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Remove Selected
                </Button>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {Array.isArray(watchlist) && watchlist.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSelectAll}
                className="text-gray-600 hover:text-gray-900"
                title="Select all items"
              >
                {selectedItems.size === watchlist.length ? (
                  <CheckSquare className="w-4 h-4" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
              </Button>
            )}
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
        </div>
      </CardHeader>

      <CardContent>
        {!watchlist || !Array.isArray(watchlist) || watchlist.length === 0 ? (
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
            {Array.isArray(watchlist) && watchlist.slice(0, expanded ? undefined : 6).map((item: any) => (
              <div key={item.id} className="group">
                <div className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1">
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedItems.has(item.id)}
                          onCheckedChange={() => toggleSelectItem(item.id)}
                          aria-label={`Select ${item.symbol}`}
                        />
                      </div>
                      <div className="flex-1 cursor-pointer" onClick={() => onSelectStock(item.symbol)}>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{item.symbol}</p>
                          <ExternalLink className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{item.companyName}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="text-right">
                        <p className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(item.currentPrice)}</p>
                        <p className={`text-xs ${getChangeColor(item.dailyChange)}`}>
                          {formatPercent(item.dailyChangePercent)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6"
                        onClick={(e) => handleRemoveFromWatchlist(item.id, item.symbol, e)}
                        disabled={removeFromWatchlistMutation.isPending}
                      >
                        <Trash2 className="w-3 h-3 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Removal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{itemToDelete?.symbol}</strong> from your watchlist? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={removeFromWatchlistMutation.isPending}
            >
              {removeFromWatchlistMutation.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
