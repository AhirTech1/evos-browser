// EVOS Browser AI Configuration
const path = require('path');
const os = require('os');
const fs = require('fs');

// Get app data directory
const getAppDataPath = () => {
  const platform = os.platform();
  if (platform === 'win32') {
    return path.join(process.env.APPDATA || '', 'evos-browser');
  } else if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'evos-browser');
  } else {
    return path.join(os.homedir(), '.evos-browser');
  }
};

const APP_DATA_PATH = getAppDataPath();
const MODELS_PATH = path.join(APP_DATA_PATH, 'models');
const MEMORY_PATH = path.join(APP_DATA_PATH, 'memory');

// Ensure directories exist
const ensureDirectories = () => {
  [APP_DATA_PATH, MODELS_PATH, MEMORY_PATH].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

// Model configuration
const MODEL_CONFIG = {
  // Qwen2.5-3B-Instruct Q4_K_M - Great balance of size and capability
  name: 'qwen2.5-3b-instruct-q4_k_m',
  filename: 'qwen2.5-3b-instruct-q4_k_m.gguf',
  size: 2080000000, // ~2.08GB (actual HuggingFace file size)
  downloadUrl: 'https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf',
  
  // Fallback smaller model
  fallback: {
    name: 'qwen2.5-1.5b-instruct-q4_k_m',
    filename: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
    size: 1100000000, // ~1.1GB
    downloadUrl: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf'
  }
};

// LLM inference settings
const LLM_CONFIG = {
  contextSize: 4096,
  batchSize: 512,
  threads: Math.max(1, os.cpus().length - 2), // Leave 2 cores for system
  gpuLayers: 0, // Start with CPU, can enable GPU later
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  repeatPenalty: 1.1,
  maxTokens: 1024
};

// Agent settings
const AGENT_CONFIG = {
  maxSteps: 10,
  maxRetries: 3,
  thinkingTimeout: 30000, // 30 seconds
  actionTimeout: 10000   // 10 seconds per action
};

// Memory settings
const MEMORY_CONFIG = {
  maxMemories: 10000,
  similarityThreshold: 0.7,
  embeddingDimension: 384, // For small embedding model
  consolidationInterval: 3600000 // 1 hour
};

module.exports = {
  APP_DATA_PATH,
  MODELS_PATH,
  MEMORY_PATH,
  MODEL_CONFIG,
  LLM_CONFIG,
  AGENT_CONFIG,
  MEMORY_CONFIG,
  ensureDirectories,
  getModelPath: () => path.join(MODELS_PATH, MODEL_CONFIG.filename)
};
