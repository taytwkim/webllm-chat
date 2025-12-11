import { useState, useCallback, useRef } from "react";
import * as webllm from "@mlc-ai/web-llm";
import { InferenceMetrics, Message } from "../types";

/*
console.log(
  'Available WebLLM model_ids:',
  webllm.prebuiltAppConfig.model_list.map((m) => m.model_id),
);
*/

export interface WebLLMState {
  engine: webllm.MLCEngine | null;
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;
}

interface InitProgressState {
  progress: number;
  text: string;
  rawText: string;
}

const DEFAULT_MODEL = "Llama-3.2-3B-Instruct-q4f32_1-MLC";

function summarizeProgressText(raw: string): string {
  const lower = raw.toLowerCase();

  if (lower.includes("fetching param cache")) {
    return "Fetching model parameters...";
  }
  
  if (lower.includes("loading model from cache")) {
    return "Loading model from cache...";
  }

  if (lower.includes("loading gpu shader modules")) {
    return "Loading GPU...";
  }

  if (lower.includes("finish loading on webgpu")) {
    return "Finished loading on WebGPU...";
  }

  return "Loading local model...";
}

export function useWebLLM() {
  const [engine, setEngine] = useState<webllm.MLCEngine | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initProgress, setInitProgress] = useState<InitProgressState | null>(
    null
  );

  const hasTriedInitRef = useRef(false);

  const initEngine = useCallback(async () => {
    if (hasTriedInitRef.current) return;
    hasTriedInitRef.current = true;

    setIsLoading(true);
    setError(null);
    setInitProgress(null);

    try {
      const eng = new webllm.MLCEngine();

      eng.setInitProgressCallback((report: webllm.InitProgressReport) => {
        const rawText = report.text ?? "Initializing local model...";

        console.log("Init progress:", report.progress, rawText);

        setInitProgress({
          progress: report.progress ?? 0,
          text: summarizeProgressText(rawText),
          rawText,
        });
      });

      await eng.reload(DEFAULT_MODEL, {
        temperature: 1.0,
        top_p: 1,
      });

      setEngine(eng);
      setIsInitialized(true);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Failed to initialize WebLLM";
      setError(msg);
      setIsInitialized(false);
      console.error("WebLLM init failed:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

// Update the generate function in useWebLLM
  const generate = useCallback(
    async (
      conversationHistory: Message[],
      onUpdate: (text: string) => void,
      onMetrics?: (metrics: InferenceMetrics) => void
    ) => {
      if (!engine || !isInitialized) {
        throw new Error("Engine not initialized");
      }

      const startTime = performance.now();
      let firstTokenTime: number | null = null;
      let tokenCount = 0;

      // Convert Message[] to the format expected by WebLLM (role + content only)
      const apiMessages = conversationHistory.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // Add system message if not present
      const messages = [
        {
          role: "system" as const,
          content: "You are a helpful AI assistant. Answer questions directly and accurately. Provide clear, concise responses that directly address what the user is asking.",
        },
        ...apiMessages,
      ];

      const completion = await engine.chat.completions.create({
        messages,
        stream: true,
      });

      let fullText = "";
      for await (const chunk of completion) {
        if (firstTokenTime === null) {
            firstTokenTime = performance.now();
        }
        
        const delta = chunk.choices[0]?.delta?.content || "";
        if (delta) {
          tokenCount++; // Approximation
          fullText += delta;
          onUpdate(fullText);
        }
      }

      const endTime = performance.now();
      const ttft = firstTokenTime ? firstTokenTime - startTime : 0;
      const totalTime = endTime - startTime;
      
      // Calculate tokens per second (excluding TTFT for pure generation speed, or total?)
      // Usually TPS = (Tokens - 1) / (TotalTime - TTFT) for decoding speed
      // Or just Tokens / TotalTime for end-to-end throughput. Let's do end-to-end.
      const tps = totalTime > 0 ? tokenCount / (totalTime / 1000) : 0;

      if (onMetrics) {
        onMetrics({
            ttftMs: ttft,
            totalTimeMs: totalTime,
            tokensPerSec: tps,
          tokenCount,
        });
      }

      return fullText;
    },
    [engine, isInitialized]
  );

  const reset = useCallback(() => {
    setEngine(null);
    setIsInitialized(false);
    setError(null);
    setInitProgress(null);
    hasTriedInitRef.current = false;
  }, []);

  const clearModelCache = useCallback(async () => {
    try {
      await webllm.deleteModelAllInfoInCache(DEFAULT_MODEL);
      
      setEngine(null);
      setIsInitialized(false);
      setError(null);
      setInitProgress(null);
      hasTriedInitRef.current = false;
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Failed to clear local model cache";
      setError(msg);
      console.error("Failed to clear model cache:", e);
      throw e;
    }
  }, []);

  return {
    engine,
    isLoading,
    error,
    isInitialized,
    initProgress,
    initEngine,
    generate,
    reset,
    clearModelCache,
  };
}
