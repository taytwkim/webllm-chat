import { useState, useRef, useEffect } from 'react';

interface SettingsMenuProps {
  onClearChat: () => void;
  onOpenBenchmark: () => void;
}

export default function SettingsMenu({ onClearChat, onOpenBenchmark }: SettingsMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleClearClick = () => {
    setOpen(false);
    onClearChat();
  };

  const handleBenchmarkClick = () => {
    setOpen(false);
    onOpenBenchmark();
  };

  // ... existing code ...

  return (
    <div className="fixed top-4 right-4 z-50" ref={containerRef}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 shadow-sm hover:bg-gray-50"
        >
          {/* three-dot icon */}
          <svg
            className="h-5 w-5 text-gray-600"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <circle cx="4" cy="10" r="1.5" />
            <circle cx="10" cy="10" r="1.5" />
            <circle cx="16" cy="10" r="1.5" />
          </svg>
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg z-50">
            <button
              type="button"
              onClick={handleBenchmarkClick}
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              Run Benchmark
            </button>
            <button
              type="button"
              onClick={handleClearClick}
              className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              Clear chat
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
