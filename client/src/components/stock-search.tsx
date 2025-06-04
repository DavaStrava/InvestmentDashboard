import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { stockApi } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search } from "lucide-react";

interface StockSearchProps {
  onSelectStock: (symbol: string) => void;
}

export default function StockSearch({ onSelectStock }: StockSearchProps) {
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const { data: searchResults, isLoading } = useQuery({
    queryKey: [`/api/stocks/search?q=${encodeURIComponent(debouncedQuery)}`],
    enabled: debouncedQuery.length >= 2,
    staleTime: 60000, // Cache for 1 minute
  });

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    setShowResults(value.length >= 2);
  };

  const handleSelectStock = (symbol: string) => {
    setQuery("");
    setShowResults(false);
    onSelectStock(symbol);
  };

  return (
    <div ref={searchRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          type="text"
          placeholder="Search stocks (e.g. AAPL, TSLA)"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          className="pl-10 w-80"
          onFocus={() => query.length >= 2 && setShowResults(true)}
        />
      </div>

      {showResults && (
        <Card className="absolute top-full left-0 right-0 mt-1 z-50 max-h-80 overflow-y-auto">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : !searchResults || !Array.isArray(searchResults) || searchResults.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                {debouncedQuery.length >= 2 ? "No results found" : "Type to search..."}
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {Array.isArray(searchResults) && searchResults.slice(0, 8).map((result: any) => (
                  <div
                    key={result["1. symbol"]}
                    className="p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleSelectStock(result["1. symbol"])}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{result["1. symbol"]}</p>
                        <p className="text-sm text-gray-500 truncate max-w-64">
                          {result["2. name"]}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">{result["3. type"]}</p>
                        <p className="text-xs text-gray-400">{result["4. region"]}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
