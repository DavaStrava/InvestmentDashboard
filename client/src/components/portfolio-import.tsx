import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, CheckCircle, AlertCircle, Download } from 'lucide-react';

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
  imported: any[];
}

export function PortfolioImport() {
  const [isDragging, setIsDragging] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('portfolio', file);
      
      setUploadProgress(0);
      
      const response = await fetch('/api/portfolio/import', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Import failed: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: (result) => {
      setImportResult(result);
      setUploadProgress(100);
      
      if (result.success > 0) {
        queryClient.invalidateQueries({ queryKey: ['/api/holdings'] });
        queryClient.invalidateQueries({ queryKey: ['/api/portfolio/summary'] });
        
        toast({
          title: "Import Successful",
          description: `Successfully imported ${result.success} holdings`,
        });
      }
      
      if (result.failed > 0) {
        toast({
          title: "Partial Import",
          description: `${result.failed} items failed to import`,
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive",
      });
      setUploadProgress(0);
    },
  });

  const handleFileSelect = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast({
        title: "Invalid File Type",
        description: "Please select a CSV file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast({
        title: "File Too Large",
        description: "File size must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    setImportResult(null);
    importMutation.mutate(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const downloadTemplate = () => {
    const template = [
      'symbol,companyName,shares,avgCostPerShare,purchaseDate',
      'AAPL,Apple Inc.,10,150.00,2024-01-15',
      'MSFT,Microsoft Corporation,5,300.00,2024-02-01',
      'GOOGL,Alphabet Inc.,2,2500.00,2024-01-20'
    ].join('\n');

    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'portfolio_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Upload className="w-5 h-5" />
            <span>Import Portfolio</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              Upload a CSV file to import your existing portfolio holdings
            </p>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="w-4 h-4 mr-2" />
              Download Template
            </Button>
          </div>

          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
          >
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <div className="space-y-2">
              <p className="text-lg font-medium">
                {isDragging ? 'Drop your CSV file here' : 'Drag and drop your CSV file here'}
              </p>
              <p className="text-sm text-gray-500">or</p>
              <Button 
                variant="outline" 
                onClick={() => fileInputRef.current?.click()}
                disabled={importMutation.isPending}
              >
                Choose File
              </Button>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileInputChange}
              className="hidden"
            />
          </div>

          {importMutation.isPending && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Importing portfolio...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          )}

          {importResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm">
                    <Badge variant="default">{importResult.success}</Badge> Successful
                  </span>
                </div>
                {importResult.failed > 0 && (
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span className="text-sm">
                      <Badge variant="destructive">{importResult.failed}</Badge> Failed
                    </span>
                  </div>
                )}
              </div>

              {importResult.errors.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <p className="font-medium">Import Errors:</p>
                      <ul className="text-sm space-y-1">
                        {importResult.errors.map((error, index) => (
                          <li key={index} className="text-red-600">• {error}</li>
                        ))}
                      </ul>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {importResult.imported.length > 0 && (
                <div className="space-y-2">
                  <p className="font-medium text-sm">Successfully Imported:</p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {importResult.imported.map((holding, index) => (
                      <div key={index} className="flex justify-between items-center text-sm bg-green-50 p-2 rounded">
                        <span className="font-medium">{holding.symbol}</span>
                        <span>{holding.shares} shares @ ${holding.avgCostPerShare}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="text-xs text-gray-500 space-y-1">
            <p><strong>CSV Format:</strong> symbol, companyName, shares, avgCostPerShare (or Unit Cost), purchaseDate</p>
            <p><strong>Example:</strong> AAPL, Apple Inc., 10, 150.00, 2024-01-15</p>
            <p><strong>Supported Cost Columns:</strong> avgCostPerShare, Unit Cost, price, cost, averageCost</p>
            <p><strong>Note:</strong> Date format should be YYYY-MM-DD</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}