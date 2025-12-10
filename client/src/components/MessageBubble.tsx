import { Message } from '../types';

interface MessageBubbleProps {
  message: Message;
}

// ... imports ...

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const hasMetrics = !isUser && message.metrics;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-gray-800 text-white'
            : 'bg-gray-100 text-gray-900'
        }`}
      >
        <div className="whitespace-pre-wrap break-words">
          {message.content}
        </div>
        
        <div className="flex flex-wrap items-center gap-x-3 mt-1">
          <span className={`text-xs ${isUser ? 'text-gray-400' : 'text-gray-500'}`}>
            {message.timestamp.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          
          {hasMetrics && (
            <div className="flex gap-2 text-[10px] text-gray-400 font-mono border-l pl-2 border-gray-300">
              <span title="Time To First Token">TTFT: {message.metrics!.ttftMs.toFixed(0)}ms</span>
              <span title="Tokens Per Second">Speed: {message.metrics!.tokensPerSec.toFixed(1)} t/s</span>
              <span title="Total Generation Time">Total: {(message.metrics!.totalTimeMs / 1000).toFixed(2)}s</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

