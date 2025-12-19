# WebLLM Chat

Chatbot that supports hybrid inference, allowing the user to switch between on-device and remote execution. This hybrid setup reflects a common deployment pattern in which complex queries are routed to the cloud while simpler requests are handled on-device.

## Features

- 🤖 **Local Inference**: Run LLMs directly in the browser using WebLLM
- ☁️ **Remote Inference**: Use cloud-hosted API for faster or higher-quality responses
- 💬 **ChatGPT-like UI**: Clean, modern interface inspired by ChatGPT
- 🔄 **Mode Switching**: Easily switch between local and remote inference modes
- 📊 **Streaming Responses**: Real-time streaming of responses for both modes

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- Modern browser with WebGPU support (Chrome 113+, Edge 113+, or Safari 18+)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to the URL shown in the terminal (usually `http://localhost:5173`)

## Usage

1. **Choose Inference Mode**: Click the mode selector in the top-left corner to switch between:
   - 🌐 **Local**: Uses WebLLM to run models directly in your browser
   - ☁️ **Remote**: Uses the cloud API (vLLM + FastAPI)

2. **Start Chatting**: Type your message in the input field and press Enter or click the send button

3. **First Local Use**: When switching to local mode for the first time, the model will be downloaded and initialized (this may take a few minutes)

## Configuration

### Remote API

To use remote inference, set the `VITE_REMOTE_API_URL` environment variable:

```bash
VITE_REMOTE_API_URL=http://your-backend-url/api/chat npm run dev
```

Or create a `.env` file:
```
VITE_REMOTE_API_URL=http://localhost:8000/api/chat
```

### WebLLM Model

The default model is `Llama-3.2-3B-Instruct-q4f32_1-MLC`. You can change this in `src/hooks/useWebLLM.ts`:

```typescript
const DEFAULT_MODEL = 'Your-Model-Name';
```

Available models can be found in the [WebLLM documentation](https://github.com/webllm/web-llm).

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Browser Compatibility

WebLLM requires WebGPU support. Check compatibility:
- Chrome 113+ ✅
- Edge 113+ ✅
- Safari 18+ ✅
- Firefox (not yet supported) ❌

## Notes

- First-time local model initialization requires downloading model weights (~500MB-2GB depending on model)
- Model weights are cached in the browser for subsequent uses
- Local inference performance depends on your device's GPU capabilities
- Remote API integration requires backend setup

