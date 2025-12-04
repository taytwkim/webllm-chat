import { useState, useEffect, useCallback } from 'react';
import { InferenceMode, Message } from './types';
import { useWebLLM } from './hooks/useWebLLM';
import { generateRemoteResponse } from './services/remoteApi';
import ModeSelector from './components/ModeSelector';
import ChatArea from './components/ChatArea';
import ChatInput from './components/ChatInput';

function App() {
  const [mode, setMode] = useState<InferenceMode>('local');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentResponse, setCurrentResponse] = useState<string>('');

  const {
    engine,
    isLoading: isWebLLMLoading,
    error: webLLMError,
    isInitialized,
    initEngine,
    generate: generateLocal,
  } = useWebLLM();

  // Initialize WebLLM when switching to local mode
  useEffect(() => {
    if (mode === 'local' && !isInitialized && !isWebLLMLoading && !engine) {
      initEngine().catch((err) => {
        setError(`Failed to initialize local model: ${err.message}`);
      });
    }
  }, [mode, isInitialized, isWebLLMLoading, engine, initEngine]);

  // Update error state when WebLLM error changes
  useEffect(() => {
    if (webLLMError) {
      setError(webLLMError);
    }
  }, [webLLMError]);

  const handleSend = useCallback(
    async (content: string) => {
      // Add user message
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setError(null);
      setCurrentResponse('');

      try {
        let assistantContent = '';

        if (mode === 'local') {
          if (!isInitialized || !engine) {
            throw new Error('Local model not initialized. Please wait...');
          }

          // Generate response using WebLLM
          assistantContent = await generateLocal(content, (text) => {
            setCurrentResponse(text);
          });
        } else {
          // Generate response using remote API
          assistantContent = await generateRemoteResponse(content, (text) => {
            setCurrentResponse(text);
          });
        }

        // Add assistant message
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: assistantContent,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setCurrentResponse('');
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'An unknown error occurred';
        setError(errorMessage);
        console.error('Error generating response:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [mode, isInitialized, engine, generateLocal]
  );

  // Display current streaming response
  const displayMessages = currentResponse
    ? [
        ...messages,
        {
          id: 'streaming',
          role: 'assistant' as const,
          content: currentResponse,
          timestamp: new Date(),
        },
      ]
    : messages;

  return (
    <div className="flex flex-col h-screen bg-white">
      <ModeSelector
        mode={mode}
        onModeChange={setMode}
        isLocalLoading={isWebLLMLoading}
      />

      {error && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg shadow-sm">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-500 hover:text-red-700"
          >
            ×
          </button>
        </div>
      )}

      <ChatArea messages={displayMessages} isLoading={isLoading && !currentResponse} />

      <ChatInput
        onSend={handleSend}
        disabled={isLoading || (mode === 'local' && !isInitialized)}
        placeholder={
          mode === 'local' && !isInitialized
            ? 'Initializing local model...'
            : '+ Ask anything'
        }
      />
    </div>
  );
}

export default App;

