import React, { useState } from 'react';
import { BenchmarkResult, ComparisonResult } from '../hooks/useBenchmark';
import { InferenceMode } from '../types';

interface BenchmarkDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  results: BenchmarkResult[];
  comparisonResults: ComparisonResult[];
  isRunning: boolean;
  isComparing: boolean;
  progress: { current: number; total: number };
  currentMode: InferenceMode;
  onRun: (mode: InferenceMode) => void;
  onRunComparison: () => void;
  onDownload: () => void;
  onClear: () => void;
  isLocalReady: boolean;
}

function MetricCell({ 
  localValue, 
  remoteValue, 
  unit = '', 
  lowerIsBetter = true,
  format = (v: number) => v.toFixed(0)
}: { 
  localValue: number | null; 
  remoteValue: number | null; 
  unit?: string;
  lowerIsBetter?: boolean;
  format?: (v: number) => string;
}) {
  const localBetter = localValue !== null && remoteValue !== null && 
    (lowerIsBetter ? localValue < remoteValue : localValue > remoteValue);
  const remoteBetter = localValue !== null && remoteValue !== null && 
    (lowerIsBetter ? remoteValue < localValue : remoteValue > localValue);

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className={`text-center py-2 px-3 rounded-lg ${
        localValue === null ? 'bg-gray-50 text-gray-400' : 
        localBetter ? 'bg-blue-100 text-blue-800 font-semibold' : 'bg-gray-50 text-gray-700'
      }`}>
        {localValue !== null ? `${format(localValue)}${unit}` : '—'}
      </div>
      <div className={`text-center py-2 px-3 rounded-lg ${
        remoteValue === null ? 'bg-gray-50 text-gray-400' : 
        remoteBetter ? 'bg-green-100 text-green-800 font-semibold' : 'bg-gray-50 text-gray-700'
      }`}>
        {remoteValue !== null ? `${format(remoteValue)}${unit}` : '—'}
      </div>
    </div>
  );
}

function LoadingDots() {
  return (
    <span className="inline-flex gap-1">
      <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
      <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
      <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
    </span>
  );
}

