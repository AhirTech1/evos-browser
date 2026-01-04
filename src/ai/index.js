// EVOS Browser AI System - Main Entry Point
// Exports all AI components for use in the browser

const { LLMEngine, llmEngine } = require('./llm-engine');
const { AIAgent, aiAgent } = require('./agent');
const { BrowserTools, browserTools } = require('./tools');
const { AIMemory, aiMemory } = require('./memory');
const { ModelDownloader, modelDownloader } = require('./model-downloader');
const { KnowledgeGraph, knowledgeGraph } = require('./memory/knowledge-graph');
const config = require('./config');

module.exports = {
  // Classes
  LLMEngine,
  AIAgent,
  BrowserTools,
  AIMemory,
  ModelDownloader,
  KnowledgeGraph,

  // Singleton instances
  llmEngine,
  aiAgent,
  browserTools,
  aiMemory,
  modelDownloader,
  knowledgeGraph,

  // Configuration
  config
};
