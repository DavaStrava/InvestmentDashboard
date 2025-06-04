import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { portfolioApi, watchlistApi, stockApi } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatPercent, getChangeColor } from "@/lib/utils";
import { Search, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

interface AddStockModalProps {
  onClose: () => void;
}

const addStockSchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
  shares: z.string().min(1, "Shares is required"),
  avgCostPerShare: z.string().min(1, "Average cost is required"),
  type: z.enum(["holding", "watchlist"]),
});

type AddStockForm = z.infer<typeof addStockSchema>;

export default function AddStockModal({ onClose }: AddStockModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<AddStockForm>({
    resolver: zodResolver(addStockSchema),
    defaultValues: {
      type: "holding",
      symbol: "",
      shares: "",
      avgCostPerShare: "",
    },
  });

  const addHoldingMutation = useMutation({
    mutationFn: portfolioApi.addHolding,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/holdings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/summary"] });
      toast({ title: "Stock added to portfolio successfully" });
      onClose();
    },
    onError: () => {
      toast({ title: "Failed to add stock to portfolio", variant: "destructive" });
    },
  });

  const addWatchlistMutation = useMutation({
    mutationFn: watchlistApi.addToWatchlist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      toast({ title: "Stock added to watchlist successfully" });
      onClose();
    },
    onError: () => {
      toast({ title: "Failed to add stock to watchlist", variant: "destructive" });
    },
  });

  const handleSearch = async () => {
    if (searchQuery.length < 1) return;
    
    setIsSearching(true);
    try {
      const results = await stockApi.search(searchQuery);
      setSearchResults(results.slice(0, 5));
    } catch (error) {
      toast({ title: "Search failed", variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectStock = async (symbol: string, companyName: string) => {
    try {
      const quote = await stockApi.getQuote(symbol);
      setSelectedQuote(quote);
      form.setValue("symbol", symbol);
      form.setValue("avgCostPerShare", quote.price.toString());
      setSearchResults([]);
      setSearchQuery(`${symbol} - ${companyName}`);
    } catch (error) {
      toast({ title: "Failed to fetch stock quote", variant: "destructive" });
    }
  };

  const onSubmit = (data: AddStockForm) => {
    if (data.type === "holding") {
      addHoldingMutation.mutate({
        symbol: data.symbol,
        companyName: selectedQuote?.companyName || data.symbol,
        shares: data.shares,
        avgCostPerShare: data.avgCostPerShare,
      });
    } else {
      addWatchlistMutation.mutate({
        symbol: data.symbol,
        companyName: selectedQuote?.companyName || data.symbol,
      });
    }
  };

  const isLoading = addHoldingMutation.isPending || addWatchlistMutation.isPending;
  const watchType = form.watch("type");

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Stock</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <Label htmlFor="type">Add to</Label>
            <Select value={watchType} onValueChange={(value) => form.setValue("type", value as "holding" | "watchlist")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="holding">Portfolio (Holding)</SelectItem>
                <SelectItem value="watchlist">Watchlist</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="search">Search Stock</Label>
            <div className="flex space-x-2">
              <Input
                id="search"
                placeholder="Enter symbol or company name"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleSearch())}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleSearch}
                disabled={isSearching || searchQuery.length < 1}
              >
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {searchResults.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-200">
                  {searchResults.map((result) => (
                    <div
                      key={result["1. symbol"]}
                      className="p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleSelectStock(result["1. symbol"], result["2. name"])}
                    >
                      <div>
                        <p className="font-semibold text-gray-900">{result["1. symbol"]}</p>
                        <p className="text-sm text-gray-500 truncate">{result["2. name"]}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {selectedQuote && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{selectedQuote.companyName}</h3>
                    <p className="text-sm text-gray-500">{selectedQuote.symbol}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{formatCurrency(selectedQuote.price)}</p>
                    <p className={`text-sm ${getChangeColor(selectedQuote.change)}`}>
                      {selectedQuote.change >= 0 ? "+" : ""}{formatCurrency(selectedQuote.change)} ({formatPercent(selectedQuote.changePercent)})
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {watchType === "holding" && (
            <>
              <div>
                <Label htmlFor="shares">Number of Shares</Label>
                <Input
                  id="shares"
                  type="number"
                  step="0.0001"
                  placeholder="e.g., 10"
                  {...form.register("shares")}
                />
                {form.formState.errors.shares && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.shares.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="avgCostPerShare">Average Cost Per Share</Label>
                <Input
                  id="avgCostPerShare"
                  type="number"
                  step="0.01"
                  placeholder="e.g., 150.00"
                  {...form.register("avgCostPerShare")}
                />
                {form.formState.errors.avgCostPerShare && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.avgCostPerShare.message}</p>
                )}
              </div>
            </>
          )}

          <div className="flex space-x-3">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !form.watch("symbol")}
              className="flex-1"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Add {watchType === "holding" ? "to Portfolio" : "to Watchlist"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
