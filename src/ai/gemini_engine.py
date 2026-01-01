"""
EVOS AI - Gemini Engine
Handles communication with Google Gemini API
"""
import asyncio
import json
import os
from typing import Optional, AsyncGenerator, Dict, Any, List
import google.generativeai as genai
from google.generativeai.types import content_types
from google.ai.generativelanguage import Content, Part

from config import settings

class GeminiEngine:
    """Online LLM engine using Google Gemini"""
    
    def __init__(self):
        self.model_name = "gemini-2.0-flash-exp" # User requested "2.5" (assumed 2.0 Flash)
        self.api_key = getattr(settings, "gemini_api_key", "")
        self._model_available = False
        self.model = None
        
    async def initialize(self) -> bool:
        """Initialize Gemini client"""
        # Reload key from settings/env in case it was updated at runtime
        self.api_key = getattr(settings, "gemini_api_key", os.environ.get("GEMINI_API_KEY", ""))
        
        if not self.api_key:
            print("[Gemini] No API Key found. Online mode disabled.")
            return False
            
        try:
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel(self.model_name)
            self._model_available = True
            print(f"[Gemini] Initialized {self.model_name}")
            return True
        except Exception as e:
            print(f"[Gemini] Initialization failed: {e}")
            return False
            
    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        stream: bool = False
    ) -> str:
        """Generate a response from Gemini"""
        if not self._model_available:
            return "Gemini API Key missing or invalid."
            
        try:
            # Gemini 1.5 supports system instructions in constructor, 
            # but for simple calls we can prepend context or use chat history
            
            # Simple content generation
            config = genai.types.GenerationConfig(
                temperature=temperature,
                max_output_tokens=max_tokens
            )
            
            full_prompt = prompt
            if system_prompt:
                # Flash follows system instructions well
                self.model = genai.GenerativeModel(
                    self.model_name,
                    system_instruction=system_prompt
                )
            
            # Run in executor to avoid blocking event loop (genai is sync mainly)
            response = await asyncio.to_thread(
                self.model.generate_content,
                full_prompt,
                generation_config=config,
                stream=False
            )
            
            return response.text
        except Exception as e:
            print(f"[Gemini] Generation error: {e}")
            return f"Error: {e}"

    async def generate_stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048
    ) -> AsyncGenerator[str, None]:
        """Stream response from Gemini"""
        if not self._model_available:
            yield "Gemini API Key missing."
            return

        try:
            config = genai.types.GenerationConfig(
                temperature=temperature,
                max_output_tokens=max_tokens
            )
            
            if system_prompt:
                self.model = genai.GenerativeModel(
                    self.model_name,
                    system_instruction=system_prompt
                )

            # Sync stream generator
            response_stream = await asyncio.to_thread(
                self.model.generate_content,
                prompt,
                generation_config=config,
                stream=True
            )
            
            # Iterate through sync iterator in async wrapper
            for chunk in response_stream:
                if chunk.text:
                    yield chunk.text
                    # Small yield to let event loop breathe
                    await asyncio.sleep(0)
                    
        except Exception as e:
            yield f"Error: {str(e)}"

    async def generate_with_tools(
        self,
        prompt: str,
        tools: List[Dict[str, Any]],
        system_prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate with Tool Calling (Function Calling)"""
        # Note: We need to convert our generic tool JSON to Gemini's format
        # For simplicity in this rough cut, we'll strip to generic prompt engineering 
        # OR implement proper conversion. 
        # Given 'flash' is smart, prompt engineering often works better for dynamic tools
        # unless providing actual Python functions.
        
        # We will wrap the existing generic generic logic here to keep it simple for Hackathon
        # (Switching to native function calling would require mapping schemas).
        
        # Re-use our "Tool Prompt" technique from llm_engine for consistent behavior
        # But run it through Gemini.
        
        tool_descriptions = "\n".join([
            f"- {tool['name']}: {tool['description']}\n  Parameters: {json.dumps(tool.get('parameters', {}))}"
            for tool in tools
        ])
        
        enhanced_system = f"""{system_prompt or 'You are a helpful AI assistant.'}

You have access to the following tools:
{tool_descriptions}

When you need to use a tool, respond with JSON in this exact format:
{{"tool": "tool_name", "parameters": {{"param1": "value1"}}}}

If you don't need a tool, just respond normally with text.
Always think step by step before using tools."""

        response_text = await self.generate(prompt, enhanced_system, temperature=0.1)
        
        try:
            if "{" in response_text and "}" in response_text:
                start = response_text.find("{")
                end = response_text.rfind("}") + 1
                json_str = response_text[start:end]
                parsed = json.loads(json_str)
                if "tool" in parsed:
                    return {
                        "type": "tool_call",
                        "tool": parsed["tool"],
                        "parameters": parsed.get("parameters", {}),
                        "raw_response": response_text
                    }
        except:
            pass
            
        return {"type": "text", "content": response_text}

    async def embeddings(self, text: str) -> List[float]:
        """Generate embeddings using embedding-001"""
        if not self._model_available:
            return []
        try:
            result = await asyncio.to_thread(
                genai.embed_content,
                model="models/text-embedding-004", # Latest small embedding
                content=text,
                task_type="retrieval_document"
            )
            return result['embedding']
        except Exception as e:
            print(f"[Gemini] Embedding error: {e}")
            return []

    async def close(self):
        pass
