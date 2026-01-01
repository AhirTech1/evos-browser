"""
EVOS AI - FastAPI Server
HTTP API for communication between Electron and Python AI backend
"""
import asyncio
import json
import os
import sys
from typing import Dict, Any, List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import settings
from llm_engine import llm_engine
from agent import agent, simple_agent, AgentStep
from memory import memory
from tools import BrowserTools, BROWSER_EXECUTOR_JS


# Request/Response Models
class ChatRequest(BaseModel):
    message: str
    context: Optional[Dict[str, Any]] = None
    stream: bool = False


class ChatResponse(BaseModel):
    response: str
    type: str = "text"  # text, command, error
    command: Optional[Dict[str, Any]] = None


class AgentRequest(BaseModel):
    task: str
    context: Dict[str, Any]
    max_steps: int = 10


class ModeRequest(BaseModel):
    mode: str  # offline, online


class AgentResponse(BaseModel):
    task_id: str
    status: str
    steps: List[Dict[str, Any]]
    result: Optional[Any] = None
    error: Optional[str] = None


class MemoryRequest(BaseModel):
    url: str
    title: str
    content: str
    summary: Optional[str] = None
    tags: Optional[List[str]] = None


class SearchRequest(BaseModel):
    query: str
    limit: int = 10
    domain: Optional[str] = None


# Lifespan handler
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("[Server] Starting EVOS AI Backend...")
    
    # Initialize LLM
    llm_available = await llm_engine.initialize()
    if not llm_available:
        print("[Server] WARNING: LLM not available. Some features will be limited.")
    
    # Initialize memory
    await memory.initialize()
    
    print(f"[Server] Ready on http://{settings.host}:{settings.port}")
    
    yield
    
    # Shutdown
    print("[Server] Shutting down...")
    await llm_engine.close()


# Create FastAPI app
app = FastAPI(
    title="EVOS AI Backend",
    description="Local AI backend for EVOS Browser",
    version="1.0.0",
    lifespan=lifespan
)

# CORS for Electron
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# WebSocket connections for streaming
active_connections: Dict[str, WebSocket] = {}


# Health check
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "llm_available": llm_engine._model_available,
        "memory_stats": await memory.get_stats()
    }


# Get browser executor script
@app.get("/tools/executor")
async def get_executor_script():
    """Get the JavaScript to inject into webviews for tool execution"""
    return {"script": BROWSER_EXECUTOR_JS}


