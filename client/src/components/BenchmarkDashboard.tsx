import React from 'react';
import { BenchmarkResult } from '../hooks/useBenchmark';
import { InferenceMode } from '../types';

interface BenchmarkDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  results: BenchmarkResult[];
  isRunning: boolean;
  progress: { current: number; total: number };
  onRun: (mode: InferenceMode) => void;
  onDownload: () => void;
  onClear: () => void;
}

export default function BenchmarkDashboard({
  isOpen,
  onClose,
  results,
  isRunning,
  progress,
  onRun,
  onDownload,
  onClear
}: BenchmarkDashboardProps) {
  if (!isOpen) return null;

  // Calculate Aggregates
  const stats = ['local', 'remote'].map(mode => {
    const modeResults = results.filter(r => r.mode === mode);
    if (modeResults.length === 0) return null;

    const avgTtft = modeResults.reduce((acc, r) => acc + r.metrics.ttftMs, 0) / modeResults.length;
    const avgTps = modeResults.reduce((acc, r) => acc + r.metrics.tokensPerSec, 0) / modeResults.length;
    
    return {
      mode,
      count: modeResults.length,
      avgTtft,
      avgTps
    };
  }).filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Benchmark Suite 📊</h2>
            <p className="text-sm text-gray-500">Run standardized tests to compare Local vs Cloud performance.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
        </div>

        {/* Controls */}
        <div className="p-6 bg-white border-b border-gray-200 flex gap-4 items-center flex-wrap">
          <button
            onClick={() => onRun('local')}
            disabled={isRunning}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isRunning ? 'bg-gray-100 text-gray-400' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isRunning ? 'Running...' : 'Run Local Benchmark'}
          </button>
          
          <button
            onClick={() => onRun('remote')}
            disabled={isRunning}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isRunning ? 'bg-gray-100 text-gray-400' : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {isRunning ? 'Running...' : 'Run Remote Benchmark'}
          </button>

          <div className="flex-grow"></div>

          <button
            onClick={onDownload}
            disabled={results.length === 0}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Download CSV
          </button>
          <button
            onClick={onClear}
            className="text-red-500 hover:text-red-700 text-sm font-medium"
          >
            Clear Data
          </button>
        </div>

        {/* Progress Bar */}
        {isRunning && (
          <div className="w-full bg-gray-100 h-1">
            <div 
              className="bg-blue-600 h-1 transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-8">
          
          {/* Summary Cards */}
          {stats.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {stats.map((stat: any) => (
                <div key={stat.mode} className={`p-4 rounded-lg border ${stat.mode === 'local' ? 'bg-blue-50 border-blue-100' : 'bg-green-50 border-green-100'}`}>
                  <h3 className="font-bold text-lg capitalize mb-2">{stat.mode} Mode</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Avg TTFT</p>
                      <p className="text-xl font-mono font-semibold">{stat.avgTtft.toFixed(0)}ms</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Avg Speed</p>
                      <p className="text-xl font-mono font-semibold">{stat.avgTps.toFixed(1)} t/s</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Results Table */}
          {results.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 font-medium border-b">
                  <tr>
                    <th className="px-4 py-3">Mode</th>
                    <th className="px-4 py-3">Prompt Type</th>
                    <th className="px-4 py-3 text-right">TTFT (ms)</th>
                    <th className="px-4 py-3 text-right">Speed (t/s)</th>
                    <th className="px-4 py-3 text-right">Total (s)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {results.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          r.mode === 'local' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {r.mode}
                        </span>
                      </td>
                      <td className="px-4 py-3 capitalize">{r.promptType}</td>
                      <td className="px-4 py-3 text-right font-mono">{r.metrics.ttftMs.toFixed(0)}</td>
                      <td className="px-4 py-3 text-right font-mono">{r.metrics.tokensPerSec.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right font-mono">{(r.metrics.totalTimeMs / 1000).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              No results yet. Run a benchmark to see data.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

