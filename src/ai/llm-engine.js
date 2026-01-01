// EVOS Browser - LLM Engine
// Uses node-llama-cpp to run GGUF models locally

const path = require('path');
const { LLM_CONFIG, getModelPath, AGENT_CONFIG } = require('./config');

class LLMEngine {
  constructor() {
    this.llama = null;
    this.model = null;
    this.context = null;
    this.session = null;
    this.isLoaded = false;
    this.isLoading = false;
    this.loadError = null;
    this.onLoadProgress = null;
  }

  // Set progress callback for model loading
  setLoadProgressCallback(callback) {
    this.onLoadProgress = callback;
  }

  // Initialize the LLM engine
  async initialize() {
    if (this.isLoaded) return true;
    if (this.isLoading) {
      // Wait for existing load to complete
      while (this.isLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.isLoaded;
    }

    this.isLoading = true;
    this.loadError = null;

    try {
      // Dynamic import of node-llama-cpp (ES module)
      console.log('[LLMEngine] Importing node-llama-cpp...');
      const { getLlama, LlamaChatSession } = await import('node-llama-cpp');
      
      const modelPath = getModelPath();
      console.log('[LLMEngine] Loading model from:', modelPath);
      
      // Emit progress callback if provided
      if (this.onLoadProgress) {
        this.onLoadProgress({ stage: 'init', message: 'Initializing AI engine...' });
      }
      
      // Get llama instance
      console.log('[LLMEngine] Getting Llama instance...');
      this.llama = await getLlama();
      
      if (this.onLoadProgress) {
        this.onLoadProgress({ stage: 'loading', message: 'Loading AI model into memory... (this may take a few minutes)' });
      }
      
      // Load the model
      console.log('[LLMEngine] Loading model file...');
      this.model = await this.llama.loadModel({
        modelPath: modelPath,
        gpuLayers: LLM_CONFIG.gpuLayers
      });
      console.log('[LLMEngine] Model file loaded');

      if (this.onLoadProgress) {
        this.onLoadProgress({ stage: 'context', message: 'Creating AI context...' });
      }
      
      // Create context
      console.log('[LLMEngine] Creating context...');
      this.context = await this.model.createContext({
        contextSize: LLM_CONFIG.contextSize,
        batchSize: LLM_CONFIG.batchSize,
        threads: LLM_CONFIG.threads
      });
      console.log('[LLMEngine] Context created');

      // Create chat session
      console.log('[LLMEngine] Creating chat session...');
      this.session = new LlamaChatSession({
        contextSequence: this.context.getSequence()
      });

      this.isLoaded = true;
      console.log('[LLMEngine] Model loaded successfully');
      return true;

    } catch (error) {
      console.error('[LLMEngine] Failed to load model:', error);
      this.loadError = error.message;
      this.isLoaded = false;
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  // Generate a response
  async generate(prompt, options = {}) {
    if (!this.isLoaded) {
      throw new Error('Model not loaded. Call initialize() first.');
    }

    const config = {
      maxTokens: options.maxTokens || LLM_CONFIG.maxTokens,
      temperature: options.temperature || LLM_CONFIG.temperature,
      topP: options.topP || LLM_CONFIG.topP,
      topK: options.topK || LLM_CONFIG.topK,
      repeatPenalty: options.repeatPenalty || LLM_CONFIG.repeatPenalty
    };

    try {
      const response = await this.session.prompt(prompt, {
        maxTokens: config.maxTokens,
        temperature: config.temperature,
        topP: config.topP,
        topK: config.topK,
        repeatPenalty: {
          penalty: config.repeatPenalty
        }
      });

      return response;
    } catch (error) {
      console.error('[LLMEngine] Generation error:', error);
      throw error;
    }
  }

  // Generate with streaming
  async *generateStream(prompt, options = {}) {
    if (!this.isLoaded) {
      throw new Error('Model not loaded. Call initialize() first.');
    }

    const config = {
      maxTokens: options.maxTokens || LLM_CONFIG.maxTokens,
      temperature: options.temperature || LLM_CONFIG.temperature,
      topP: options.topP || LLM_CONFIG.topP,
      topK: options.topK || LLM_CONFIG.topK,
      repeatPenalty: options.repeatPenalty || LLM_CONFIG.repeatPenalty
    };

    try {
      const responseGenerator = this.session.promptWithMeta(prompt, {
        maxTokens: config.maxTokens,
        temperature: config.temperature,
        topP: config.topP,
        topK: config.topK,
        repeatPenalty: {
          penalty: config.repeatPenalty
        }
      });

      for await (const chunk of responseGenerator) {
        yield chunk.text;
      }
    } catch (error) {
      console.error('[LLMEngine] Stream generation error:', error);
      throw error;
    }
  }

  // Chat with system prompt
  async chat(messages, systemPrompt = null) {
    if (!this.isLoaded) {
      throw new Error('Model not loaded. Call initialize() first.');
    }

    // Build prompt from messages
    let prompt = '';
    
    if (systemPrompt) {
      prompt += `<|im_start|>system\n${systemPrompt}<|im_end|>\n`;
    }

    for (const msg of messages) {
      const role = msg.role === 'assistant' ? 'assistant' : 'user';
      prompt += `<|im_start|>${role}\n${msg.content}<|im_end|>\n`;
    }
    
    prompt += '<|im_start|>assistant\n';

    // Generate response
    const response = await this.generate(prompt, {
      maxTokens: LLM_CONFIG.maxTokens
    });

    // Clean up response (remove end tokens if present)
    let cleaned = response.replace(/<\|im_end\|>/g, '').trim();
    
    return cleaned;
  }

  // Reset conversation history
  resetSession() {
    if (this.session) {
      this.session.resetChatHistory();
    }
  }

  // Get model info
  getInfo() {
    return {
      isLoaded: this.isLoaded,
      isLoading: this.isLoading,
      error: this.loadError,
      config: LLM_CONFIG
    };
  }

  // Unload model and free memory
  async unload() {
    try {
      if (this.session) {
        this.session = null;
      }
      if (this.context) {
        await this.context.dispose();
        this.context = null;
      }
      if (this.model) {
        await this.model.dispose();
        this.model = null;
      }
      this.llama = null;
      this.isLoaded = false;
      console.log('[LLMEngine] Model unloaded');
    } catch (error) {
      console.error('[LLMEngine] Error unloading model:', error);
    }
  }
}

// Singleton instance
const llmEngine = new LLMEngine();

module.exports = { LLMEngine, llmEngine };
