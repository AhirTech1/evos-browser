// EVOS AI Panel - Browser Interface
// Connects to native node-llama-cpp AI backend via IPC

class AIPanel {
  constructor() {
    this.isOpen = false;
    this.isReady = false;
    this.isProcessing = false;
    this.isProcessingQuickAction = false;
    this.needsDownload = false;
    this.modelInfo = null;
    this.modelInfo = null;
    this.messages = [];
    this.mode = 'offline'; // 'offline' or 'online'


    this.panel = null;
    this.chatContainer = null;
    this.inputField = null;
    this.sendButton = null;
    this.statusIndicator = null;
    this.setupOverlay = null;

    this.initialize();
  }

  async initialize() {
    this.createPanel();
    this.attachEventListeners();
    this.setupAIListeners();
    // Check mode via IPC
    await this.checkModeStatus();
    await this.checkStatus();

    console.log('[AIPanel] Initialized');
  }

  async checkModeStatus() {
    if (!window.aiAPI) return;
    try {
      const data = await window.aiAPI.getMode();
      this.mode = data.mode || 'online';
      this.updateToggleState();
      console.log(`[AIPanel] Current mode: ${this.mode}`);
    } catch (e) {
      console.log('[AIPanel] Mode check failed:', e);
    }
  }

  updateToggleState() {
    this.panel?.querySelectorAll('.mode-btn').forEach(btn => {
      const isTarget = btn.dataset.mode === this.mode;
      btn.classList.toggle('active', isTarget);
    });
  }

  async switchAiMode(mode) {
    if (!window.aiAPI) return;

    this.updateStatus('loading', `Switching to ${mode}...`);
    try {
      const result = await window.aiAPI.switchMode(mode);

      if (result.success) {
        this.mode = result.mode;
        this.updateToggleState();
        this.updateStatus('ready', `Active: ${result.model}`);
        this.addMessage('assistant', `Switched to **${mode.toUpperCase()}** mode (${result.model}).`);
      } else {
        this.updateToggleState(); // Revert
        this.updateStatus('error', result.error || 'Switch failed');
        this.addMessage('error', result.error || 'Failed to switch mode.');
      }
    } catch (err) {
      console.error(err);
      this.updateToggleState();
      this.updateStatus('error', 'Switch error');
    }
  }

  setupAIListeners() {
    if (!window.aiAPI) return;

    // AI status updates
    window.aiAPI.onStatus((data) => {
      console.log('[AIPanel] Status update:', data);
      if (data.status === 'ready') {
        this.isReady = true;
        this.needsDownload = false;
        this.hideSetupOverlay();
        this.updateStatus('connected', 'AI Ready');
      } else if (data.status === 'loading') {
        this.updateStatus('processing', data.message || 'Loading...');
        // Update the setup overlay message if it's visible
        const setupMessage = document.getElementById('ai-setup-message');
        if (setupMessage && this.setupOverlay?.style.display !== 'none') {
          setupMessage.textContent = data.message || 'Loading AI model...';
        }
      } else if (data.status === 'error') {
        this.updateStatus('error', data.message || 'Error');
        // Show error in setup overlay if download failed
        const setupMessage = document.getElementById('ai-setup-message');
        if (setupMessage) {
          setupMessage.textContent = data.message || 'Error loading AI';
        }
      }
    });

    // Model needs download
    window.aiAPI.onNeedsSetup((data) => {
      console.log('[AIPanel] Needs setup:', data);
      this.needsDownload = true;
      this.showSetupOverlay(data);
    });

    // Download progress
    window.aiAPI.onDownloadProgress((data) => {
      this.updateDownloadProgress(data);
    });

    // Agent progress
    window.aiAPI.onAgentProgress((data) => {
      this.handleAgentProgress(data);
    });
  }

