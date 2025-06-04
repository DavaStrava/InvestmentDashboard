import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { portfolioApi } from "@/lib/api";
import PortfolioSummary from "@/components/portfolio-summary";
import HoldingsList from "@/components/holdings-list";
import Watchlist from "@/components/watchlist";
import MarketOverview from "@/components/market-overview";
import StockSearch from "@/components/stock-search";
import StockDetailModal from "@/components/stock-detail-modal";
import AddStockModal from "@/components/add-stock-modal";
import { Button } from "@/components/ui/button";
import { ChartLine, Plus, Bell } from "lucide-react";

type TabType = "portfolio" | "watchlist" | "analytics";

export default function Portfolio() {
  const [activeTab, setActiveTab] = useState<TabType>("portfolio");
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [showAddStock, setShowAddStock] = useState(false);

  const { data: portfolioSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ["/api/portfolio/summary"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-2">
                <ChartLine className="text-primary text-2xl" />
                <h1 className="text-xl font-bold text-gray-900">PortfolioTracker</h1>
              </div>
              <nav className="hidden md:flex space-x-6">
                <button
                  onClick={() => setActiveTab("portfolio")}
                  className={`font-medium pb-1 ${
                    activeTab === "portfolio"
                      ? "text-primary border-b-2 border-primary"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Portfolio
                </button>
                <button
                  onClick={() => setActiveTab("watchlist")}
                  className={`font-medium pb-1 ${
                    activeTab === "watchlist"
                      ? "text-primary border-b-2 border-primary"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Watchlist
                </button>
                <button
                  onClick={() => setActiveTab("analytics")}
                  className={`font-medium pb-1 ${
                    activeTab === "analytics"
                      ? "text-primary border-b-2 border-primary"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Analytics
                </button>
              </nav>
            </div>

            <div className="flex items-center space-x-4">
              <div className="hidden sm:block">
                <StockSearch onSelectStock={setSelectedStock} />
              </div>

              <Button
                onClick={() => setShowAddStock(true)}
                className="bg-primary text-white hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Stock
              </Button>

              <Button variant="ghost" size="icon" className="text-gray-600 hover:text-gray-900">
                <Bell className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === "portfolio" && (
          <>
            <PortfolioSummary />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <HoldingsList onSelectStock={setSelectedStock} />
              </div>
              <div className="space-y-6">
                <Watchlist onSelectStock={setSelectedStock} onAddToWatchlist={() => setShowAddStock(true)} />
                <MarketOverview />
                
                {/* Quick Actions */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                    <div className="space-y-3">
                      <Button
                        onClick={() => setShowAddStock(true)}
                        className="w-full bg-primary text-white hover:bg-blue-700"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add New Position
                      </Button>
                      <Button variant="outline" className="w-full">
                        <i className="fas fa-download mr-2"></i>
                        Export Portfolio
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setActiveTab("analytics")}
                      >
                        <i className="fas fa-chart-bar mr-2"></i>
                        View Analytics
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === "watchlist" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Watchlist onSelectStock={setSelectedStock} expanded onAddToWatchlist={() => setShowAddStock(true)} />
            </div>
            <div className="space-y-6">
              <MarketOverview />
            </div>
          </div>
        )}

        {activeTab === "analytics" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
            <div className="text-center">
              <i className="fas fa-chart-line text-4xl text-gray-400 mb-4"></i>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Analytics Coming Soon</h3>
              <p className="text-gray-500">
                Advanced portfolio analytics and performance tracking features will be available in a future update.
              </p>
            </div>
          </div>
        )}
      </div>

      {selectedStock && (
        <StockDetailModal
          symbol={selectedStock}
          onClose={() => setSelectedStock(null)}
        />
      )}

      {showAddStock && (
        <AddStockModal onClose={() => setShowAddStock(false)} />
      )}
    </div>
  );
}