# Chat endpoint
@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Simple chat with the AI"""
    try:
        result = await simple_agent.quick_response(
            message=request.message,
            context=request.context or {}
        )
        
        return ChatResponse(
            response=result.get("message", ""),
            type=result.get("type", "text"),
            command=result.get("command") if result.get("type") == "command" else None
        )
    except Exception as e:
        return ChatResponse(
            response=f"Error: {str(e)}",
            type="error"
        )


# Streaming chat via WebSocket
@app.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    await websocket.accept()
    connection_id = str(id(websocket))
    active_connections[connection_id] = websocket
    
    try:
        while True:
            data = await websocket.receive_json()
            message = data.get("message", "")
            context = data.get("context", {})
            
            # Stream response
            async for chunk in llm_engine.generate_stream(
                prompt=message,
                system_prompt="You are EVOS, a helpful browser assistant. Be concise."
            ):
                await websocket.send_json({"type": "chunk", "content": chunk})
            
            await websocket.send_json({"type": "done"})
            
    except WebSocketDisconnect:
        del active_connections[connection_id]


# Agent execution
@app.post("/agent/execute", response_model=AgentResponse)
async def execute_agent(request: AgentRequest):
    """Execute a multi-step agent task"""
    
    steps = []
    
    async def on_step(step: AgentStep):
        steps.append({
            "step": step.step_number,
            "thought": step.thought,
            "action": step.action,
            "action_input": step.action_input,
            "observation": step.observation
        })
    
    try:
        result = await agent.run(
            task_description=request.task,
            context=request.context,
            on_step=on_step
        )
        
        return AgentResponse(
            task_id=result.task_id,
            status=result.state.value,
            steps=steps,
            result=result.result,
            error=result.error
        )
    except Exception as e:
        return AgentResponse(
            task_id="error",
            status="error",
            steps=steps,
            error=str(e)
        )


# Agent streaming via WebSocket
@app.websocket("/ws/agent")
async def websocket_agent(websocket: WebSocket):
    await websocket.accept()
    
    try:
        while True:
            data = await websocket.receive_json()
            task = data.get("task", "")
            context = data.get("context", {})
            
            async def on_step(step: AgentStep):
                await websocket.send_json({
                    "type": "step",
                    "data": {
                        "step": step.step_number,
                        "thought": step.thought,
                        "action": step.action,
                        "action_input": step.action_input
                    }
                })
            
            result = await agent.run(task, context, on_step)
            
            await websocket.send_json({
                "type": "complete",
                "data": {
                    "task_id": result.task_id,
                    "status": result.state.value,
                    "result": result.result,
                    "error": result.error
                }
            })
            
    except WebSocketDisconnect:
        pass


# Memory endpoints
@app.post("/memory/remember")
async def remember_page(request: MemoryRequest):
    """Store a page in memory"""
    result = await memory.remember_page(
        url=request.url,
        title=request.title,
        content=request.content,
        summary=request.summary,
        tags=request.tags
    )
    return result


@app.post("/memory/search")
async def search_memory(request: SearchRequest):
    """Search through memory"""
    results = await memory.search(
        query=request.query,
        limit=request.limit,
        domain=request.domain
    )
    return {"results": results}


@app.get("/memory/recent")
async def get_recent(limit: int = 20):
    """Get recently visited pages"""
    results = await memory.get_recent(limit=limit)
    return {"results": results}


@app.get("/memory/page")
async def get_page(url: str):
    """Get a specific page from memory"""
    page = await memory.get_page(url)
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    return page


@app.get("/memory/related")
async def get_related(url: str, limit: int = 5):
    """Get pages related to a URL"""
    results = await memory.get_related(url, limit)
    return {"results": results}


@app.get("/memory/stats")
async def get_memory_stats():
    """Get memory statistics"""
    return await memory.get_stats()


@app.delete("/memory/page")
async def delete_page(url: str):
    """Delete a page from memory"""
    success = await memory.delete_page(url)
    return {"success": success}


@app.delete("/memory/all")
async def clear_memory():
    """Clear all memory"""
    success = await memory.clear_all()
    return {"success": success}


# Tool definitions
@app.get("/tools/definitions")
async def get_tool_definitions():
    """Get all available tool definitions"""
    return {"tools": BrowserTools.get_tool_definitions()}


# Model info
@app.get("/model/info")
async def get_model_info():
    """Get information about the current LLM"""
    return {
        "model": str(llm_engine.model),
        "available": llm_engine._model_available,
        "mode": getattr(llm_engine, "mode", "offline"),
        "ollama_host": settings.ollama_host
    }


@app.post("/ai/mode")
async def set_ai_mode(request: ModeRequest):
    """Switch AI mode (online/offline)"""
    success = await llm_engine.switch_mode(request.mode)
    # Update settings in runtime (optional, or rely on llm_engine state)
    settings.ai_mode = request.mode
    
    return {
        "mode": llm_engine.mode,
        "success": success,
        "model": str(llm_engine.model)
    }


@app.post("/model/switch")
async def switch_model(model: str):
    """Switch to a different model"""
    llm_engine.model = model
    available = await llm_engine.initialize()
    return {
        "model": llm_engine.model,
        "available": available
    }


# Main entry point
def main():
    import uvicorn
    
    print(f"""
╔═══════════════════════════════════════════════╗
║         EVOS AI Backend Server                ║
║                                               ║
║  Starting on http://{settings.host}:{settings.port}          ║
║                                               ║
║  Make sure Ollama is running:                 ║
║  > ollama serve                               ║
║  > ollama pull llama3.2:3b                    ║
╚═══════════════════════════════════════════════╝
    """)
    
    uvicorn.run(
        "server:app",
        host=settings.host,
        port=settings.port,
        reload=False,
        log_level="info"
    )


if __name__ == "__main__":
    main()
