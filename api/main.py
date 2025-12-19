import os
import time
import json
import logging
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

# Configuration
VLLM_API_BASE = os.getenv("VLLM_API_BASE", "http://localhost:8000/v1")
MODEL_NAME = os.getenv("MODEL_NAME", "llama-2-7b-chat")
PORT = int(os.getenv("PORT", "8001"))

# Optional MongoDB configuration for storing remote messages
MONGODB_URI = os.getenv("MONGODB_URI")
MONGODB_DB = os.getenv("MONGODB_DB", "webllm")
MONGODB_COLLECTION = os.getenv("MONGODB_COLLECTION", "remote_messages")
MONGODB_BENCHMARKS_COLLECTION = os.getenv("MONGODB_BENCHMARKS_COLLECTION", "benchmarks")

mongo_client = AsyncIOMotorClient(MONGODB_URI) if MONGODB_URI else None
mongo_db = mongo_client[MONGODB_DB] if mongo_client is not None else None
mongo_collection = mongo_db[MONGODB_COLLECTION] if mongo_db is not None else None
benchmarks_collection = mongo_db[MONGODB_BENCHMARKS_COLLECTION] if mongo_db is not None else None

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Enable CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    stream: bool = True
    max_tokens: Optional[int] = 1024
    temperature: Optional[float] = 0.7

import csv
from datetime import datetime

# ... existing imports ...

# Metrics logging
METRICS_DIR = os.getenv("METRICS_DIR", "/app/metrics")
METRICS_FILE = os.path.join(METRICS_DIR, "benchmark_metrics.csv")

def log_metrics(ttft_ms: float, total_latency_ms: float, tokens: int = 0):
    """Log metrics to a CSV file."""
    # Ensure metrics directory exists
    os.makedirs(METRICS_DIR, exist_ok=True)
    
    file_exists = os.path.isfile(METRICS_FILE)
    try:
        with open(METRICS_FILE, mode='a', newline='') as f:
            writer = csv.writer(f)
            if not file_exists:
                writer.writerow(["timestamp", "ttft_ms", "total_latency_ms", "approx_tokens"])
            writer.writerow([datetime.now().isoformat(), f"{ttft_ms:.2f}", f"{total_latency_ms:.2f}", tokens])
    except Exception as e:
        logger.error(f"Failed to write metrics: {e}")

