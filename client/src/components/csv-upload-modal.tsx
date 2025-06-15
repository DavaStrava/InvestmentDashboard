import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, AlertCircle, CheckCircle, Download } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface CSVUploadModalProps {
  onClose: () => void;
}

interface UploadResult {
  message: string;
  imported: number;
  totalRows: number;
  errors?: string[];
  holdings: any[];
}

export default function CSVUploadModal({ onClose }: CSVUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('csvFile', file);
      
      const response = await fetch('/api/portfolio/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }
      
      return response.json();
    },
    onSuccess: (result: UploadResult) => {
      setUploadResult(result);
      queryClient.invalidateQueries({ queryKey: ["/api/holdings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/summary"] });
      
      if (result.imported > 0) {
        toast({ 
          title: "Portfolio imported successfully",
          description: `${result.imported} holdings added to your portfolio`
        });
      }
    },
    onError: (error: Error) => {
      toast({ 
        title: "Upload failed", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        toast({
          title: "Invalid file type",
          description: "Please select a CSV file",
          variant: "destructive"
        });
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select a file smaller than 5MB",
          variant: "destructive"
        });
        return;
      }
      
      setSelectedFile(file);
      setUploadResult(null);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = "symbol,companyName,shares,avgCostPerShare\nAAPL,Apple Inc,100,150.00\nTSLA,Tesla Inc,50,200.00\nAMZN,Amazon.com Inc,25,3000.00";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'portfolio_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setUploadResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Portfolio from CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Instructions */}
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertDescription>
              Upload a CSV file with your portfolio holdings. Required columns: symbol, companyName, shares, avgCostPerShare (or Unit Cost)
            </AlertDescription>
          </Alert>

          {/* Template Download */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h4 className="font-medium">Download Template</h4>
              <p className="text-sm text-gray-500">Get a sample CSV file with the correct format</p>
            </div>
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <Download className="w-4 h-4 mr-2" />
              Template
            </Button>
          </div>

          {!uploadResult ? (
            <>
              {/* File Selection */}
              <div className="space-y-4">
                <Label htmlFor="csvFile">Select CSV File</Label>
                <div className="flex items-center space-x-4">
                  <Input
                    ref={fileInputRef}
                    id="csvFile"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileSelect}
                    className="flex-1"
                  />
                  {selectedFile && (
                    <Button variant="outline" onClick={resetUpload}>
                      Clear
                    </Button>
                  )}
                </div>
                
                {selectedFile && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium">{selectedFile.name}</span>
                      <span className="text-sm text-gray-500">
                        ({(selectedFile.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Upload Action */}
              <div className="flex space-x-3">
                <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || uploadMutation.isPending}
                  className="flex-1"
                >
                  {uploadMutation.isPending ? (
                    <>
                      <Upload className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Import Portfolio
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Upload Results */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    {uploadResult.imported > 0 ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-yellow-500" />
                    )}
                    <span>Import Results</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-green-600">{uploadResult.imported}</p>
                      <p className="text-sm text-gray-500">Imported</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{uploadResult.totalRows}</p>
                      <p className="text-sm text-gray-500">Total Rows</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-600">{uploadResult.errors?.length || 0}</p>
                      <p className="text-sm text-gray-500">Errors</p>
                    </div>
                  </div>

                  {uploadResult.errors && uploadResult.errors.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-red-600">Errors:</h4>
                      <div className="bg-red-50 p-3 rounded-lg max-h-40 overflow-y-auto">
                        {uploadResult.errors.map((error, index) => (
                          <p key={index} className="text-sm text-red-700">{error}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {uploadResult.holdings.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-green-600">Successfully Imported:</h4>
                      <div className="bg-green-50 p-3 rounded-lg max-h-40 overflow-y-auto">
                        {uploadResult.holdings.map((holding, index) => (
                          <p key={index} className="text-sm text-green-700">
                            {holding.symbol} - {holding.shares} shares at ${holding.avgCostPerShare}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex space-x-3">
                <Button variant="outline" onClick={resetUpload} className="flex-1">
                  Upload Another File
                </Button>
                <Button onClick={onClose} className="flex-1">
                  Done
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}