  createPanel() {
    const panelHTML = `
      <div class="ai-panel" id="ai-panel">
        <!-- Setup Overlay (for model download) -->
        <div class="ai-setup-overlay" id="ai-setup-overlay" style="display: none;">
          <button class="ai-setup-close-btn" id="ai-setup-close-btn" title="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
          <div class="ai-setup-content">
            <div class="ai-setup-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
              </svg>
            </div>
            <h3>AI Model Required</h3>
            <p id="ai-setup-message">EVOS AI needs to download a language model to work offline.</p>
            <div class="ai-setup-model-info">
              <span id="ai-setup-model-name">Qwen2.5-3B</span>
              <span id="ai-setup-model-size">~2.0 GB</span>
            </div>
            <div class="ai-download-progress" id="ai-download-progress" style="display: none;">
              <div class="ai-progress-bar">
                <div class="ai-progress-fill" id="ai-progress-fill" style="width: 0%"></div>
              </div>
              <div class="ai-progress-info">
                <span id="ai-progress-percent">0%</span>
                <span id="ai-progress-speed"></span>
                <span id="ai-progress-eta"></span>
              </div>
            </div>
            <div class="ai-setup-buttons">
              <button class="ai-setup-btn primary" id="ai-download-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                </svg>
                Download Model
              </button>
              <button class="ai-setup-btn secondary" id="ai-cancel-download-btn" style="display: none;">
                Cancel
              </button>
            </div>
            <p class="ai-setup-note">This is a one-time download. The AI runs completely offline after setup.</p>
          </div>
        </div>

        <!-- Compact Header -->
        <div class="ai-panel-header">
          <div class="ai-panel-title">
            <div class="ai-panel-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2a10 10 0 1 0 10 10H12V2z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </div>
            <div class="ai-panel-title-text">
              <h2>EVOS AI</h2>
              <div class="ai-panel-status offline" id="ai-status">
                <span class="status-dot"></span>
                <span id="ai-status-text">Initializing...</span>
              </div>
            </div>
          </div>
          <div class="ai-panel-actions">
            <!-- AI Mode Switcher -->
            <div class="ai-mode-switcher">
               <button class="mode-btn offline" data-mode="offline" title="Offline (Local)">💻</button>
               <button class="mode-btn online" data-mode="online" title="Online (Gemini)">☁️</button>
            </div>
          
            <button class="ai-panel-btn" id="ai-clear-btn" title="Clear chat">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
              </svg>
            </button>
            <button class="ai-panel-btn" id="ai-close-btn" title="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Tabs -->
        <div class="ai-tabs">
          <button class="ai-tab active" data-tab="chat">💬 Chat</button>
          <button class="ai-tab" data-tab="memory">📚 Memory</button>
          <button class="ai-tab" data-tab="tasks">⚡ Tasks</button>
        </div>

        <!-- Tab Content -->
        <div class="ai-tab-content">
          <!-- Chat Tab -->
          <div class="ai-tab-panel active" id="chat-panel">
            <!-- Quick Actions (inside chat tab) -->
            <div class="ai-quick-actions">
              <button class="ai-quick-btn" data-action="summarize" title="Summarize this page">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
                </svg>
                Summarize
              </button>
              <button class="ai-quick-btn" data-action="fill-form" title="Auto-fill forms on this page">
                📝 Fill Form
              </button>
              <button class="ai-quick-btn" data-action="research" title="Compare open tabs">
                🔬 Research
              </button>
              <button class="ai-quick-btn" data-action="organize" title="Organize your tabs">
                🗂️ Organize
              </button>
              <button class="ai-quick-btn" data-action="record" title="Record actions as macro">
                🎬 Record
              </button>
              <button class="ai-quick-btn" data-action="macros" title="View saved macros">
                ▶️ Macros
              </button>
              <button class="ai-quick-btn" data-action="agentic-search" title="AI-powered multi-tab search">
                🔎 Search
              </button>
            </div>
            
            <!-- Chat Messages -->
            <div class="ai-chat-container" id="ai-chat-container">
              <div class="ai-welcome-message">
                <div class="ai-welcome-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2a10 10 0 1 0 10 10H12V2z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </div>
                <h3>Hi! I'm EVOS AI</h3>
                <p>Your intelligent browser assistant. Try asking me to summarize a page or search for information.</p>
              </div>
            </div>
            
            <!-- Typing Indicator -->
            <div class="ai-typing" id="ai-typing" style="display: none;">
              <div class="ai-typing-dots">
                <span></span><span></span><span></span>
              </div>
              <span id="ai-typing-text">AI is thinking...</span>
            </div>
            
            <!-- Input Area -->
            <div class="ai-input-area">
              <textarea 
                class="ai-input" 
                id="ai-input" 
                placeholder="Ask EVOS AI anything..."
                rows="1"
              ></textarea>
              <button class="ai-send-btn" id="ai-send-btn" disabled>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Memory Tab -->
          <div class="ai-tab-panel" id="memory-panel">
            <div class="ai-memory-header">
              <h3>Saved Memories</h3>
              <p>Pages you've asked AI to remember</p>
            </div>
            <div class="ai-memory-search">
              <input type="text" id="memory-search-input" placeholder="Search memories..." />
              <button id="memory-search-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="M21 21l-4.35-4.35"/>
                </svg>
              </button>
            </div>
            <div class="ai-memory-list" id="ai-memory-list">
              <div class="ai-memory-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
                </svg>
                <p>No memories yet</p>
                <span>Click "Remember" on any page to save it</span>
              </div>
            </div>
          </div>

          <!-- Tasks Tab -->
          <div class="ai-tab-panel" id="tasks-panel">
            <div class="ai-tasks-header">
              <h3>Automation Tasks</h3>
              <button class="ai-new-task-btn" id="ai-new-task-btn">+ New Task</button>
            </div>
            <div class="ai-tasks-list" id="ai-tasks-list">
              <div class="ai-tasks-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
                <p>No automation tasks</p>
                <span>Create tasks to automate repetitive browsing</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // REMOVE EXISTING PANEL IF IT EXISTS (Fixes duplicate/zombie DOM issues)
    const existingPanel = document.getElementById('ai-panel');
    if (existingPanel) {
      existingPanel.remove();
    }

    // Insert panel into DOM
    document.body.insertAdjacentHTML('beforeend', panelHTML);

    // Get references
    this.panel = document.getElementById('ai-panel');
    this.chatContainer = document.getElementById('ai-chat-container');
    this.inputField = document.getElementById('ai-input');
    this.sendButton = document.getElementById('ai-send-btn');
    this.statusIndicator = document.getElementById('ai-status');
    this.setupOverlay = document.getElementById('ai-setup-overlay');
  }

  attachEventListeners() {
    if (!this.panel) return;

    // Close button
    this.panel.querySelector('#ai-close-btn')?.addEventListener('click', () => this.close());

    // Setup overlay close button
    this.panel.querySelector('#ai-setup-close-btn')?.addEventListener('click', () => this.close());

    // Mode Switcher
    this.panel.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        // Use currentTarget to get the button, not inner span if added
        const targetMode = e.currentTarget.dataset.mode;
        if (!targetMode || targetMode === this.mode) return;

        await this.switchAiMode(targetMode);
      });
    });

    // Clear button
    this.panel.querySelector('#ai-clear-btn')?.addEventListener('click', () => this.clearChat());

    // Download button
    this.panel.querySelector('#ai-download-btn')?.addEventListener('click', () => this.startDownload());
    this.panel.querySelector('#ai-cancel-download-btn')?.addEventListener('click', () => this.cancelDownload());

    // Send message
    this.sendButton?.addEventListener('click', () => this.sendMessage());

    // Input field
    this.inputField?.addEventListener('input', () => this.onInputChange());
    this.inputField?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Tabs
    this.panel.querySelectorAll('.ai-tab').forEach(tab => {
      tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
    });

    // Quick actions - prevent duplicate calls by stopping propagation
    // SCOPED TO THIS PANEL ONLY
    this.panel.querySelectorAll('.ai-quick-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const action = e.currentTarget.dataset.action;
        if (action && !this.isProcessingQuickAction) {
          this.handleQuickAction(action);
        }
      });
    });

    // Memory search
    this.panel.querySelector('#memory-search-btn')?.addEventListener('click', () => this.searchMemory());
    this.panel.querySelector('#memory-search-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.searchMemory();
    });

    // New task button
    this.panel.querySelector('#ai-new-task-btn')?.addEventListener('click', () => this.createNewTask());

    // Keyboard shortcut (Global listener is fine, need to check if we should remove old one? 
    // Usually document-level listeners persist. Ideally we'd remove them on destroy, but simpler to just keep one if possible.
    // Since we guard initialization, this should run once per page load ideally.)
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        this.toggle();
      }
    });

    // Handle memory links (delegated)
    this.panel.addEventListener('click', (e) => {
      const link = e.target.closest('.ai-memory-link');
      if (link) {
        e.preventDefault();
        const url = link.href;
        if (url && window.evosBrowser?.tabManager) {
          window.evosBrowser.tabManager.createTab(url);
          // Optional: close panel? No, let user decide.
        } else if (url) {
          // Fallback if tabManager not ready?
          console.warn('[AIPanel] TabManager not found');
        }
      }
    });
  }

  async checkStatus() {
    if (!window.aiAPI) {
      this.updateStatus('error', 'AI API not available');
      return;
    }

    try {
      const status = await window.aiAPI.getStatus();
      console.log('[AIPanel] Status:', status);

      if (status.isReady) {
        this.isReady = true;
        this.updateStatus('connected', 'AI Ready');
        this.updateModelBadge(status.modelName || 'Qwen2.5-3B');
      } else if (!status.isModelDownloaded) {
        this.needsDownload = true;
        this.showSetupOverlay({
          modelName: status.modelName || 'Qwen2.5-3B',
          modelSize: status.modelSize || 1940000000
        });
      } else {
        this.updateStatus('processing', 'Loading model...');
      }
    } catch (error) {
      console.error('[AIPanel] Status check error:', error);
      this.updateStatus('error', 'Connection error');
    }
  }

  updateStatus(type, text) {
    if (!this.statusIndicator) return;

    // Map 'connected' to 'online' for CSS consistency
    const statusClass = type === 'connected' ? 'online' : type;
    this.statusIndicator.className = `ai-panel-status ${statusClass}`;
    document.getElementById('ai-status-text').textContent = text;

    // Update send button state
    if (this.sendButton) {
      this.sendButton.disabled = !this.isReady || !this.inputField?.value.trim();
    }
  }

  updateModelBadge(name) {
    const modelName = document.getElementById('ai-model-name');
    const modelStatus = document.getElementById('ai-model-status');

    if (modelName) modelName.textContent = name;
    if (modelStatus) modelStatus.textContent = 'Local • Offline';
  }

  showSetupOverlay(data) {
    if (!this.setupOverlay) return;

    this.setupOverlay.style.display = 'flex';
    document.getElementById('ai-setup-model-name').textContent = data.modelName || 'Qwen2.5-3B';
    document.getElementById('ai-setup-model-size').textContent = this.formatBytes(data.modelSize || 1940000000);

    this.updateStatus('offline', 'Setup required');
  }

  hideSetupOverlay() {
    if (this.setupOverlay) {
      this.setupOverlay.style.display = 'none';
    }
  }

  async startDownload() {
    if (!window.aiAPI) return;

    const downloadBtn = document.getElementById('ai-download-btn');
    const cancelBtn = document.getElementById('ai-cancel-download-btn');
    const progressDiv = document.getElementById('ai-download-progress');

    downloadBtn.style.display = 'none';
    cancelBtn.style.display = 'block';
    progressDiv.style.display = 'block';

    document.getElementById('ai-setup-message').textContent = 'Downloading AI model... Please wait.';

    try {
      await window.aiAPI.downloadModel();
    } catch (error) {
      console.error('[AIPanel] Download error:', error);
      downloadBtn.style.display = 'block';
      cancelBtn.style.display = 'none';
      document.getElementById('ai-setup-message').textContent = `Download failed: ${error.message}. Please try again.`;
    }
  }

  async cancelDownload() {
    if (!window.aiAPI) return;

    await window.aiAPI.cancelDownload();

    const downloadBtn = document.getElementById('ai-download-btn');
    const cancelBtn = document.getElementById('ai-cancel-download-btn');
    const progressDiv = document.getElementById('ai-download-progress');

    downloadBtn.style.display = 'block';
    cancelBtn.style.display = 'none';
    progressDiv.style.display = 'none';

    document.getElementById('ai-setup-message').textContent = 'Download cancelled. Click to try again.';
  }

  updateDownloadProgress(data) {
    const fill = document.getElementById('ai-progress-fill');
    const percent = document.getElementById('ai-progress-percent');
    const speed = document.getElementById('ai-progress-speed');
    const eta = document.getElementById('ai-progress-eta');

    if (fill) fill.style.width = `${data.progress || 0}%`;
    if (percent) percent.textContent = `${Math.round(data.progress || 0)}%`;
    if (speed && data.speed) speed.textContent = `${this.formatBytes(data.speed)}/s`;
    if (eta && data.eta) eta.textContent = `ETA: ${data.eta}`;

    if (data.status === 'complete') {
      document.getElementById('ai-setup-message').textContent = 'Download complete! Loading AI...';
    }
  }

  onInputChange() {
    // Auto-resize textarea
    if (this.inputField) {
      this.inputField.style.height = 'auto';
      this.inputField.style.height = Math.min(this.inputField.scrollHeight, 120) + 'px';

      // Update send button state
      this.sendButton.disabled = !this.isReady || !this.inputField.value.trim();
    }
  }

  async sendMessage() {
    if (!this.isReady || !this.inputField?.value.trim()) return;

    const message = this.inputField.value.trim();
    this.inputField.value = '';
    this.inputField.style.height = 'auto';
    this.sendButton.disabled = true;

    // Add user message
    this.addMessage('user', message);

    // Show typing indicator
    this.showTyping('Understanding your request...');

    try {
      // Step 1: Detect intent - should we take action or just chat?
      const intent = await this.detectIntent(message);

      if (intent.action !== 'chat') {
        // Route to appropriate agent
        this.hideTyping();
        await this.executeAgentAction(intent, message);
      } else {
        // Regular chat - get page context and respond
        this.showTyping('Extracting page content...');
        const pageContext = await this.getPageContentAsync();
        this.showTyping('AI is thinking...');

        const result = await window.aiAPI.chat(message, pageContext);
        this.hideTyping();

        if (result.type === 'error') {
          this.addMessage('error', result.response);
        } else {
          this.addMessage('assistant', result.response);
        }
      }
    } catch (error) {
      this.hideTyping();
      this.addMessage('error', `Error: ${error.message}`);
    }

    this.sendButton.disabled = false;
  }

  /**
   * Detect user intent from message
   */
  async detectIntent(message) {
    const lowerMsg = message.toLowerCase();

    // Keyword-based intent detection (fast, works offline)
    const intents = {
      search: ['search for', 'find me', 'look up', 'search:', 'find:', 'look for', 'search about', 'find information on', 'google', 'search online'],
      fill_form: ['fill', 'autofill', 'fill the form', 'fill this form', 'complete the form', 'fill out'],
      organize: ['organize', 'group tabs', 'group my tabs', 'sort tabs', 'arrange tabs', 'categorize tabs'],
      research: ['compare', 'research', 'analyze tabs', 'compare tabs', 'synthesize', 'cross-tab'],
      summarize: ['summarize', 'summary', 'tldr', 'summarise', 'give me a summary', 'what is this page about'],
      record: ['record', 'start recording', 'record macro', 'record actions'],
      stop_record: ['stop recording', 'stop record', 'end recording']
    };

    // Check each intent
    for (const [action, keywords] of Object.entries(intents)) {
      if (keywords.some(kw => lowerMsg.includes(kw))) {
        return { action, confidence: 0.9, params: { query: message } };
      }
    }

    // Try AI-based intent detection for ambiguous cases
    if (window.aiAPI?.generateText) {
      try {
        const prompt = `Classify the user's intent. Respond with ONLY one word from: search, fill_form, organize, research, summarize, record, chat

User message: "${message}"

Rules:
- search: user wants to find/look up information online
- fill_form: user wants to autofill a form on the page
- organize: user wants to group/organize their browser tabs
- research: user wants to compare or analyze multiple tabs
- summarize: user wants a summary of the current page
- record: user wants to record actions
- chat: just a question or conversation (DEFAULT for any uncertainty)

Intent:`;

        const response = await window.aiAPI.generateText(prompt);
        const intent = response.trim().toLowerCase().replace(/[^a-z_]/g, '');

        if (['search', 'fill_form', 'organize', 'research', 'summarize', 'record'].includes(intent)) {
          return { action: intent, confidence: 0.7, params: { query: message } };
        }
      } catch (e) {
        console.log('[AIPanel] Intent detection AI failed, defaulting to chat');
      }
    }

    // Default to chat
    return { action: 'chat', confidence: 1.0 };
  }

  /**
   * Execute the detected agent action with agentic feel
   */
  async executeAgentAction(intent, originalMessage) {
    // Helper for realistic delays and thinking steps
    const think = async (message, delay = 800) => {
      this.showTyping(message);
      await new Promise(r => setTimeout(r, delay));
    };

    switch (intent.action) {
      case 'search':
        if (window.searchAgent) {
          const query = originalMessage
            .replace(/^(search for|find me|look up|search:|find:|look for|search about|find information on|google|search online)\s*/i, '')
            .trim();

          await think('🤔 Understanding what you need...', 600);
          await think('🔍 Analyzing your request...', 500);
          this.hideTyping();

          this.addMessage('assistant', `Got it! Let me search for **"${query}"** and open the best resources for you...`);

          await think('🌐 Detecting relevant categories...', 700);
          await think('📂 Selecting optimal sources...', 600);
          this.hideTyping();

          await window.searchAgent.search(query);

          this.addMessage('assistant', '✅ Done! I\'ve opened several tabs with the best results. Take a look!');
        } else {
          this.addMessage('error', 'Search agent not available');
        }
        break;

      case 'fill_form':
        if (window.formAgent) {
          await think('👀 Scanning page for forms...', 700);
          await think('📋 Analyzing form fields...', 600);
          this.hideTyping();

          this.addMessage('assistant', 'Found it! Let me fill this form using your profile data...');

          await think('✏️ Mapping fields to your data...', 800);
          this.hideTyping();

          await window.formAgent.fill();

          this.addMessage('assistant', '✅ Form filled! Please review the values before submitting.');
        } else {
          this.addMessage('error', 'Form agent not available');
        }
        break;

      case 'organize':
        if (window.tabAgent) {
          await think('📊 Counting your open tabs...', 500);
          await think('🧠 Reading tab contents...', 800);
          this.hideTyping();

          this.addMessage('assistant', 'Alright, I see your tabs. Let me analyze and group them intelligently...');

          await think('🤖 AI is categorizing tabs...', 1000);
          await think('🎨 Creating visual groups...', 600);
          this.hideTyping();

          await window.tabAgent.organize();

          this.addMessage('assistant', '✅ Done! Your tabs are now organized into groups. Check the tab bar!');
        } else {
          this.addMessage('error', 'Tab agent not available');
        }
        break;

      case 'research':
        if (window.researchAgent) {
          await think('📚 Collecting content from all tabs...', 800);
          await think('🔬 Extracting key information...', 700);
          this.hideTyping();

          this.addMessage('assistant', 'Interesting tabs you have open! Let me compare and synthesize the information...');

          await think('🤖 AI is analyzing patterns...', 1000);
          await think('📝 Generating comparison report...', 800);
          this.hideTyping();

          await window.researchAgent.compare();

          this.addMessage('assistant', '✅ Research complete! I\'ve created a detailed comparison for you.');
        } else {
          this.addMessage('error', 'Research agent not available');
        }
        break;

      case 'summarize':
        await think('📖 Reading the page content...', 700);
        await think('🧠 Processing information...', 800);
        this.hideTyping();

        this.addMessage('assistant', 'Let me digest this page and give you the key points...');

        try {
          await think('✨ Generating summary...', 600);
          const pageContext = await this.getPageContentAsync();
          const result = await window.aiAPI.chat('Provide a concise, well-structured summary of this page. Use bullet points for key points.', pageContext);
          this.hideTyping();
          this.addMessage('assistant', result.response);
        } catch (e) {
          this.hideTyping();
          this.addMessage('error', 'Failed to summarize page');
        }
        break;

      case 'record':
        if (window.macroAgent) {
          if (window.macroAgent.isRecording) {
            await think('⏹️ Stopping recording...', 500);
            this.hideTyping();
            this.addMessage('assistant', 'Recording stopped! Let me save your macro...');
            window.macroAgent.stopRecording();
          } else {
            await think('🎬 Preparing recorder...', 500);
            this.hideTyping();
            this.addMessage('assistant', '🎬 **Recording started!** I\'m now watching your actions. When you\'re done, just say "stop recording" or click the Record button again.');
            window.macroAgent.startRecording();
          }
        } else {
          this.addMessage('error', 'Macro agent not available');
        }
        break;

      case 'stop_record':
        if (window.macroAgent?.isRecording) {
          await think('⏹️ Finalizing recording...', 500);
          this.hideTyping();
          this.addMessage('assistant', 'Recording stopped! Let me save your macro...');
          window.macroAgent.stopRecording();
        }
        break;

      default:
        this.addMessage('assistant', 'Hmm, I understood you want me to do something, but I\'m not quite sure what. Could you be a bit more specific? Try saying things like "search for...", "fill this form", or "organize my tabs".');
    }
  }

  addMessage(role, content) {
    // Remove welcome message if present
    const welcome = this.chatContainer?.querySelector('.ai-welcome-message');
    if (welcome) welcome.remove();

    const messageHTML = `
      <div class="ai-message ${role}">
        <div class="ai-message-avatar">
          ${role === 'user' ? '👤' : role === 'error' ? '⚠️' : '🤖'}
        </div>
        <div class="ai-message-content">
          <div class="ai-message-text">${this.formatMessage(content)}</div>
        <div class="ai-message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      </div>
    `;

    this.chatContainer?.insertAdjacentHTML('beforeend', messageHTML);
    this.scrollToBottom();

    this.messages.push({ role, content, timestamp: Date.now() });
  }

  formatMessage(content) {
    // Basic markdown-like formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  showTyping(text = 'AI is thinking...') {
    const typing = document.getElementById('ai-typing');
    const typingText = document.getElementById('ai-typing-text');
    if (typing) typing.style.display = 'flex';
    if (typingText) typingText.textContent = text;
    this.scrollToBottom();
  }

  hideTyping() {
    const typing = document.getElementById('ai-typing');
    if (typing) typing.style.display = 'none';
  }

  scrollToBottom() {
    if (this.chatContainer) {
      this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }
  }

  clearChat() {
    if (this.chatContainer) {
      this.chatContainer.innerHTML = `
        <div class="ai-welcome-message">
          <div class="ai-welcome-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2a10 10 0 1 0 10 10H12V2z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </div>
          <h3>Hi! I'm EVOS AI</h3>
          <p>Your intelligent browser assistant. Try asking me to summarize a page or search for information.</p>
        </div>
      `;
    }
    this.messages = [];
    // Reset input placeholder
    if (this.inputField) {
      this.inputField.placeholder = 'Ask EVOS AI anything...';
    }
    window.aiAPI?.clearHistory();
  }

  switchTab(tabName) {
    if (!this.panel) return;

    // Update tab buttons
    this.panel.querySelectorAll('.ai-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tab panels
    this.panel.querySelectorAll('.ai-tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `${tabName}-panel`);
    });

    // Load content for memory/tasks tabs
    if (tabName === 'memory') this.loadMemories();
    if (tabName === 'tasks') this.loadTasks();
  }

  async handleQuickAction(action) {
    if (!this.isReady) {
      this.addMessage('error', 'AI is not ready. Please wait for the model to load.');
      return;
    }

    // Prevent duplicate execution
    if (this.isProcessingQuickAction) return;
    this.isProcessingQuickAction = true;

    // For search action, we don't need page content
    if (action === 'search') {
      this.inputField.focus();
      this.inputField.placeholder = 'What would you like me to search for?';
      return;
    }

    // Get page content asynchronously for all other actions
    this.showTyping('Extracting page content...');
    const pageContext = await this.getPageContentAsync();

    if (!pageContext.content && !pageContext.title) {
      this.hideTyping();
      this.addMessage('error', 'Could not extract page content. Please make sure a webpage is loaded.');
      return;
    }

    switch (action) {
      case 'summarize':
        this.addMessage('user', 'Summarize this page');
        this.showTyping('Analyzing page...');
        try {
          const result = await window.aiAPI.chat(
            `Please summarize the following web page content:\n\nTitle: ${pageContext.title}\nURL: ${pageContext.url}\n\nContent:\n${pageContext.content?.substring(0, 3000) || 'No content available'}`,
            pageContext
          );
          this.hideTyping();
          this.addMessage('assistant', result.response);
        } catch (error) {
          this.hideTyping();
          this.addMessage('error', error.message);
        }
        break;

      case 'remember':
        this.hideTyping();
        try {
          await window.aiAPI.rememberPage(
            pageContext.url,
            pageContext.title,
            pageContext.content?.substring(0, 5000),
            pageContext.description
          );
          this.addMessage('assistant', `✓ Remembered: "${pageContext.title || 'Untitled Page'}"`);
        } catch (error) {
          this.addMessage('error', `Failed to remember page: ${error.message}`);
        }
        break;

      case 'extract':
        this.addMessage('user', 'Extract key information from this page');
        this.showTyping('Extracting information...');
        try {
          const result = await window.aiAPI.chat(
            `Extract the key information, facts, and data from this page:\n\nTitle: ${pageContext.title}\n\nContent:\n${pageContext.content?.substring(0, 3000) || 'No content available'}`,
            pageContext
          );
          this.hideTyping();
          this.addMessage('assistant', result.response);
        } catch (error) {
          this.hideTyping();
          this.addMessage('error', error.message);
        }
        break;

      // Agent actions
      case 'fill-form':
        this.hideTyping();
        this.addMessage('user', 'Fill the form on this page');
        if (window.formAgent) {
          await window.formAgent.fill();
        } else {
          this.addMessage('error', 'Form agent not available');
        }
        break;

      case 'research':
        this.hideTyping();
        this.addMessage('user', 'Analyze and compare my open tabs');
        if (window.researchAgent) {
          await window.researchAgent.analyze();
        } else {
          this.addMessage('error', 'Research agent not available');
        }
        break;

      case 'organize':
        this.hideTyping();
        this.addMessage('user', 'Organize my tabs into groups');
        if (window.tabAgent) {
          await window.tabAgent.organize();
        } else {
          this.addMessage('error', 'Tab agent not available');
        }
        break;

      case 'record':
        this.hideTyping();
        if (window.macroAgent) {
          if (window.macroAgent.isRecording) {
            this.addMessage('user', 'Stop recording');
            window.macroAgent.stopRecording();
          } else {
            this.addMessage('user', 'Start recording my actions');
            window.macroAgent.startRecording();
          }
        } else {
          this.addMessage('error', 'Macro agent not available');
        }
        break;

      case 'macros':
        this.hideTyping();
        this.addMessage('user', 'Show my saved macros');
        if (window.macroAgent) {
          window.macroAgent.showMacrosList();
        } else {
          this.addMessage('error', 'Macro agent not available');
        }
        break;

      case 'agentic-search':
        this.hideTyping();
        if (window.searchAgent) {
          // Show input modal for search query
          window.agentManager.showModal('Agentic Search', `
            <p style="margin-bottom: 12px; color: rgba(255,255,255,0.7);">
              Describe what you're looking for and I'll open the best pages.
            </p>
            <input type="text" id="search-query-input" placeholder="e.g., React hooks tutorial for beginners"
                   style="width: 100%; padding: 12px; border-radius: 8px; background: rgba(0,0,0,0.3);
                          border: 1px solid rgba(255,255,255,0.2); color: #fff; font-size: 14px;">
            <div style="margin-top: 12px; display: flex; align-items: center; gap: 8px;">
              <label style="color: rgba(255,255,255,0.5); font-size: 12px;">Pages to open:</label>
              <select id="search-num-results" style="padding: 6px 10px; border-radius: 6px; 
                      background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2); 
                      color: #fff; font-size: 13px;">
                <option value="auto">Auto (AI decides)</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3" selected>3</option>
                <option value="4">4</option>
                <option value="5">5</option>
              </select>
            </div>
          `, [
            {
              id: 'search',
              label: '🔎 Search',
              primary: true,
              onClick: () => {
                const query = document.getElementById('search-query-input')?.value;
                const numSelect = document.getElementById('search-num-results')?.value;
                const numResults = numSelect === 'auto' ? null : parseInt(numSelect);
                if (query?.trim()) {
                  this.addMessage('user', `Search for: ${query}`);
                  window.searchAgent.search(query, numResults);
                }
              }
            },
            { id: 'cancel', label: 'Cancel' }
          ], { icon: '🔎' });

          setTimeout(() => document.getElementById('search-query-input')?.focus(), 100);
        } else {
          this.addMessage('error', 'Search agent not available');
        }
        break;
    }

    // Reset flag
    this.isProcessingQuickAction = false;
  }

  handleAgentProgress(data) {
    switch (data.type) {
      case 'thinking':
        this.showTyping(`Step ${data.step}: Thinking...`);
        break;
      case 'action':
        this.showTyping(`Step ${data.step}: ${data.action}...`);
        break;
      case 'observation':
        // Could show intermediate results
        break;
    }
  }

  async loadMemories() {
    if (!window.aiAPI || !this.panel) return;

    const memoryList = this.panel.querySelector('#ai-memory-list');
    if (!memoryList) return;

    try {
      // Try the new memory system first
      let result = await window.aiAPI.getRecent(20);
      let memories = result.results || [];

      // Fallback to legacy local storage if no results
      if (memories.length === 0) {
        try {
          const legacyMemories = await window.aiAPI.getMemories();
          if (legacyMemories && legacyMemories.length > 0) {
            memories = legacyMemories.slice(0, 20).map(m => ({
              id: m.id,
              content: m.content || m.summary || '',
              metadata: {
                title: m.title || 'Untitled',
                url: m.url,
                timestamp: m.timestamp || Date.now()
              }
            }));
          }
        } catch (legacyError) {
          console.log('[AIPanel] Legacy memory fallback failed:', legacyError);
        }
      }

      if (memories.length === 0) {
        memoryList.innerHTML = `
          <div class="ai-memory-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
            </svg>
            <p>No memories yet</p>
            <span>Use "Remember" to save pages</span>
          </div>
        `;
        return;
      }

      memoryList.innerHTML = memories.map(m => `
        <div class="ai-memory-card" data-id="${m.id}">
          <div class="ai-memory-header">
            <span class="ai-memory-title">${m.metadata?.title || m.title || 'Untitled'}</span>
            <button class="ai-memory-delete" data-id="${m.id}">×</button>
          </div>
          <div class="ai-memory-content">${(m.content || '').substring(0, 150)}${m.content?.length > 150 ? '...' : ''}</div>
          <div class="ai-memory-meta">
            <span>${new Date(m.metadata?.timestamp || m.timestamp || Date.now()).toLocaleDateString()} ${new Date(m.metadata?.timestamp || m.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            ${(m.metadata?.url || m.url) ? `<a href="${m.metadata?.url || m.url}" class="ai-memory-link">Visit</a>` : ''}
          </div>
        </div>
      `).join('');

      // Attach delete handlers
      memoryList.querySelectorAll('.ai-memory-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.deleteMemory(btn.dataset.id);
        });
      });
    } catch (error) {
      console.error('[AIPanel] Failed to load memories:', error);
      memoryList.innerHTML = `
        <div class="ai-memory-empty">
          <p>Error loading memories</p>
          <span>${error.message}</span>
        </div>
      `;
    }
  }

  async searchMemory() {
    const input = this.panel?.querySelector('#memory-search-input');
    if (!input?.value.trim() || !window.aiAPI) return;

    const memoryList = this.panel?.querySelector('#ai-memory-list');
    if (!memoryList) return;

    try {
      const result = await window.aiAPI.search(input.value.trim(), 10);
      const memories = result.results || [];

      if (memories.length === 0) {
        memoryList.innerHTML = `
          <div class="ai-memory-empty">
            <p>No results found</p>
            <span>Try different search terms</span>
          </div>
        `;
        return;
      }

      memoryList.innerHTML = memories.map(m => `
        <div class="ai-memory-card" data-id="${m.id}">
          <div class="ai-memory-header">
            <span class="ai-memory-title">${m.metadata?.title || 'Untitled'}</span>
            <span class="ai-memory-score">${Math.round((m.relevanceScore || 0) * 100)}% match</span>
          </div>
          <div class="ai-memory-content">${m.content?.substring(0, 150)}...</div>
        </div>
      `).join('');
    } catch (error) {
      console.error('[AIPanel] Memory search error:', error);
    }
  }

  async deleteMemory(id) {
    if (!window.aiAPI) return;

    try {
      await window.aiAPI.deleteMemory(id);
      this.loadMemories();
    } catch (error) {
      console.error('[AIPanel] Failed to delete memory:', error);
    }
  }

  async loadTasks() {
    // Tasks feature - placeholder for now
    const tasksList = document.getElementById('ai-tasks-list');
    if (!tasksList) return;

    tasksList.innerHTML = `
      <div class="ai-tasks-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 2"/>
        </svg>
        <p>No tasks yet</p>
        <span>Create tasks to automate browsing</span>
      </div>
    `;
  }

  createNewTask() {
    // Switch to chat tab first
    this.switchTab('chat');

    // Show a helpful message about task creation
    this.addMessage('assistant', '🤖 **Task Creation**\n\nDescribe what you want me to automate. For example:\n• "Check this page for updates every hour"\n• "Summarize new articles on this site daily"\n• "Alert me when the price drops below $100"\n\n_Note: Automation tasks are coming soon!_');

    // Focus input for user to type
    if (this.inputField) {
      this.inputField.placeholder = 'Describe the task you want to automate...';
      this.inputField.focus();
    }
  }

  getPageContext() {
    // Get context from current active webview
    const webview = document.querySelector('webview.active');

    if (!webview) {
      return { url: '', title: 'No page loaded', content: '' };
    }

    // Get basic info synchronously
    const context = {
      url: webview.src || '',
      title: '',
      content: '',
      description: ''
    };

    try {
      // Try to get title
      if (typeof webview.getTitle === 'function') {
        context.title = webview.getTitle();
      }
    } catch (e) {
      console.log('[AIPanel] Could not get webview title');
    }

    return context;
  }

  // Async method to get full page content
  async getPageContentAsync() {
    const webview = document.querySelector('webview.active');

    if (!webview) {
      return { url: '', title: 'No page loaded', content: '' };
    }

    try {
      // Execute script in webview to extract content
      const result = await webview.executeJavaScript(`
        (function() {
          // Get main content, avoiding scripts and styles
          const body = document.body.cloneNode(true);
          
          // Remove script, style, noscript tags
          body.querySelectorAll('script, style, noscript, iframe, svg').forEach(el => el.remove());
          
          // Get text content
          let text = body.innerText || body.textContent || '';
          
          // Clean up whitespace
          text = text.replace(/\\s+/g, ' ').trim();
          
          return {
            title: document.title,
            url: window.location.href,
            content: text.substring(0, 5000),
            description: document.querySelector('meta[name="description"]')?.content || ''
          };
        })()
      `);

      return result;
    } catch (error) {
      console.error('[AIPanel] Failed to extract page content:', error);
      return {
        url: webview.src || '',
        title: webview.getTitle ? webview.getTitle() : '',
        content: '',
        description: ''
      };
    }
  }

  formatBytes(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    this.panel?.classList.add('open');
    document.body.classList.add('ai-panel-open');
    document.getElementById('btn-ai')?.classList.add('active');
    this.isOpen = true;
    this.inputField?.focus();
  }

  close() {
    this.panel?.classList.remove('open');
    document.body.classList.remove('ai-panel-open');
    document.getElementById('btn-ai')?.classList.remove('active');
    this.isOpen = false;
  }
}

// Initialize when DOM is ready (with guard against duplicate initialization)
if (!window.aiPanel) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (!window.aiPanel) {
        window.aiPanel = new AIPanel();
      }
    });
  } else {
    window.aiPanel = new AIPanel();
  }
}
