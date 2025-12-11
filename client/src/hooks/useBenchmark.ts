import { useState, useCallback, useEffect } from "react";
import { Message, InferenceMode, InferenceMetrics } from "../types";
import {
  fetchBenchmarkResults,
  saveBenchmarkResults,
  clearBenchmarkResults as clearBenchmarksAPI,
} from "../services/remoteApi";

export interface BenchmarkResult {
  promptId: string;
  promptType: "short" | "medium" | "long" | "reasoning";
  promptText: string;
  mode: InferenceMode;
  metrics: InferenceMetrics;
  response: string;
  timestamp: string;
  modelName: string; // 'local-llama-3b' or 'remote-llama-7b'
}

export interface ComparisonResult {
  promptId: string;
  promptText: string;
  local: InferenceMetrics | null;
  localResponse: string | null;
  remote: InferenceMetrics | null;
  remoteResponse: string | null;
  localError?: string;
  remoteError?: string;
}

const TEST_PROMPTS = [
  // Short factual questions
  { id: "short_1", type: "short", text: "What is the capital of France?" },
  { id: "short_2", type: "short", text: "Who wrote Romeo and Juliet?" },
  {
    id: "short_3",
    type: "short",
    text: "What is the largest planet in our solar system?",
  },
  { id: "short_4", type: "short", text: "In what year did World War II end?" },
  {
    id: "short_5",
    type: "short",
    text: "What is the chemical symbol for gold?",
  },

  // Medium explanatory questions
  {
    id: "medium_1",
    type: "medium",
    text: "Explain how photosynthesis works in simple terms.",
  },
  {
    id: "medium_2",
    type: "medium",
    text: "What is the difference between weather and climate?",
  },
  {
    id: "medium_3",
    type: "medium",
    text: "How does a refrigerator keep food cold?",
  },
  {
    id: "medium_4",
    type: "medium",
    text: "Explain what happens during an eclipse.",
  },
  { id: "medium_5", type: "medium", text: "What causes the seasons on Earth?" },

  // Reasoning and math questions
  {
    id: "reasoning_1",
    type: "reasoning",
    text: "If I have 3 apples and eat one, then buy two more, how many do I have?",
  },
  {
    id: "reasoning_2",
    type: "reasoning",
    text: "A train travels 60 miles in 2 hours. What is its average speed?",
  },
  {
    id: "reasoning_3",
    type: "reasoning",
    text: "If today is Monday, what day will it be in 10 days?",
  },
  {
    id: "reasoning_4",
    type: "reasoning",
    text: "Sarah has 15 books. She gives away 4 and receives 6 more. How many books does she have now?",
  },
  {
    id: "reasoning_5",
    type: "reasoning",
    text: "If a rectangle has a length of 8 and width of 5, what is its area?",
  },

  // Longer, more complex questions
  {
    id: "long_1",
    type: "long",
    text: "Describe the process of how a computer processes information from input to output.",
  },
  {
    id: "long_2",
    type: "long",
    text: "Explain the water cycle and why it is important for life on Earth.",
  },
  {
    id: "long_3",
    type: "long",
    text: "What are the main differences between renewable and non-renewable energy sources?",
  },
  {
    id: "long_4",
    type: "long",
    text: "Describe how the human immune system protects the body from disease.",
  },
  {
    id: "long_5",
    type: "long",
    text: "Explain the concept of gravity and how it affects objects on Earth and in space.",
  },
] as const;

