"use client";

import { useState, useEffect } from 'react';
import { X, Download, FileSpreadsheet } from 'lucide-react';

interface ExcelViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  excelUrl: string | null;
  filename: string;
  onDownload?: () => void;
}

export default function ExcelViewerModal({
  isOpen,
  onClose,
  excelUrl,
  filename,
  onDownload
}: ExcelViewerModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && excelUrl) {
      console.log('🔍 Excel Modal: Opening with URL:', excelUrl);
      console.log('🔍 Excel Modal props:', { isOpen, excelUrl, filename });
      setError(null);
      setLoading(true);

      // Set a timeout to detect if Excel loading is taking too long
      const timeoutId = setTimeout(() => {
        if (loading) {
          console.warn('Excel Modal: Loading timeout reached');
          setError('Excel file is taking too long to load. Try downloading it instead.');
          setLoading(false);
        }
      }, 15000); // 15 second timeout

      return () => clearTimeout(timeoutId);
    }
  }, [isOpen, excelUrl]);

  const handleDownload = () => {
    if (onDownload) {
      onDownload();
    } else if (excelUrl) {
      const link = document.createElement('a');
      link.href = excelUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (!isOpen) return null;

  // Prevent SSR issues
  if (typeof window === 'undefined') return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-6 h-6 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900 truncate max-w-md">
              {filename}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {/* Download Button */}
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 transition-colors"
              title="Download Excel File"
            >
              <Download className="w-4 h-4" />
              Download Excel
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded ml-2"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Excel Content */}
        <div className="flex-1 overflow-auto bg-gray-100 p-4">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading Excel file...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-red-500 mb-4">
                  <X className="w-16 h-16 mx-auto" />
                </div>
                <p className="text-red-600 font-medium mb-2">Error Loading Excel</p>
                <p className="text-gray-600 mb-4">{error}</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <button
                    onClick={() => {
                      setError(null);
                      setLoading(true);
                      // Retry loading the Excel
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Retry Excel Load
                  </button>
                  <button
                    onClick={handleDownload}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Download Excel File
                  </button>
                </div>
              </div>
            </div>
          )}

          {!loading && !error && excelUrl && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-green-500 mb-4">
                  <FileSpreadsheet className="w-24 h-24 mx-auto" />
                </div>
                <p className="text-gray-600 font-medium mb-2">Excel File Ready</p>
                <p className="text-gray-500 mb-4">
                  Click the download button above to save the Excel analysis file.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <button
                    onClick={handleDownload}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                  >
                    Download Excel Analysis
                  </button>
                  <button
                    onClick={() => window.open(excelUrl, '_blank')}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                  >
                    Open in New Tab
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
