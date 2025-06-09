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
import CSVUploadModal from "@/components/csv-upload-modal";
import { Button } from "@/components/ui/button";
import { ChartLine, Plus, Bell, Upload } from "lucide-react";

type TabType = "portfolio" | "watchlist" | "analytics";

export default function Portfolio() {
  const [activeTab, setActiveTab] = useState<TabType>("portfolio");
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [showAddStock, setShowAddStock] = useState(false);
  const [showCSVUpload, setShowCSVUpload] = useState(false);

  const { data: portfolioSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ["/api/portfolio/summary"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center space-x-4 sm:space-x-8 min-w-0">
              <div className="flex items-center space-x-2 min-w-0">
                <ChartLine className="text-primary text-lg sm:text-2xl flex-shrink-0" />
                <h1 className="text-base sm:text-xl font-bold text-gray-900 truncate">PortfolioTracker</h1>
              </div>
              <nav className="hidden sm:flex space-x-4 lg:space-x-6">
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

            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="hidden lg:block">
                <StockSearch onSelectStock={setSelectedStock} />
              </div>

              {activeTab === "portfolio" && (
                <Button
                  onClick={() => setShowCSVUpload(true)}
                  size="sm"
                  variant="outline"
                  className="h-8 sm:h-9 mr-2"
                >
                  <Upload className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Import CSV</span>
                </Button>
              )}

              <Button
                onClick={() => setShowAddStock(true)}
                size="sm"
                className="bg-primary text-white hover:bg-blue-700 h-8 sm:h-9"
              >
                <Plus className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">Add Stock</span>
              </Button>

              <Button variant="ghost" size="icon" className="text-gray-600 hover:text-gray-900 h-8 w-8 sm:h-10 sm:w-10">
                <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            </div>
          </div>
        </div>
        
        {/* Mobile Navigation */}
        <div className="sm:hidden border-t border-gray-200 bg-white">
          <div className="flex">
            {[
              { key: "portfolio", label: "Portfolio" },
              { key: "watchlist", label: "Watchlist" },
              { key: "analytics", label: "Analytics" }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as TabType)}
                className={`flex-1 py-3 px-2 text-xs font-medium text-center ${
                  activeTab === tab.key
                    ? "text-primary border-t-2 border-primary bg-blue-50"
                    : "text-gray-600"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Mobile Search Bar */}
      <div className="lg:hidden bg-white border-b border-gray-200 px-3 py-2">
        <StockSearch onSelectStock={setSelectedStock} />
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 pb-20 sm:pb-6">
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

      {showCSVUpload && (
        <CSVUploadModal onClose={() => setShowCSVUpload(false)} />
      )}
    </div>
  );
}