export default function BenchmarkDashboard({
  isOpen,
  onClose,
  results,
  comparisonResults,
  isRunning,
  isComparing,
  progress,
  currentMode,
  onRun,
  onRunComparison,
  onDownload,
  onClear,
  isLocalReady
}: BenchmarkDashboardProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  const toggleRow = (promptId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(promptId)) {
        next.delete(promptId);
      } else {
        next.add(promptId);
      }
      return next;
    });
  };

  if (!isOpen) return null;

  // Calculate summary averages from comparison results
  const completedComparisons = comparisonResults.filter(r => r.local !== null || r.remote !== null);
  const localResults = comparisonResults.filter(r => r.local !== null);
  const remoteResults = comparisonResults.filter(r => r.remote !== null);

  const avgLocal = localResults.length > 0 ? {
    ttft: localResults.reduce((acc, r) => acc + (r.local?.ttftMs || 0), 0) / localResults.length,
    tps: localResults.reduce((acc, r) => acc + (r.local?.tokensPerSec || 0), 0) / localResults.length,
    total: localResults.reduce((acc, r) => acc + (r.local?.totalTimeMs || 0), 0) / localResults.length,
  } : null;

  const avgRemote = remoteResults.length > 0 ? {
    ttft: remoteResults.reduce((acc, r) => acc + (r.remote?.ttftMs || 0), 0) / remoteResults.length,
    tps: remoteResults.reduce((acc, r) => acc + (r.remote?.tokensPerSec || 0), 0) / remoteResults.length,
    total: remoteResults.reduce((acc, r) => acc + (r.remote?.totalTimeMs || 0), 0) / remoteResults.length,
  } : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Benchmark Comparison</h2>
            <p className="text-sm text-gray-500">Compare Local vs Remote inference performance side-by-side</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
        </div>

        {/* Controls */}
        <div className="p-4 bg-white border-b border-gray-200 flex gap-3 items-center flex-wrap">
          <button
            onClick={onRunComparison}
            disabled={isRunning || isComparing || !isLocalReady}
            className={`px-5 py-2.5 rounded-lg font-semibold transition-all ${
              isRunning || isComparing || !isLocalReady
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'bg-gradient-to-r from-blue-600 to-green-600 text-white hover:from-blue-700 hover:to-green-700 shadow-md hover:shadow-lg'
            }`}
          >
            {isComparing ? `Running ${progress.current}/${progress.total}...` : 'Run Comparison'}
          </button>
          
          {!isLocalReady && (
            <span className="text-sm text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
              Switch to Local mode first to initialize the model
            </span>
          )}

          <div className="flex-grow"></div>

          <button
            onClick={() => onRun('local')}
            disabled={isRunning || isComparing || !isLocalReady}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isRunning || isComparing || !isLocalReady ? 'bg-gray-100 text-gray-400' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            Local Only
          </button>
          
          <button
            onClick={() => onRun('remote')}
            disabled={isRunning || isComparing}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isRunning || isComparing ? 'bg-gray-100 text-gray-400' : 'bg-green-50 text-green-700 hover:bg-green-100'
            }`}
          >
            Remote Only
          </button>

          <button
            onClick={onDownload}
            disabled={results.length === 0}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Download CSV
          </button>
          <button
            onClick={onClear}
            className="text-red-500 hover:text-red-700 text-sm font-medium"
          >
            Clear
          </button>
        </div>

        {/* Progress Bar */}
        {(isRunning || isComparing) && (
          <div className="w-full bg-gray-100 h-1.5">
            <div 
              className="bg-gradient-to-r from-blue-600 to-green-600 h-1.5 transition-all duration-500"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          
          {/* Live Comparison Table */}
          {(comparisonResults.length > 0 || isComparing) && (
            <div className="space-y-4">
              {/* Summary Row */}
              {(avgLocal || avgRemote) && (
                <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-xl p-4 border border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Average Performance</h3>
                  <div className="grid grid-cols-4 gap-4">
                    <div></div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-1">TTFT</p>
                      <MetricCell 
                        localValue={avgLocal?.ttft ?? null} 
                        remoteValue={avgRemote?.ttft ?? null}
                        unit=" ms"
                        lowerIsBetter={true}
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-1">Speed</p>
                      <MetricCell 
                        localValue={avgLocal?.tps ?? null} 
                        remoteValue={avgRemote?.tps ?? null}
                        unit=" t/s"
                        lowerIsBetter={false}
                        format={(v) => v.toFixed(1)}
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-1">Total Time</p>
                      <MetricCell 
                        localValue={avgLocal ? avgLocal.total / 1000 : null} 
                        remoteValue={avgRemote ? avgRemote.total / 1000 : null}
                        unit=" s"
                        lowerIsBetter={true}
                        format={(v) => v.toFixed(2)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Header Row */}
              <div className="grid grid-cols-4 gap-4 px-4 py-2 bg-gray-50 rounded-lg text-sm font-semibold text-gray-600">
                <div>Prompt</div>
                <div className="text-center">
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-blue-600">Local</span>
                    <span className="text-green-600">Remote</span>
                  </div>
                  <span className="text-xs font-normal text-gray-400">TTFT (ms)</span>
                </div>
                <div className="text-center">
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-blue-600">Local</span>
                    <span className="text-green-600">Remote</span>
                  </div>
                  <span className="text-xs font-normal text-gray-400">Speed (t/s)</span>
                </div>
                <div className="text-center">
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-blue-600">Local</span>
                    <span className="text-green-600">Remote</span>
                  </div>
                  <span className="text-xs font-normal text-gray-400">Total (s)</span>
                </div>
              </div>

              {/* Comparison Rows */}
              {comparisonResults.map((result, idx) => {
                const isCurrentPrompt = isComparing && idx === progress.current - 1;
                const isPending = result.local === null && result.remote === null && !result.localError && !result.remoteError;
                const isExpanded = expandedRows.has(result.promptId);
                const hasResponses = result.localResponse !== null || result.remoteResponse !== null;
                
                return (
                  <div 
                    key={result.promptId} 
                    className={`rounded-lg border transition-all ${
                      isCurrentPrompt 
                        ? 'border-blue-300 bg-blue-50/50 shadow-sm' 
                        : isPending 
                          ? 'border-gray-100 bg-gray-50/50 opacity-50' 
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    {/* Main Row */}
                    <div 
                      className={`grid grid-cols-4 gap-4 px-4 py-3 cursor-pointer ${hasResponses ? 'hover:bg-gray-50' : ''}`}
                      onClick={() => hasResponses && toggleRow(result.promptId)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-700 line-clamp-2 flex-1" title={result.promptText}>
                          {result.promptText.length > 50 
                            ? result.promptText.substring(0, 50) + '...' 
                            : result.promptText}
                        </span>
                        {isCurrentPrompt && (
                          <span className="text-blue-500"><LoadingDots /></span>
                        )}
                        {hasResponses && (
                          <svg 
                            className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        )}
                      </div>
                      
                      <MetricCell 
                        localValue={result.local?.ttftMs ?? null} 
                        remoteValue={result.remote?.ttftMs ?? null}
                        lowerIsBetter={true}
                      />
                      
                      <MetricCell 
                        localValue={result.local?.tokensPerSec ?? null} 
                        remoteValue={result.remote?.tokensPerSec ?? null}
                        lowerIsBetter={false}
                        format={(v) => v.toFixed(1)}
                      />
                      
                      <MetricCell 
                        localValue={result.local ? result.local.totalTimeMs / 1000 : null} 
                        remoteValue={result.remote ? result.remote.totalTimeMs / 1000 : null}
                        lowerIsBetter={true}
                        format={(v) => v.toFixed(2)}
                      />
                    </div>

                    {/* Expanded Response Section */}
                    {isExpanded && hasResponses && (
                      <div className="border-t border-gray-200 bg-gray-50/50 px-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                          {/* Local Response */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Local Response</span>
                              {result.localError && (
                                <span className="text-xs text-red-600">(Error: {result.localError})</span>
                              )}
                            </div>
                            {result.localResponse ? (
                              <div className="bg-white rounded-lg p-3 border border-blue-200 text-sm text-gray-700 whitespace-pre-wrap">
                                {result.localResponse}
                              </div>
                            ) : (
                              <div className="bg-gray-100 rounded-lg p-3 text-sm text-gray-400 italic">
                                No response yet
                              </div>
                            )}
                          </div>

                          {/* Remote Response */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-semibold text-green-600 uppercase tracking-wide">Remote Response</span>
                              {result.remoteError && (
                                <span className="text-xs text-red-600">(Error: {result.remoteError})</span>
                              )}
                            </div>
                            {result.remoteResponse ? (
                              <div className="bg-white rounded-lg p-3 border border-green-200 text-sm text-gray-700 whitespace-pre-wrap">
                                {result.remoteResponse}
                              </div>
                            ) : (
                              <div className="bg-gray-100 rounded-lg p-3 text-sm text-gray-400 italic">
                                No response yet
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty State */}
          {comparisonResults.length === 0 && !isComparing && (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">⚡</div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Ready to Compare</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                Click "Run Comparison" to test the same prompts on both Local and Remote models, 
                and see a live side-by-side comparison of their performance.
              </p>
            </div>
          )}

          {/* Historical Results (collapsible) */}
          {results.length > 0 && comparisonResults.length === 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b">
                <h3 className="text-sm font-semibold text-gray-600">Historical Results ({results.length})</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {results.slice(-10).map((r, i) => {
                  const resultId = `hist-${i}-${r.promptId}`;
                  const isExpanded = expandedRows.has(resultId);
                  return (
                    <div key={i}>
                      <div 
                        className="grid grid-cols-5 gap-4 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                        onClick={() => toggleRow(resultId)}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            r.mode === 'local' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {r.mode}
                          </span>
                          <span className="text-xs text-gray-500 capitalize">{r.promptType}</span>
                          <svg 
                            className={`w-4 h-4 text-gray-400 transition-transform ml-auto ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                        <div className="text-right font-mono text-sm">{r.metrics.ttftMs.toFixed(0)}</div>
                        <div className="text-right font-mono text-sm">{r.metrics.tokensPerSec.toFixed(1)}</div>
                        <div className="text-right font-mono text-sm">{(r.metrics.totalTimeMs / 1000).toFixed(2)}</div>
                        <div className="text-xs text-gray-500 truncate" title={r.promptText}>
                          {r.promptText.length > 30 ? r.promptText.substring(0, 30) + '...' : r.promptText}
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="px-4 pb-3 bg-gray-50/50 border-t border-gray-100">
                          <div className="mt-2 space-y-2">
                            <div>
                              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Prompt:</span>
                              <div className="mt-1 bg-white rounded p-2 text-sm text-gray-700 border border-gray-200">
                                {r.promptText}
                              </div>
                            </div>
                            <div>
                              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Response:</span>
                              <div className="mt-1 bg-white rounded p-2 text-sm text-gray-700 border border-gray-200 whitespace-pre-wrap">
                                {r.response || 'No response'}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
