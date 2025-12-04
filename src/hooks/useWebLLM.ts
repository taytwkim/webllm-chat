import { useState, useCallback } from 'react';
import * as webllm from '@mlc-ai/web-llm';

export interface WebLLMState {
  engine: webllm.MLCEngine | null;
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;
}

const DEFAULT_MODEL = 'TinyLlama-1.1B-Chat-v0.4';

export function useWebLLM() {
  const [state, setState] = useState<WebLLMState>({
    engine: null,
    isLoading: false,
    error: null,
    isInitialized: false,
  });

  const initEngine = useCallback(async (modelName: string = DEFAULT_MODEL) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const engine = await webllm.CreateMLCEngine(modelName, {
        initProgressCallback: (report: webllm.InitProgressReport) => {
          console.log('Init progress:', report);
        },
      });
      
      setState({
        engine,
        isLoading: false,
        error: null,
        isInitialized: true,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize WebLLM';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        isInitialized: false,
      }));
      throw error;
    }
  }, []);

  const generate = useCallback(async (
    prompt: string,
    onUpdate: (text: string) => void
  ): Promise<string> => {
    if (!state.engine) {
      throw new Error('Engine not initialized');
    }

    const completion = await state.engine.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    });

    let fullText = '';
    for await (const chunk of completion) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullText += content;
        onUpdate(fullText);
      }
    }

    return fullText;
  }, [state.engine]);

  const reset = useCallback(() => {
    if (state.engine) {
      // WebLLM doesn't have a direct reset method, but we can clear the chat history
      setState(prev => ({
        ...prev,
        engine: null,
        isInitialized: false,
      }));
    }
  }, [state.engine]);

  return {
    ...state,
    initEngine,
    generate,
    reset,
  };
}

