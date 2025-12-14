export type Role = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: Date;
  metrics?: InferenceMetrics;
}

export type InferenceMode = 'local' | 'remote';

export interface InferenceMetrics {
  ttftMs: number;       // Time to First Token (ms)
  totalTimeMs: number;  // Total generation time (ms)
  tokensPerSec: number; // Estimated tokens per second
  tokenCount: number;
}
