/**
 * FRONTEND APPLICATION ROOT
 * ========================
 * 
 * Main React application entry point implementing client-side routing,
 * state management, and authentication-based navigation flow.
 * 
 * Architecture Features:
 * - Client-side routing with Wouter (lightweight React Router alternative)
 * - TanStack Query for server state management and caching
 * - Authentication-based route protection and conditional rendering
 * - Global UI providers for consistent theming and notifications
 * 
 * Route Structure:
 * - Landing page: Unauthenticated users see marketing/login interface
 * - Portfolio: Main dashboard with holdings, watchlist, and market data
 * - Predictions: AI-powered stock analysis and prediction tracking
 * - Stock Detail: Individual stock analysis with charts and metrics
 * 
 * State Management:
 * - Authentication state via useAuth hook (React Query based)
 * - Server state cached and synchronized via TanStack Query
 * - UI state managed locally in components with React hooks
 */
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Portfolio from "@/pages/portfolio";
import PredictionDashboard from "@/pages/prediction-dashboard";
import StockDetailPage from "@/pages/stock-detail";
import Landing from "@/pages/Landing";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Portfolio} />
          <Route path="/portfolio" component={Portfolio} />
          <Route path="/prediction-dashboard" component={PredictionDashboard} />
          <Route path="/stock/:symbol" component={StockDetailPage} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