@app.post("/api/chat")
async def chat_proxy(request: ChatRequest):
    start_time = time.time()
    logger.info(f"Received chat request. VLLM Target: {VLLM_API_BASE}")
    
    # Log the messages being sent for debugging
    messages = [m.dict() for m in request.messages]
    logger.info(f"Messages count: {len(messages)}")
    for i, msg in enumerate(messages):
        logger.info(f"  [{i}] {msg.get('role', 'unknown')}: {msg.get('content', '')[:50]}...")

    # Prepare payload for vLLM (OpenAI compatible endpoint)
    payload = {
        "model": MODEL_NAME,
        "messages": messages,
        "stream": True,
        "max_tokens": request.max_tokens,
        "temperature": request.temperature,
    }

    async def stream_generator():
        client_start = time.time()
        first_token_time = None
        token_count = 0
        ttft = 0.0
        assistant_text = ""
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream(
                    "POST", 
                    f"{VLLM_API_BASE}/chat/completions", 
                    json=payload,
                    headers={"Content-Type": "application/json"}
                ) as response:
                    
                    if response.status_code != 200:
                        error_body = await response.aread()
                        logger.error(f"Upstream error {response.status_code}: {error_body.decode()}")
                        yield f"data: {json.dumps({'error': f'Upstream error: {response.status_code}'})}\n\n"
                        return

                    async for chunk in response.aiter_lines():
                        if chunk:
                            if chunk.startswith("data: "):
                                # Capture first token timing
                                if first_token_time is None:
                                    first_token_time = time.time()
                                    ttft = (first_token_time - start_time) * 1000
                                    logger.info(f"Time to first token: {ttft:.2f}ms")
                                
                                data = chunk[len("data: ") :].strip()

                                # Skip done signals
                                if data == "[DONE]":
                                    pass
                                else:
                                    # Rough token counting
                                    token_count += 1
                                    # Accumulate assistant text for persistence
                                    try:
                                        parsed = json.loads(data)
                                        delta = (
                                            parsed.get("choices", [{}])[0]
                                            .get("delta", {})
                                        )
                                        content_piece = delta.get("content", "")
                                        if content_piece:
                                            assistant_text += content_piece
                                    except Exception:
                                        # Ignore JSON parse errors and keep streaming
                                        pass
                            
                            yield f"{chunk}\n"

            total_time = (time.time() - start_time) * 1000
            tokens_per_sec = token_count / (total_time / 1000) if total_time > 0 else 0
            logger.info(f"Request completed. Total latency: {total_time:.2f}ms. Tokens: ~{token_count}")
            
            # Log to CSV
            log_metrics(ttft, total_time, token_count)

            # After streaming completes, persist full conversation including the model response with metrics
            if mongo_collection is not None:
                try:
                    full_messages = list(messages)
                    if assistant_text:
                        # Include metrics with the assistant message so they persist
                        full_messages = full_messages + [
                            {
                                "role": "assistant",
                                "content": assistant_text,
                                "metrics": {
                                    "ttftMs": ttft,
                                    "totalTimeMs": total_time,
                                    "tokensPerSec": tokens_per_sec,
                                    "tokenCount": token_count,
                                }
                            }
                        ]

                    await mongo_collection.insert_one(
                        {
                            "timestamp": datetime.utcnow(),
                            "model": MODEL_NAME,
                            "messages": full_messages,
                            "source": "remote",
                        }
                    )
                except Exception as e:
                    logger.error(f"Failed to write chat to MongoDB: {e}")

        except Exception as e:
            logger.error(f"Stream error: {str(e)}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(stream_generator(), media_type="text/event-stream")

@app.get("/api/chat/history")
async def get_chat_history(limit: int = 50):
    """Retrieve recent remote chat history from MongoDB."""
    if mongo_collection is None:
        return {"messages": [], "error": "MongoDB not configured"}
    
    try:
        # Fetch the most recent chat sessions
        # Each document contains a full conversation (messages array)
        cursor = mongo_collection.find().sort("timestamp", -1).limit(limit)
        chats = await cursor.to_list(length=limit)
        
        # Flatten all messages from all chats into a single list
        # Filter out system messages so they don't appear in the UI
        all_messages = []
        for chat in chats:
            chat_messages = chat.get("messages", [])
            # Add metadata from the chat document, excluding system messages
            for msg in chat_messages:
                if msg.get("role") != "system":
                    message_data = {
                        "role": msg.get("role"),
                        "content": msg.get("content"),
                        "timestamp": chat.get("timestamp").isoformat() if chat.get("timestamp") else datetime.utcnow().isoformat(),
                    }
                    # Include metrics if they exist (for assistant messages)
                    if msg.get("metrics"):
                        message_data["metrics"] = msg.get("metrics")
                    all_messages.append(message_data)
        
        # Sort by timestamp (oldest first for conversation flow)
        all_messages.sort(key=lambda x: x.get("timestamp", ""))
        
        return {"messages": all_messages}
    except Exception as e:
        logger.error(f"Failed to retrieve chat history: {e}")
        return {"messages": [], "error": str(e)}

@app.delete("/api/chat/history")
async def clear_chat_history():
    """Clear all remote chat history from MongoDB."""
    if mongo_collection is None:
        return {"error": "MongoDB not configured"}
    
    try:
        result = await mongo_collection.delete_many({})
        logger.info(f"Cleared {result.deleted_count} chat documents from MongoDB")
        return {"deleted_count": result.deleted_count, "message": "All chat history cleared"}
    except Exception as e:
        logger.error(f"Failed to clear chat history: {e}")
        return {"error": str(e)}

# ============== Benchmark API Endpoints ==============

class BenchmarkResult(BaseModel):
    promptId: str
    promptType: str
    mode: str  # 'local' or 'remote'
    metrics: dict  # { ttftMs, tokensPerSec, totalTimeMs, tokenCount }
    timestamp: str
    modelName: str

class BenchmarkBatch(BaseModel):
    results: List[BenchmarkResult]

@app.post("/api/benchmarks")
async def save_benchmark_results(batch: BenchmarkBatch):
    """Save benchmark results to MongoDB."""
    if benchmarks_collection is None:
        return {"error": "MongoDB not configured", "saved": 0}
    
    try:
        docs = []
        for r in batch.results:
            docs.append({
                "promptId": r.promptId,
                "promptType": r.promptType,
                "mode": r.mode,
                "metrics": r.metrics,
                "timestamp": r.timestamp,
                "modelName": r.modelName,
                "createdAt": datetime.utcnow(),
            })
        
        if docs:
            result = await benchmarks_collection.insert_many(docs)
            logger.info(f"Saved {len(result.inserted_ids)} benchmark results to MongoDB")
            return {"saved": len(result.inserted_ids)}
        return {"saved": 0}
    except Exception as e:
        logger.error(f"Failed to save benchmark results: {e}")
        return {"error": str(e), "saved": 0}

@app.get("/api/benchmarks")
async def get_benchmark_results(limit: int = 200):
    """Retrieve benchmark results from MongoDB."""
    if benchmarks_collection is None:
        return {"results": [], "error": "MongoDB not configured"}
    
    try:
        cursor = benchmarks_collection.find().sort("createdAt", -1).limit(limit)
        docs = await cursor.to_list(length=limit)
        
        results = []
        for doc in docs:
            results.append({
                "promptId": doc.get("promptId"),
                "promptType": doc.get("promptType"),
                "mode": doc.get("mode"),
                "metrics": doc.get("metrics"),
                "timestamp": doc.get("timestamp"),
                "modelName": doc.get("modelName"),
            })
        
        # Sort oldest first for display
        results.sort(key=lambda x: x.get("timestamp", ""))
        
        return {"results": results}
    except Exception as e:
        logger.error(f"Failed to retrieve benchmark results: {e}")
        return {"results": [], "error": str(e)}

@app.delete("/api/benchmarks")
async def clear_benchmark_results():
    """Clear all benchmark results from MongoDB."""
    if benchmarks_collection is None:
        return {"error": "MongoDB not configured"}
    
    try:
        result = await benchmarks_collection.delete_many({})
        logger.info(f"Cleared {result.deleted_count} benchmark results from MongoDB")
        return {"deleted_count": result.deleted_count, "message": "All benchmark results cleared"}
    except Exception as e:
        logger.error(f"Failed to clear benchmark results: {e}")
        return {"error": str(e)}

@app.get("/health")
def health_check():
    return {"status": "ok", "backend": "vllm-proxy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
