// Remote API service for cloud-based inference

import { InferenceMetrics, Message } from "../types";

// Get API base URL from environment or use default
// Normalize to ensure it doesn't include /api/chat
const getApiBaseUrl = (): string => {
  try {
    // @ts-ignore - Vite env types
    let url = import.meta.env.VITE_REMOTE_API_URL || "http://localhost:8001";
    // Remove trailing /api/chat if present to avoid duplication
    url = url.replace(/\/api\/chat\/?$/, "");
    return url;
  } catch {
    return "http://localhost:8001";
  }
};

const API_BASE_URL = getApiBaseUrl();

export async function fetchRemoteChatHistory(): Promise<Message[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/chat/history`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch chat history: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      console.warn("Chat history error:", data.error);
      return [];
    }

    // Convert API response to Message format
    // Filter out system messages so they don't appear in the UI
    const messages: Message[] = data.messages
      .filter((msg: any) => msg.role !== "system")
      .map((msg: any, index: number) => ({
        id: `remote-${Date.parse(
          msg.timestamp || new Date().toISOString()
        )}-${index}`,
        role: msg.role as "user" | "assistant",
        content: msg.content,
        timestamp: new Date(msg.timestamp || new Date().toISOString()),
      }));

    return messages;
  } catch (error) {
    console.error("Error fetching remote chat history:", error);
    return [];
  }
}

export async function clearRemoteChatHistory(): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/chat/history`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to clear chat history: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("Remote chat history cleared:", data);
  } catch (error) {
    console.error("Error clearing remote chat history:", error);
    throw error;
  }
}

export async function generateRemoteResponse(
  conversationHistory: Message[],
  onUpdate: (text: string) => void,
  onMetrics?: (metrics: InferenceMetrics) => void
): Promise<string> {
  const API_URL = `${API_BASE_URL}/api/chat`;

  const startTime = performance.now();
  let firstTokenTime: number | null = null;
  let tokenCount = 0;

  try {
    // Convert Message[] to the format expected by the API (role + content only)
    // Filter out system messages from the UI conversation history
    const apiMessages = conversationHistory
      .filter((msg) => msg.role !== "system")
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

    // Add a small-talk system prompt (not shown in UI).
    // It keeps the tone friendly but explicitly prevents the model
    // from simulating both sides of the dialogue.
    const payload = {
      messages: [
        {
          role: "system",
          content:
            "You are a friendly, concise assistant for casual small talk. Answer the user's latest message once in a short paragraph. Do not roleplay both user and assistant, and do not include labels like 'user:' or 'assistant:' in your reply.",
        },
        ...apiMessages,
      ],
      stream: true,
      // Keep generations bounded so a single turn can't ramble forever.
      max_tokens: 256,
    };

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = "";

    if (!reader) {
      throw new Error("No response body");
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const json = JSON.parse(data);
            const content = json.choices?.[0]?.delta?.content || "";
            if (content) {
              if (firstTokenTime === null) {
                firstTokenTime = performance.now();
              }
              tokenCount++;
              fullText += content;
              onUpdate(fullText);
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }

    const endTime = performance.now();
    const ttft = firstTokenTime ? firstTokenTime - startTime : 0;
    const totalTime = endTime - startTime;
    const tps = totalTime > 0 ? tokenCount / (totalTime / 1000) : 0;

    if (onMetrics) {
      onMetrics({
        ttftMs: ttft,
        totalTimeMs: totalTime,
        tokensPerSec: tps,
        tokenCount,
      });
    }

    return fullText;
  } catch (error) {
    throw new Error(
      `Remote API error: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}
