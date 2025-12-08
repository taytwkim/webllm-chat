interface LoadingModalProps {
  open: boolean;
  message?: string;
  progress?: number;
}

const LoadingModal: React.FC<LoadingModalProps> = ({ open, message, progress }) => {
  if (!open) return null;

  const pct =
    progress != null
      ? Math.max(5, Math.min(100, Math.round(progress * 100)))
      : 5;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-lg px-6 py-5 flex flex-col gap-3 max-w-sm w-full mx-4">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          <div className="flex flex-col">
            <p className="text-sm font-medium text-gray-900">
              {message ?? 'Initializing local model...'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              This may take a few seconds on first load.
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-1 h-2 w-full bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default LoadingModal;