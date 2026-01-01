"""
EVOS AI Configuration
"""
import os
from pathlib import Path
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Server settings
    host: str = "127.0.0.1"
    port: int = 8765
    
    # LLM settings
    ollama_host: str = "http://localhost:11434"
    default_model: str = "llama3.2:3b"
    fallback_model: str = "llama3.2:1b"
    
    # Online settings
    ai_mode: str = "online"  # Default to online as requested
    gemini_api_key: Optional[str] = None
    
    # Memory settings
    memory_db_path: str = str(Path.home() / ".evos" / "memory")
    max_memory_items: int = 10000
    embedding_model: str = "all-MiniLM-L6-v2"
    
    # Agent settings
    max_agent_steps: int = 10
    agent_timeout: int = 60
    
    # Paths
    data_dir: str = str(Path.home() / ".evos")
    
    class Config:
        env_prefix = "EVOS_"
        env_file = ".env"

settings = Settings()

# Ensure data directory exists
os.makedirs(settings.data_dir, exist_ok=True)
os.makedirs(settings.memory_db_path, exist_ok=True)
