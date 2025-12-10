import { useState, useCallback } from 'react';
import { Message, InferenceMode, InferenceMetrics } from '../types';

export interface BenchmarkResult {
  promptId: string;
  promptType: 'short' | 'medium' | 'long' | 'reasoning';
  mode: InferenceMode;
  metrics: InferenceMetrics;
  timestamp: string;
  modelName: string; // 'local-llama-3b' or 'remote-llama-7b'
}

const TEST_PROMPTS = [
  { id: 'short_1', type: 'short', text: 'What is the capital of France?' },
  { id: 'medium_1', type: 'medium', text: 'Explain how photosynthesis works in simple terms.' },
  { id: 'reasoning_1', type: 'reasoning', text: 'If I have 3 apples and eat one, then buy two more, how many do I have?' },
  // { id: 'long_1', type: 'long', text: 'Write a short story about a space traveler finding a new planet.' },
] as const;

export function useBenchmark() {
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [currentMode, setCurrentMode] = useState<InferenceMode>('local');

  const runBenchmarkSuite = useCallback(async (
    mode: InferenceMode,
    generateFn: (prompt: string, onUpdate: (t: string) => void, onMetrics: (m: InferenceMetrics) => void) => Promise<string>
  ) => {
    setIsRunning(true);
    setCurrentMode(mode);
    setCurrentPromptIndex(0);
    
    const newResults: BenchmarkResult[] = [];

    try {
      for (let i = 0; i < TEST_PROMPTS.length; i++) {
        setCurrentPromptIndex(i);
        const prompt = TEST_PROMPTS[i];
        
        // Wait a bit between requests to let system cool down / reset
        await new Promise(r => setTimeout(r, 1000));

        let capturedMetrics: InferenceMetrics | null = null;
        
        await generateFn(
          prompt.text, 
          () => {}, // ignore text updates
          (m) => { capturedMetrics = m; }
        );

        if (capturedMetrics) {
          newResults.push({
            promptId: prompt.id,
            promptType: prompt.type,
            mode: mode,
            metrics: capturedMetrics,
            timestamp: new Date().toISOString(),
            modelName: mode === 'local' ? 'Local (3B)' : 'Remote (7B)'
          });
        }
      }
      
      setResults(prev => [...prev, ...newResults]);
    } catch (e) {
      console.error("Benchmark failed", e);
    } finally {
      setIsRunning(false);
    }
  }, []);

  const clearResults = useCallback(() => setResults([]), []);

  const downloadCSV = useCallback(() => {
    if (results.length === 0) return;
    
    const headers = ['Timestamp', 'Mode', 'Model', 'Prompt Type', 'TTFT (ms)', 'Total Time (ms)', 'Tokens/Sec', 'Token Count'];
    const rows = results.map(r => [
      r.timestamp,
      r.mode,
      r.modelName,
      r.promptType,
      r.metrics.ttftMs.toFixed(2),
      r.metrics.totalTimeMs.toFixed(2),
      r.metrics.tokensPerSec.toFixed(2),
      r.metrics.tokenCount
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `benchmark_results_${new Date().toISOString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [results]);

  return {
    results,
    isRunning,
    progress: { current: currentPromptIndex + 1, total: TEST_PROMPTS.length },
    currentMode,
    runBenchmarkSuite,
    clearResults,
    downloadCSV
  };
}

