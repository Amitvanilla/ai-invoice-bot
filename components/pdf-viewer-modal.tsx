"use client";

import { useState, useEffect } from 'react';
import { X, Download, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';

interface PDFViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string | null;
  filename: string;
  onDownload?: () => void;
}

export default function PDFViewerModal({
  isOpen,
  onClose,
  pdfUrl,
  filename,
  onDownload
}: PDFViewerModalProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Configure PDF.js worker (only in browser)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
    }
  }, []);

  useEffect(() => {
    if (isOpen && pdfUrl) {
      console.log('PDF Modal: Opening with URL:', pdfUrl);
      setPageNumber(1);
      setScale(1.0);
      setError(null);
      setLoading(true);

      // Set a timeout to detect if PDF loading is taking too long
      const timeoutId = setTimeout(() => {
        if (loading) {
          console.warn('PDF Modal: Loading timeout reached');
          setError('PDF is taking too long to load. Try downloading it instead.');
          setLoading(false);
        }
      }, 30000); // 30 second timeout

      return () => clearTimeout(timeoutId);
    }
  }, [isOpen, pdfUrl]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    console.log('PDF Modal: Document loaded successfully with', numPages, 'pages');
    setNumPages(numPages);
    setLoading(false);
    setError(null);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error('PDF Modal: Load error:', error);
    console.error('PDF Modal: URL:', pdfUrl);
    console.error('PDF Modal: Error details:', error.message);
    console.error('PDF Modal: Error stack:', error.stack);

    // Check for common error types
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      setError('Authentication required. Please log in to view PDFs.');
    } else if (error.message.includes('404') || error.message.includes('Not Found')) {
      setError('PDF file not found. The file may not exist or may have been deleted.');
    } else if (error.message.includes('Network') || error.message.includes('fetch')) {
      setError('Network error. Please check your connection and try again.');
    } else if (error.message.includes('InvalidPDFException') || error.message.includes('corrupt')) {
      setError('PDF file appears to be corrupted or invalid.');
    } else {
      setError(`Failed to load PDF: ${error.message}`);
    }

    setLoading(false);
  };

  const handleDownload = () => {
    if (onDownload) {
      onDownload();
    } else if (pdfUrl) {
      // Download Excel analysis instead of PDF
      const excelUrl = pdfUrl.replace('/download?type=original', '/download?type=processed');
      const link = document.createElement('a');
      link.href = excelUrl;
      link.download = filename.replace('.pdf', '.xlsx');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const zoomIn = () => setScale(prev => Math.min(prev + 0.25, 3.0));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));
  const goToPrevPage = () => setPageNumber(prev => Math.max(prev - 1, 1));
  const goToNextPage = () => setPageNumber(prev => Math.min(prev + 1, numPages || 1));

  if (!isOpen) return null;

  // Prevent SSR issues
  if (typeof window === 'undefined') return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900 truncate max-w-md">
              {filename}
            </h3>
            {numPages && (
              <span className="text-sm text-gray-600 bg-white px-2 py-1 rounded border">
                Page {pageNumber} of {numPages}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <button
              onClick={zoomOut}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-600 min-w-[60px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={zoomIn}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            {/* Navigation */}
            {numPages && numPages > 1 && (
              <>
                <div className="w-px h-6 bg-gray-300 mx-2" />
                <button
                  onClick={goToPrevPage}
                  disabled={pageNumber <= 1}
                  className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={goToNextPage}
                  disabled={pageNumber >= numPages}
                  className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}

            {/* Download Button */}
            <div className="w-px h-6 bg-gray-300 mx-2" />
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
              title="Download Excel Analysis"
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

        {/* PDF Content */}
        <div className="flex-1 overflow-auto bg-gray-100 p-4">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading PDF...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-red-500 mb-4">
                  <X className="w-16 h-16 mx-auto" />
                </div>
                <p className="text-red-600 font-medium mb-2">Error Loading PDF</p>
                <p className="text-gray-600">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {!loading && !error && pdfUrl && (
            <div className="flex justify-center">
              <Document
                file={pdfUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={
                  <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                }
              >
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  loading={
                    <div className="flex items-center justify-center py-20">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  }
                />
              </Document>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-red-500 mb-4">
                  <X className="w-16 h-16 mx-auto" />
                </div>
                <p className="text-red-600 font-medium mb-2">Error Loading PDF</p>
                <p className="text-gray-600 mb-4">{error}</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Retry PDF Load
                  </button>
                  <button
                    onClick={() => {
                      // Download Excel instead of PDF when there's an error
                      const excelUrl = pdfUrl?.replace('/download?type=original', '/download?type=processed') || '';
                      const link = document.createElement('a');
                      link.href = excelUrl;
                      link.download = pdfFilename?.replace('.pdf', '.xlsx') || 'invoice_analysis.xlsx';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Download Excel Analysis
                  </button>
                  <button
                    onClick={() => window.open(pdfUrl, '_blank')}
                    className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                  >
                    Open PDF in Browser
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
