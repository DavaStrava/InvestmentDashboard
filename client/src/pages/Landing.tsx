import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Shield, BarChart3, DollarSign } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
            Investment Dashboard
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
            Professional portfolio management with AI-powered market insights, 
            real-time data, and comprehensive analytics for informed investment decisions.
          </p>
          <Button 
            size="lg" 
            className="text-lg px-8 py-4"
            onClick={() => window.location.href = '/api/login'}
          >
            <Shield className="mr-2 h-5 w-5" />
            Secure Login
          </Button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card className="border-0 shadow-lg">
            <CardHeader className="text-center">
              <TrendingUp className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <CardTitle>Real-time Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Live market data with after-hours pricing and comprehensive portfolio monitoring
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader className="text-center">
              <BarChart3 className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <CardTitle>AI Predictions</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Advanced machine learning models for stock price predictions and trend analysis
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader className="text-center">
              <DollarSign className="h-12 w-12 text-yellow-600 mx-auto mb-4" />
              <CardTitle>Performance Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Detailed gain/loss tracking, daily changes, and comprehensive performance metrics
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader className="text-center">
              <Shield className="h-12 w-12 text-purple-600 mx-auto mb-4" />
              <CardTitle>Secure & Private</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Bank-level security with encrypted data storage and authenticated access
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Trusted by investors for secure portfolio management
          </p>
          <div className="flex justify-center space-x-8 text-sm text-gray-400">
            <span>Real-time Market Data</span>
            <span>•</span>
            <span>Advanced Analytics</span>
            <span>•</span>
            <span>Secure Authentication</span>
          </div>
        </div>
      </div>
    </div>
  );
}