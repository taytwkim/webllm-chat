import { InferenceMode } from '../types';

interface ModeSelectorProps {
  mode: InferenceMode;
  onModeChange: (mode: InferenceMode) => void;
  isLocalLoading: boolean;
}

export default function ModeSelector({ mode, onModeChange, isLocalLoading }: ModeSelectorProps) {
  return (
    <div className="fixed top-4 left-4 z-50">
      <div className="relative">
        <button
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
          onClick={() => {
            // Toggle mode
            onModeChange(mode === 'local' ? 'remote' : 'local');
          }}
        >
          <span className="font-medium">
            {mode === 'local' ? '🌐 Local' : '☁️ Remote'}
          </span>
          <svg
            className="w-4 h-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
        
        {/*
        {isLocalLoading && mode === 'local' && (
          <div className="absolute top-full left-0 mt-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg shadow-sm text-sm text-blue-700">
            Initializing local model...
          </div>
        )}
        */}
      </div>
    </div>
  );
}