export function useBenchmark() {
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [comparisonResults, setComparisonResults] = useState<
    ComparisonResult[]
  >([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [currentMode, setCurrentMode] = useState<InferenceMode>("local");
  const [hasHydrated, setHasHydrated] = useState(false);

  // Load persisted benchmark results from MongoDB on mount
  useEffect(() => {
    let cancelled = false;
    fetchBenchmarkResults().then((loaded) => {
      if (cancelled) return;
      if (loaded.length > 0) {
        setResults(loaded as BenchmarkResult[]);
      }
      setHasHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const runBenchmarkSuite = useCallback(
    async (
      mode: InferenceMode,
      generateFn: (
        prompt: string,
        onUpdate: (t: string) => void,
        onMetrics: (m: InferenceMetrics) => void
      ) => Promise<string>
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
          await new Promise((r) => setTimeout(r, 1000));

          let capturedMetrics: InferenceMetrics | null = null;
          let capturedResponse = "";

          const response = await generateFn(
            prompt.text,
            () => {}, // ignore text updates
            (m) => {
              capturedMetrics = m;
            }
          );

          capturedResponse = response || "";

          if (capturedMetrics) {
            newResults.push({
              promptId: prompt.id,
              promptType: prompt.type,
              promptText: prompt.text,
              mode: mode,
              metrics: capturedMetrics,
              response: capturedResponse,
              timestamp: new Date().toISOString(),
              modelName: mode === "local" ? "Local (3B)" : "Remote (7B)",
            });
          }
        }

        setResults((prev) => [...prev, ...newResults]);

        // Persist new results to MongoDB
        if (newResults.length > 0) {
          saveBenchmarkResults(newResults).then((saved) => {
            console.log(`Saved ${saved} benchmark results to MongoDB`);
          });
        }
      } catch (e) {
        console.error("Benchmark failed", e);
      } finally {
        setIsRunning(false);
      }
    },
    []
  );

  // New: Run comparison benchmark (both local and remote with same prompts)
  const runComparisonBenchmark = useCallback(
    async (
      localGenerateFn: (
        prompt: string,
        onUpdate: (t: string) => void,
        onMetrics: (m: InferenceMetrics) => void
      ) => Promise<string>,
      remoteGenerateFn: (
        prompt: string,
        onUpdate: (t: string) => void,
        onMetrics: (m: InferenceMetrics) => void
      ) => Promise<string>,
      isLocalReady: boolean
    ) => {
      setIsComparing(true);
      setCurrentPromptIndex(0);

      // Initialize comparison results with empty metrics
      const initialResults: ComparisonResult[] = TEST_PROMPTS.map((p) => ({
        promptId: p.id,
        promptText: p.text,
        local: null,
        localResponse: null,
        remote: null,
        remoteResponse: null,
      }));
      setComparisonResults(initialResults);

      const newBenchmarkResults: BenchmarkResult[] = [];

      try {
        for (let i = 0; i < TEST_PROMPTS.length; i++) {
          setCurrentPromptIndex(i);
          const prompt = TEST_PROMPTS[i];

          // Test LOCAL first (if available)
          if (isLocalReady) {
            setCurrentMode("local");
            try {
              let localMetrics: InferenceMetrics | null = null;
              const localResponse = await localGenerateFn(
                prompt.text,
                () => {},
                (m) => {
                  localMetrics = m;
                }
              );

              // Update comparison results live
              setComparisonResults((prev) =>
                prev.map((r, idx) =>
                  idx === i
                    ? {
                        ...r,
                        local: localMetrics,
                        localResponse: localResponse || null,
                      }
                    : r
                )
              );

              if (localMetrics) {
                newBenchmarkResults.push({
                  promptId: prompt.id,
                  promptType: prompt.type,
                  promptText: prompt.text,
                  mode: "local",
                  metrics: localMetrics,
                  response: localResponse || "",
                  timestamp: new Date().toISOString(),
                  modelName: "Local (3B)",
                });
              }
            } catch (e) {
              const errorMsg = e instanceof Error ? e.message : "Unknown error";
              setComparisonResults((prev) =>
                prev.map((r, idx) =>
                  idx === i ? { ...r, localError: errorMsg } : r
                )
              );
            }

            // Small delay between local and remote
            await new Promise((r) => setTimeout(r, 500));
          }

          // Test REMOTE
          setCurrentMode("remote");
          try {
            let remoteMetrics: InferenceMetrics | null = null;
            const remoteResponse = await remoteGenerateFn(
              prompt.text,
              () => {},
              (m) => {
                remoteMetrics = m;
              }
            );

            // Update comparison results live
            setComparisonResults((prev) =>
              prev.map((r, idx) =>
                idx === i
                  ? {
                      ...r,
                      remote: remoteMetrics,
                      remoteResponse: remoteResponse || null,
                    }
                  : r
              )
            );

            if (remoteMetrics) {
              newBenchmarkResults.push({
                promptId: prompt.id,
                promptType: prompt.type,
                promptText: prompt.text,
                mode: "remote",
                metrics: remoteMetrics,
                response: remoteResponse || "",
                timestamp: new Date().toISOString(),
                modelName: "Remote (7B)",
              });
            }
          } catch (e) {
            const errorMsg = e instanceof Error ? e.message : "Unknown error";
            setComparisonResults((prev) =>
              prev.map((r, idx) =>
                idx === i ? { ...r, remoteError: errorMsg } : r
              )
            );
          }

          // Delay between prompts
          if (i < TEST_PROMPTS.length - 1) {
            await new Promise((r) => setTimeout(r, 1000));
          }
        }

        // Add to main results and persist
        setResults((prev) => [...prev, ...newBenchmarkResults]);
        if (newBenchmarkResults.length > 0) {
          saveBenchmarkResults(newBenchmarkResults).then((saved) => {
            console.log(
              `Saved ${saved} comparison benchmark results to MongoDB`
            );
          });
        }
      } catch (e) {
        console.error("Comparison benchmark failed", e);
      } finally {
        setIsComparing(false);
      }
    },
    []
  );

  const clearResults = useCallback(async () => {
    setResults([]);
    setComparisonResults([]);
    try {
      await clearBenchmarksAPI();
      console.log("Cleared benchmark results from MongoDB");
    } catch (e) {
      console.error("Failed to clear benchmarks from MongoDB:", e);
    }
  }, []);

  const downloadCSV = useCallback(() => {
    if (results.length === 0) return;

    const headers = [
      "Timestamp",
      "Mode",
      "Model",
      "Prompt Type",
      "Prompt",
      "Response",
      "TTFT (ms)",
      "Total Time (ms)",
      "Tokens/Sec",
      "Token Count",
    ];
    const rows = results.map((r) => [
      r.timestamp,
      r.mode,
      r.modelName,
      r.promptType,
      `"${r.promptText.replace(/"/g, '""')}"`,
      `"${r.response.replace(/"/g, '""')}"`,
      r.metrics.ttftMs.toFixed(2),
      r.metrics.totalTimeMs.toFixed(2),
      r.metrics.tokensPerSec.toFixed(2),
      r.metrics.tokenCount,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `benchmark_results_${new Date().toISOString()}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [results]);

  return {
    results,
    comparisonResults,
    isRunning,
    isComparing,
    progress: { current: currentPromptIndex + 1, total: TEST_PROMPTS.length },
    currentMode,
    runBenchmarkSuite,
    runComparisonBenchmark,
    clearResults,
    downloadCSV,
  };
}
