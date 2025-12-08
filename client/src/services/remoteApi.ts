// Remote API service for cloud-based inference
// This will be implemented by the backend team

export async function generateRemoteResponse(
  prompt: string,
  onUpdate: (text: string) => void
): Promise<string> {
  // TODO: Replace with actual backend endpoint
  const API_URL = import.meta.env.VITE_REMOTE_API_URL || 'http://localhost:8000/api/chat';
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    if (!reader) {
      throw new Error('No response body');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const json = JSON.parse(data);
            const content = json.choices?.[0]?.delta?.content || '';
            if (content) {
              fullText += content;
              onUpdate(fullText);
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }

    return fullText;
  } catch (error) {
    throw new Error(
      `Remote API error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

