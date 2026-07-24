"use client";

import { useState } from 'react';
import { 
  Bug, ChevronDown, ChevronRight, Copy, Download, 
  Maximize2, Minimize2, Search, X 
} from 'lucide-react';

interface DebugLogViewerProps {
  logs: string[];
  extractionDiagnostics?: string;
}

export default function DebugLogViewer({ logs, extractionDiagnostics }: DebugLogViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSection, setSelectedSection] = useState<'all' | 'extraction' | 'augmentation' | 'diagnostics'>('all');

  // Filter logs based on section
  const filterLogs = () => {
    let filtered = logs;
    
    if (selectedSection === 'extraction') {
      filtered = logs.filter(log => 
        log.includes('OpenAI#1') || 
        log.includes('extraction') || 
        log.includes('Extraction')
      );
    } else if (selectedSection === 'augmentation') {
      filtered = logs.filter(log => 
        log.includes('OpenAI#2') || 
        log.includes('augmentation') || 
        log.includes('Augmentation')
      );
    } else if (selectedSection === 'diagnostics') {
      return extractionDiagnostics ? [extractionDiagnostics] : [];
    }
    
    if (searchTerm) {
      filtered = filtered.filter(log => 
        log.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return filtered;
  };

  const filteredLogs = filterLogs();

  const copyToClipboard = () => {
    const text = filteredLogs.join('\n');
    navigator.clipboard.writeText(text);
  };

  const downloadLogs = () => {
    const text = filteredLogs.join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-logs-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!logs || logs.length === 0) return null;

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-white' : ''}`}>
      <section className={`glass-card p-6 ${isFullscreen ? 'h-full' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 
            className="text-lg font-medium flex items-center gap-2 cursor-pointer hover:text-blue-600 transition-colors"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            <Bug className="h-5 w-5 text-red-600" />
            Debug Logs
            <span className="text-sm text-gray-500">({logs.length} entries)</span>
          </h3>
          
          {isExpanded && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
              <button
                onClick={copyToClipboard}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Copy logs"
              >
                <Copy className="h-4 w-4" />
              </button>
              <button
                onClick={downloadLogs}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Download logs"
              >
                <Download className="h-4 w-4" />
              </button>
              {isFullscreen && (
                <button
                  onClick={() => setIsFullscreen(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors ml-4"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {isExpanded && (
          <div className={`${isFullscreen ? 'h-[calc(100%-120px)]' : ''}`}>
            {/* Controls */}
            <div className="mb-4 space-y-3">
              {/* Section tabs */}
              <div className="flex gap-2">
                {(['all', 'extraction', 'augmentation', 'diagnostics'] as const).map(section => (
                  <button
                    key={section}
                    onClick={() => setSelectedSection(section)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedSection === section 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    {section.charAt(0).toUpperCase() + section.slice(1)}
                  </button>
                ))}
              </div>
              
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  >
                    <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>
            </div>

            {/* Log content */}
            <div className={`${
              isFullscreen 
                ? 'h-full' 
                : 'max-h-[600px]'
            } overflow-auto bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-xs`}>
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log, index) => {
                  // Syntax highlighting for different log types
                  let className = "whitespace-pre-wrap break-all mb-2 ";
                  
                  if (log.includes('[analyze:')) {
                    className += "text-cyan-300";
                  } else if (log.includes('Error') || log.includes('error')) {
                    className += "text-red-400";
                  } else if (log.includes('Warning') || log.includes('warning')) {
                    className += "text-yellow-400";
                  } else if (log.includes('{') && log.includes('}')) {
                    // JSON content
                    className += "text-green-300";
                  } else if (log.includes('===')) {
                    // Section headers
                    className += "text-purple-400 font-bold";
                  }
                  
                  // Format JSON if detected
                  let content = log;
                  if (log.trim().startsWith('{') || log.trim().startsWith('[')) {
                    try {
                      const parsed = JSON.parse(log);
                      content = JSON.stringify(parsed, null, 2);
                    } catch {
                      // Not valid JSON, keep as is
                    }
                  }
                  
                  return (
                    <div key={index} className={className}>
                      <span className="text-gray-500 mr-2">[{index + 1}]</span>
                      {content}
                    </div>
                  );
                })
              ) : (
                <div className="text-gray-500 text-center py-8">
                  No logs found matching your criteria
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
              <div>
                Showing {filteredLogs.length} of {logs.length} log entries
              </div>
              <div className="flex gap-4">
                <span>Total size: {(filteredLogs.join('\n').length / 1024).toFixed(2)} KB</span>
                {searchTerm && <span>Filter: "{searchTerm}"</span>}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
