// src/components/ModeSelector.tsx
import { useState, useRef, useEffect } from 'react';
import { InferenceMode } from '../types';

interface ModeSelectorProps {
  mode: InferenceMode;
  onModeChange: (mode: InferenceMode) => void;
}

export default function ModeSelector({ mode, onModeChange }: ModeSelectorProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleSelect = (newMode: InferenceMode) => {
    if (newMode !== mode) {
      onModeChange(newMode);
    }
    setOpen(false);
  };

  // Close dropdown on click outside
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  return (
    <div className="fixed top-4 left-4 z-50" ref={containerRef}>
      <div className="relative inline-block text-left">
        {/* Trigger button */}
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="flex flex-col items-start gap-0.5 px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors min-w-[170px]"
        >
          <span className="text-xs font-medium text-gray-500">
            Switch chat
          </span>
          <span className="flex items-center gap-1 text-sm font-semibold text-gray-900 whitespace-nowrap">
            {mode === 'local' ? '💻 Local (LLaMa 3.2 3B)' : '☁️ Remote'}
            <svg
              className="w-4 h-4 text-gray-500 ml-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={open ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}
              />
            </svg>
          </span>
        </button>

        {/* Dropdown menu */}
        {open && (
          <div className="absolute mt-2 min-w-[200px] rounded-lg bg-white border border-gray-200 shadow-lg py-1">
            <button
              type="button"
              onClick={() => handleSelect('remote')}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 ${
                mode === 'remote' ? 'font-semibold text-gray-900' : 'text-gray-700'
              }`}
            >
              <span>☁️</span>
              <span className="whitespace-nowrap">Remote</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelect('local')}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 ${
                mode === 'local' ? 'font-semibold text-gray-900' : 'text-gray-700'
              }`}
            >
              <span>💻</span>
              <span className="whitespace-nowrap">Local (LLaMa 3.2 3B)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
