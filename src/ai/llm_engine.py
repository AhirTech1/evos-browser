"""
EVOS AI - LLM Engine Manager
Handles dynamic switching between Offline (Ollama) and Online (Gemini) engines
"""
import asyncio
import json
from typing import Optional, AsyncGenerator, Dict, Any, List
import httpx
from config import settings
from gemini_engine import GeminiEngine

class OllamaEngine:
    """Local LLM engine using Ollama (Legacy Implementation)"""
    
    def __init__(self):
        self.base_url = settings.ollama_host
        self.model = settings.default_model
        self.client = httpx.AsyncClient(timeout=120.0)
        self._model_available = False
        
    async def initialize(self) -> bool:
        """Check if Ollama is running and model is available"""
        try:
            # Check if Ollama is running
            response = await self.client.get(f"{self.base_url}/api/tags")
            if response.status_code == 200:
                models = response.json().get("models", [])
                model_names = [m["name"] for m in models]
                
                # Check if our model is available
                if self.model in model_names or self.model.split(":")[0] in [m.split(":")[0] for m in model_names]:
                    self._model_available = True
                    print(f"[Ollama] Model '{self.model}' is available")
                    return True
                else:
                    # Try fallback model
                    if settings.fallback_model in model_names:
                        self.model = settings.fallback_model
                        self._model_available = True
                        print(f"[Ollama] Using fallback model '{self.model}'")
                        return True
                    else:
                        print(f"[Ollama] No suitable model found. Available: {model_names}")
                        return False
            return False
        except Exception as e:
            print(f"[Ollama] Not available: {e}")
            return False
    
    async def generate(self, prompt: str, system_prompt: Optional[str] = None, temperature: float = 0.7, max_tokens: int = 2048, stream: bool = False) -> str:
        if not self._model_available: return "Ollama not available."
        messages = []
        if system_prompt: messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        try:
            response = await self.client.post(
                f"{self.base_url}/api/chat",
                json={"model": self.model, "messages": messages, "stream": False, "options": {"temperature": temperature, "num_predict": max_tokens}}
            )
            if response.status_code == 200:
                return response.json().get("message", {}).get("content", "")
            return f"Error: {response.status_code}"
        except Exception as e:
            return f"Error generating response: {str(e)}"
    
    async def generate_stream(self, prompt: str, system_prompt: Optional[str] = None, temperature: float = 0.7, max_tokens: int = 2048) -> AsyncGenerator[str, None]:
        if not self._model_available:
            yield "Ollama not available."
            return
        messages = []
        if system_prompt: messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        try:
            async with self.client.stream("POST", f"{self.base_url}/api/chat", json={"model": self.model, "messages": messages, "stream": True, "options": {"temperature": temperature, "num_predict": max_tokens}}) as response:
                async for line in response.aiter_lines():
                    if line:
                        try:
                            data = json.loads(line)
                            content = data.get("message", {}).get("content", "")
                            if content: yield content
                        except: continue
        except Exception as e:
            yield f"Error: {str(e)}"

    async def generate_with_tools(self, prompt: str, tools: List[Dict[str, Any]], system_prompt: Optional[str] = None) -> Dict[str, Any]:
        """Generate response with tool/function calling capability (Prompt Engineering)"""
        tool_descriptions = "\n".join([f"- {tool['name']}: {tool['description']}\n  Parameters: {json.dumps(tool.get('parameters', {}))}" for tool in tools])
        enhanced_system = f"""{system_prompt or 'You are a helpful AI assistant.'}
You have access to the following tools:
{tool_descriptions}
When you need to use a tool, respond with JSON in this exact format:
{{"tool": "tool_name", "parameters": {{"param1": "value1"}}}}
If you don't need a tool, just respond normally with text.
Always think step by step before using tools."""
        response = await self.generate(prompt, enhanced_system, temperature=0.3)
        try:
            if "{" in response and "}" in response:
                start = response.find("{")
                end = response.rfind("}") + 1
                json_str = response[start:end]
                parsed = json.loads(json_str)
                if "tool" in parsed:
                    return {"type": "tool_call", "tool": parsed["tool"], "parameters": parsed.get("parameters", {}), "raw_response": response}
        except: pass
        return {"type": "text", "content": response}

    async def embeddings(self, text: str) -> List[float]:
        try:
            response = await self.client.post(f"{self.base_url}/api/embeddings", json={"model": self.model, "prompt": text})
            if response.status_code == 200: return response.json().get("embedding", [])
            return []
        except: return []

    async def close(self):
        await self.client.aclose()


class LLMEngine:
    """Manager class that routes to either Ollama or Gemini"""
    
    def __init__(self):
        self.ollama = OllamaEngine()
        self.gemini = GeminiEngine()
        self.mode = settings.ai_mode # 'offline' or 'online'
        self.active_engine = self.ollama if self.mode == 'offline' else self.gemini
        self.model = self.active_engine.model
        self._model_available = False
        
    async def initialize(self) -> bool:
        """Initialize both engines, set active based on config"""
        self.mode = settings.ai_mode
        print(f"[LLM Manager] Initializing in {self.mode} mode...")
        
        # Init both just in case we switch later? Or just the active one?
        # Better to init active one.
        
        if self.mode == 'online':
            success = await self.gemini.initialize()
            if success:
                self.active_engine = self.gemini
                self.model = self.gemini.model_name
                self._model_available = True
                return True
            else:
                print("[LLM Manager] Online init failed, falling back to Offline")
                self.mode = 'offline'
                # Fallthrough to offline init
                
        # Offline init
        self.active_engine = self.ollama
        success = await self.ollama.initialize()
        self.model = self.ollama.model
        self._model_available = success
        return success
        
    async def switch_mode(self, mode: str) -> bool:
        """Switch between online and offline"""
        print(f"[LLM Manager] Switching to {mode}...")
        if mode == 'online':
            if await self.gemini.initialize():
                self.mode = 'online'
                self.active_engine = self.gemini
                self.model = self.gemini.model_name
                return True
            return False
            
        elif mode == 'offline':
            if await self.ollama.initialize():
                self.mode = 'offline'
                self.active_engine = self.ollama
                self.model = self.ollama.model
                return True
            return False
            
        return False

    # Delegate methods
    async def generate(self, *args, **kwargs):
        return await self.active_engine.generate(*args, **kwargs)
        
    async def generate_stream(self, *args, **kwargs):
        return self.active_engine.generate_stream(*args, **kwargs)
        
    async def generate_with_tools(self, *args, **kwargs):
        return await self.active_engine.generate_with_tools(*args, **kwargs)
        
    async def embeddings(self, *args, **kwargs):
        return await self.active_engine.embeddings(*args, **kwargs)
        
    async def close(self):
        await self.ollama.close()
        await self.gemini.close()

# Singleton instance
llm_engine = LLMEngine()
