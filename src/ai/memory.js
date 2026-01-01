// EVOS Browser - AI Memory System
// Simple vector-based memory using local embeddings

const fs = require('fs');
const path = require('path');
const { MEMORY_PATH, MEMORY_CONFIG, ensureDirectories } = require('./config');

class AIMemory {
  constructor() {
    this.memories = [];
    this.memoryFile = path.join(MEMORY_PATH, 'memories.json');
    this.embeddingModel = null;
    this.isInitialized = false;
    ensureDirectories();
  }

  // Initialize memory system
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Load existing memories
      await this.loadMemories();
      
      this.isInitialized = true;
      console.log(`[Memory] Initialized with ${this.memories.length} memories`);
    } catch (error) {
      console.error('[Memory] Initialization error:', error);
    }
  }

  // Load memories from disk
  async loadMemories() {
    try {
      if (fs.existsSync(this.memoryFile)) {
        const data = fs.readFileSync(this.memoryFile, 'utf-8');
        this.memories = JSON.parse(data);
      }
    } catch (error) {
      console.error('[Memory] Failed to load memories:', error);
      this.memories = [];
    }
  }

  // Save memories to disk
  async saveMemories() {
    try {
      ensureDirectories();
      fs.writeFileSync(this.memoryFile, JSON.stringify(this.memories, null, 2));
    } catch (error) {
      console.error('[Memory] Failed to save memories:', error);
    }
  }

  // Simple text similarity using word overlap (TF-IDF like)
  calculateSimilarity(text1, text2) {
    const tokenize = (text) => {
      return text.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 2);
    };

    const words1 = new Set(tokenize(text1));
    const words2 = new Set(tokenize(text2));
    
    if (words1.size === 0 || words2.size === 0) return 0;

    const intersection = [...words1].filter(w => words2.has(w));
    const union = new Set([...words1, ...words2]);
    
    // Jaccard similarity
    return intersection.length / union.size;
  }

  // Add a memory
  async addMemory(content, metadata = {}) {
    const memory = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      content: content,
      metadata: {
        ...metadata,
        timestamp: Date.now(),
        date: new Date().toISOString()
      }
    };

    // Check for duplicates (similar content)
    const isDuplicate = this.memories.some(m => 
      this.calculateSimilarity(m.content, content) > 0.8
    );

    if (!isDuplicate) {
      this.memories.push(memory);
      
      // Limit memory count
      if (this.memories.length > MEMORY_CONFIG.maxMemories) {
        // Remove oldest memories
        this.memories = this.memories.slice(-MEMORY_CONFIG.maxMemories);
      }
      
      await this.saveMemories();
      console.log('[Memory] Added new memory:', memory.id);
      return memory;
    } else {
      console.log('[Memory] Skipped duplicate memory');
      return null;
    }
  }

  // Search memories by similarity
  async search(query, limit = 5) {
    if (this.memories.length === 0) return [];

    // Calculate similarity scores
    const scored = this.memories.map(memory => ({
      memory,
      score: this.calculateSimilarity(query, memory.content)
    }));

    // Sort by score and filter
    const results = scored
      .filter(item => item.score >= MEMORY_CONFIG.similarityThreshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => ({
        ...item.memory,
        relevanceScore: item.score
      }));

    return results;
  }

  // Full-text search
  async fullTextSearch(query, limit = 10) {
    const queryLower = query.toLowerCase();
    
    const results = this.memories
      .filter(m => m.content.toLowerCase().includes(queryLower))
      .slice(0, limit);
    
    return results;
  }

  // Get recent memories
  async getRecent(limit = 10) {
    return this.memories
      .sort((a, b) => b.metadata.timestamp - a.metadata.timestamp)
      .slice(0, limit);
  }

  // Get memories by type/tag
  async getByType(type, limit = 10) {
    return this.memories
      .filter(m => m.metadata.type === type)
      .slice(0, limit);
  }

  // Get memory by ID
  async getById(id) {
    return this.memories.find(m => m.id === id);
  }

  // Delete a memory
  async deleteMemory(id) {
    const index = this.memories.findIndex(m => m.id === id);
    if (index !== -1) {
      this.memories.splice(index, 1);
      await this.saveMemories();
      return true;
    }
    return false;
  }

  // Clear all memories
  async clearAll() {
    this.memories = [];
    await this.saveMemories();
  }

  // Get memory stats
  getStats() {
    const types = {};
    this.memories.forEach(m => {
      const type = m.metadata.type || 'unknown';
      types[type] = (types[type] || 0) + 1;
    });

    return {
      totalMemories: this.memories.length,
      byType: types,
      oldestMemory: this.memories[0]?.metadata.date,
      newestMemory: this.memories[this.memories.length - 1]?.metadata.date
    };
  }

  // Remember a browsing context
  async rememberPage(pageInfo) {
    const content = `
      Visited page: ${pageInfo.title}
      URL: ${pageInfo.url}
      ${pageInfo.description ? `Description: ${pageInfo.description}` : ''}
      ${pageInfo.summary ? `Summary: ${pageInfo.summary}` : ''}
    `.trim();

    return await this.addMemory(content, {
      type: 'page_visit',
      url: pageInfo.url,
      title: pageInfo.title
    });
  }

  // Remember a user interaction
  async rememberInteraction(action, result) {
    const content = `
      User action: ${action}
      Result: ${result}
    `.trim();

    return await this.addMemory(content, {
      type: 'interaction',
      action: action
    });
  }

  // Remember a fact or piece of information
  async rememberFact(fact, source = null) {
    return await this.addMemory(fact, {
      type: 'fact',
      source: source
    });
  }

  // Get context for the AI (combines recent + relevant memories)
  async getContext(currentQuery, maxTokens = 1000) {
    let context = '';
    
    // Get relevant memories
    const relevant = await this.search(currentQuery, 3);
    
    // Get recent memories
    const recent = await this.getRecent(3);
    
    // Combine and deduplicate
    const combined = new Map();
    [...relevant, ...recent].forEach(m => {
      if (!combined.has(m.id)) {
        combined.set(m.id, m);
      }
    });
    
    // Build context string
    const memories = Array.from(combined.values());
    
    if (memories.length > 0) {
      context = 'Relevant memories:\n';
      for (const memory of memories) {
        const memoryText = `- ${memory.content}\n`;
        if ((context + memoryText).length < maxTokens) {
          context += memoryText;
        }
      }
    }
    
    return context;
  }
}

// Singleton instance
const aiMemory = new AIMemory();

module.exports = { AIMemory, aiMemory };
