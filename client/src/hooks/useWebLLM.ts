import { useState, useCallback, useRef } from "react";
import * as webllm from "@mlc-ai/web-llm";
import { InferenceMetrics, Message } from "../types";

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

console.log(
  'Available WebLLM model_ids:',
  webllm.prebuiltAppConfig.model_list.map((m) => m.model_id),
);

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
  const [initProgress, setInitProgress] = useState<InitProgressState | null>(null);

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
        /* Temperature controls how random the next-token choice is.
         * - Low (≈0): more deterministic, picks the highest-probability tokens.
         * - Higher (≈0.7–1.0): more variety/creativity, more randomness.
         *
         * top_p limits choices to the smallest set of tokens whose probabilities add up to p.
         * - top_p=1.0: consider all tokens (no cutoff).
         * - Lower (e.g., 0.9): restrict to more likely tokens → less weirdness, less diversity.
         */
        temperature: 0, // for benchmarking, set to 0
        top_p: 1,       // for benchmarking, set to 1
      });

      setEngine(eng);
      setIsInitialized(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to initialize WebLLM";
      setError(msg);
      setIsInitialized(false);
      console.error("WebLLM init failed:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const generate = useCallback(
    async (
      conversationHistory: Message[],
      onUpdate: (text: string) => void,
      onMetrics?: (metrics: InferenceMetrics) => void
    ) => {
      
      if (!engine || !isInitialized) {
        throw new Error("Engine not initialized");
      }

      await engine.resetChat(false)
      
      const startTime = performance.now();
      let firstContentTime: number | null = null;

      const apiMessages = conversationHistory.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const messages = [
        {
          role: "system" as const,
          content: "You are a helpful, respectful and honest assistant.",
        },
        ...apiMessages,
      ];

      const stream = await engine.chat.completions.create({
        messages,
        stream: true,
        stream_options: { include_usage: true },
        max_tokens: 512,
      });

      let fullText = "";
      let usage: { prompt_tokens?: number; completion_tokens?: number } | null = null;

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content ?? "";

        // TTFT: first time we see actual content
        if (firstContentTime === null && delta.length > 0) {
          firstContentTime = performance.now();
        }

        if (delta) {
          fullText += delta;
          onUpdate(fullText);
        }

        // Only present on the last chunk
        if (chunk.usage) {
          usage = chunk.usage;
          console.log(usage);
        }
      }

      const endTime = performance.now();

      const ttftMs = firstContentTime !== null ? firstContentTime - startTime : 0;
      const totalTimeMs = endTime - startTime;
      const completionTokens = usage?.completion_tokens ?? 0;

      // Steady decode TPS (exclude TTFT): tokens after first token / (end - firstToken)
      let tokensPerSec = 0;
      if (firstContentTime !== null && completionTokens >= 2) {
        const decodeTimeMs = Math.max(1, endTime - firstContentTime);
        const decodeTokens = completionTokens - 1;
        tokensPerSec = decodeTokens / (decodeTimeMs / 1000);
      } else if (completionTokens > 0 && totalTimeMs > 0) {
        // Fallback: end-to-end TPS if we couldn't compute steady decode TPS
        tokensPerSec = completionTokens / (totalTimeMs / 1000);
      }

      if (onMetrics) {
        onMetrics({
          ttftMs,
          totalTimeMs,
          tokensPerSec,
          tokenCount: completionTokens,
        });
      }
      return fullText;
    },
    [engine, isInitialized]
  );

  const resetEngine = useCallback(() => {
    setEngine(null);
    setIsInitialized(false);
    setError(null);
    setInitProgress(null);
    hasTriedInitRef.current = false;
  }, []);

  const resetChat = useCallback(
    async (keepStats = false) => {
      if (!engine) return;
      await engine.resetChat(keepStats);
    },
    [engine]
  );

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
    resetEngine,
    resetChat,
    clearModelCache,
  };
}
