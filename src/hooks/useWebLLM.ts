import { useState, useCallback, useRef } from 'react';
import * as webllm from '@mlc-ai/web-llm';

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

const DEFAULT_MODEL = 'Llama-3.2-3B-Instruct-q4f32_1-MLC';

function summarizeProgressText(raw: string): string {
  const lower = raw.toLowerCase();

  if (lower.includes('fetching param cache')) {
    return 'Fetching model parameters...';
  }
  
  if (lower.includes('loading model from cache')) {
    return 'Loading model from cache...';
  }

  if (lower.includes('loading gpu shader modules')) {
    return 'Loading GPU...';
  }

  if (lower.includes('finish loading on webgpu')) {
    return 'Finished loading on WebGPU...';
  }

  return 'Loading local model...';
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
        const rawText = report.text ?? 'Initializing local model...';

        console.log('Init progress:', report.progress, rawText);

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
        e instanceof Error ? e.message : 'Failed to initialize WebLLM';
      setError(msg);
      setIsInitialized(false);
      console.error('WebLLM init failed:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const generate = useCallback(
    async (prompt: string, onUpdate: (text: string) => void) => {
      if (!engine || !isInitialized) {
        throw new Error('Engine not initialized');
      }

      const completion = await engine.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'You are a helpful AI agent helping users.',
          },
          { role: 'user', content: prompt },
        ],
        stream: true,
      });

      let fullText = '';
      for await (const chunk of completion) {
        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta) {
          fullText += delta;
          onUpdate(fullText);
        }
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
      const msg = e instanceof Error ? e.message : 'Failed to clear local model cache';
      setError(msg);
      console.error('Failed to clear model cache:', e);
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
