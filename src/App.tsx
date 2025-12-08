import { useState, useEffect, useCallback } from 'react';
import { InferenceMode, Message } from './types';
import { useWebLLM } from './hooks/useWebLLM';
import { generateRemoteResponse } from './services/remoteApi';
import ModeSelector from './components/ModeSelector';
import ChatArea from './components/ChatArea';
import ChatInput from './components/ChatInput';
import LoadingModal from './components/LoadingModal';
import SettingsMenu from './components/SettingsMenu';

const LOCAL_DB_NAME = 'webllm-chat';
const LOCAL_DB_VERSION = 1;
const LOCAL_STORE_NAME = 'localMessages';

type StoredMessage = Omit<Message, 'timestamp'> & { timestamp: string };

function openLocalDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB not supported'));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LOCAL_DB_NAME, LOCAL_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LOCAL_STORE_NAME)) {
        db.createObjectStore(LOCAL_STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error ?? new Error('Failed to open IndexedDB'));
    };
  });
}

async function loadLocalMessages(): Promise<Message[]> {
  try {
    const db = await openLocalDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(LOCAL_STORE_NAME, 'readonly');
      const store = tx.objectStore(LOCAL_STORE_NAME);
      const req = store.get('local');

      req.onsuccess = () => {
        const data = (req.result as StoredMessage[] | undefined) ?? [];
        const messages: Message[] = data.map((m) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        }));
        console.log('[IndexedDB] Loaded local messages:', messages.length);
        resolve(messages);
      };

      req.onerror = () => {
        console.error('loadLocalMessages error:', req.error);
        reject(req.error ?? new Error('Failed to read local messages'));
      };
    });
  } catch (e) {
    console.error('loadLocalMessages outer error:', e);
    return [];
  }
}

async function saveLocalMessages(messages: Message[]): Promise<void> {
  try {
    const db = await openLocalDB();
    const stored: StoredMessage[] = messages.map((m) => ({
      ...m,
      timestamp: m.timestamp.toISOString(),
    }));

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(LOCAL_STORE_NAME, 'readwrite');
      const store = tx.objectStore(LOCAL_STORE_NAME);
      const req = store.put(stored, 'local');

      req.onsuccess = () => {
        console.log('[IndexedDB] Saved local messages:', stored.length);
        resolve();
      };
      req.onerror = () => {
        console.error('saveLocalMessages error:', req.error);
        reject(req.error ?? new Error('Failed to save local messages'));
      };
    });
  } catch (e) {
    console.error('saveLocalMessages outer error:', e);
  }
}

async function clearLocalMessagesFromDB(): Promise<void> {
  try {
    const db = await openLocalDB();

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(LOCAL_STORE_NAME, 'readwrite');
      const store = tx.objectStore(LOCAL_STORE_NAME);
      const req = store.delete('local');

      req.onsuccess = () => {
        console.log('[IndexedDB] Cleared local messages');
        resolve();
      };
      req.onerror = () => {
        console.error('clearLocalMessagesFromDB error:', req.error);
        reject(req.error ?? new Error('Failed to clear local messages'));
      };
    });
  } catch (e) {
    console.error('clearLocalMessagesFromDB outer error:', e);
  }
}

function App() {
  const [mode, setMode] = useState<InferenceMode>('remote');
  const [messagesByMode, setMessagesByMode] = useState<{
    local: Message[];
    remote: Message[];
  }>({
    local: [],
    remote: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentResponse, setCurrentResponse] = useState<string>('');
  const [hasHydratedLocal, setHasHydratedLocal] = useState(false);

  const {
    engine,
    isLoading: isWebLLMLoading,
    error: webLLMError,
    isInitialized,
    initEngine,
    generate: generateLocal,
    initProgress,
  } = useWebLLM();

  // hydrate on mount
  useEffect(() => {
    let cancelled = false;

    loadLocalMessages().then((loaded) => {
      if (cancelled) return;

      setMessagesByMode((prev) => ({
        ...prev,
        local: loaded,
      }));
      setHasHydratedLocal(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasHydratedLocal) return;
    saveLocalMessages(messagesByMode.local);
  }, [messagesByMode.local, hasHydratedLocal]);
  
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
      const modeKey = mode; // 'local' | 'remote'

      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content,
        timestamp: new Date(),
      };

      // Add user message to the current mode's chat
      setMessagesByMode((prev) => ({
        ...prev,
        [modeKey]: [...prev[modeKey], userMessage],
      }));

      setIsLoading(true);
      setError(null);
      setCurrentResponse('');

      try {
        let assistantContent = '';

        if (mode === 'local') {
          if (!isInitialized || !engine) {
            throw new Error('Local model not initialized. Please wait...');
          }

          assistantContent = await generateLocal(content, (text) => {
            setCurrentResponse(text);
          });
        } else {
          assistantContent = await generateRemoteResponse(content, (text) => {
            setCurrentResponse(text);
          });
        }

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: assistantContent,
          timestamp: new Date(),
        };

        // Add assistant message to the current mode's chat
        setMessagesByMode((prev) => ({
          ...prev,
          [modeKey]: [...prev[modeKey], assistantMessage],
        }));
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
  const baseMessages = messagesByMode[mode];

  const displayMessages = currentResponse
    ? [
        ...baseMessages,
        {
          id: 'streaming',
          role: 'assistant' as const,
          content: currentResponse,
          timestamp: new Date(),
        },
      ]
    : baseMessages;
  
  const handleClearChat = useCallback(() => {
    // Clear messages in React state for the current mode
    setMessagesByMode((prev) => ({
      ...prev,
      [mode]: [],
    }));
    setCurrentResponse('');
    setError(null);

    // If we're in local mode, also clear IndexedDB
    if (mode === 'local') {
      clearLocalMessagesFromDB().catch((e) => {
        console.error('Failed to clear local messages from IndexedDB:', e);
      });
    }
  }, [mode]);
 
  return (
    <div className="flex flex-col h-screen bg-white">
      <ModeSelector mode={mode} onModeChange={setMode}/>
      <SettingsMenu onClearChat={handleClearChat} />
      
      { error && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg shadow-sm">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-500 hover:text-red-700"
          >
            ×
          </button>
        </div>)}
      
      <ChatArea messages={displayMessages} isLoading={isLoading && !currentResponse} />

      <LoadingModal
        open={mode === 'local' && isWebLLMLoading && !isInitialized}
        message={initProgress?.text ?? 'Initializing local model...'}
        progress={initProgress?.progress}
      />

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
