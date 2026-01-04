/**
 * EVOS Quick Action Bar
 * Spotlight-style AI command bar with natural language processing
 * Open with Ctrl+Shift+Space
 */

class QuickActionBar {
    constructor() {
        this.isOpen = false;
        this.selectedIndex = 0;
        this.items = [];
        this.recentCommands = [];
        this.isExecuting = false;

        this.defaultActions = [
            {
                id: 'summarize',
                icon: '📝',
                iconClass: 'ai',
                title: 'Summarize this page',
                description: 'Get a quick summary of the current page content',
                action: 'summarize',
                keywords: ['summarize', 'summary', 'tldr', 'brief', 'overview']
            },
            {
                id: 'search',
                icon: '🔍',
                iconClass: 'search',
                title: 'Search the web',
                description: 'Search for anything using AI-powered search',
                action: 'search',
                keywords: ['search', 'find', 'look up', 'google', 'query']
            },
            {
                id: 'extract',
                icon: '📋',
                iconClass: 'task',
                title: 'Extract data from page',
                description: 'Extract structured data like prices, emails, links',
                action: 'extract',
                keywords: ['extract', 'get', 'collect', 'scrape', 'data']
            },
            {
                id: 'compare',
                icon: '⚖️',
                iconClass: 'research',
                title: 'Compare open tabs',
                description: 'Compare content across multiple open tabs',
                action: 'compare',
                keywords: ['compare', 'versus', 'vs', 'difference', 'comparison']
            },
            {
                id: 'fill-form',
                icon: '✏️',
                iconClass: 'navigate',
                title: 'Auto-fill forms',
                description: 'Intelligently fill forms on this page',
                action: 'fill-form',
                keywords: ['fill', 'form', 'autofill', 'complete', 'input']
            },
            {
                id: 'record-macro',
                icon: '🔴',
                iconClass: 'macro',
                title: 'Record a macro',
                description: 'Start recording browser actions for automation',
                action: 'record-macro',
                keywords: ['record', 'macro', 'automate', 'actions', 'replay']
            },
            {
                id: 'ask-ai',
                icon: '🤖',
                iconClass: 'ai',
                title: 'Ask AI anything',
                description: 'Chat with AI about any topic',
                action: 'ask-ai',
                keywords: ['ask', 'ai', 'chat', 'question', 'help']
            },
            {
                id: 'navigate',
                icon: '🌐',
                iconClass: 'navigate',
                title: 'Navigate to...',
                description: 'Go to any website or search',
                action: 'navigate',
                keywords: ['go to', 'navigate', 'open', 'visit', 'url']
            },
            {
                id: 'research',
                icon: '📚',
                iconClass: 'research',
                title: 'Deep research',
                description: 'Research a topic across multiple sources',
                action: 'research',
                keywords: ['research', 'study', 'investigate', 'learn', 'deep dive']
            },
            {
                id: 'remember',
                icon: '💾',
                iconClass: 'task',
                title: 'Remember this page',
                description: 'Save this page to AI memory for later recall',
                action: 'remember',
                keywords: ['remember', 'save', 'bookmark', 'memory', 'store']
            }
        ];

        this.loadRecentCommands();
        this.createUI();
        this.attachEventListeners();
    }

    loadRecentCommands() {
        try {
            const saved = localStorage.getItem('evos-quick-commands');
            this.recentCommands = saved ? JSON.parse(saved) : [];
        } catch (e) {
            this.recentCommands = [];
        }
    }

    saveRecentCommand(command) {
        // Remove if exists, add to front
        this.recentCommands = this.recentCommands.filter(c => c !== command);
        this.recentCommands.unshift(command);
        // Keep only last 10
        this.recentCommands = this.recentCommands.slice(0, 10);
        localStorage.setItem('evos-quick-commands', JSON.stringify(this.recentCommands));
    }

    createUI() {
        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'quick-action-overlay';
        this.overlay.innerHTML = `
      <div class="quick-action-bar">
        <div class="quick-action-input-wrapper">
          <div class="quick-action-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path>
            </svg>
          </div>
          <input type="text" class="quick-action-input" placeholder="What would you like to do?" autofocus>
          <div class="quick-action-shortcut">
            <kbd>Esc</kbd>
          </div>
        </div>
        <div class="quick-action-results"></div>
        <div class="quick-action-footer">
          <div class="quick-action-footer-hint">
            <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
            <span><kbd>Enter</kbd> Execute</span>
            <span><kbd>Tab</kbd> Autocomplete</span>
          </div>
          <div class="quick-action-branding">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
            </svg>
            <span>EVOS AI</span>
          </div>
        </div>
      </div>
    `;

        document.body.appendChild(this.overlay);

        this.input = this.overlay.querySelector('.quick-action-input');
        this.resultsContainer = this.overlay.querySelector('.quick-action-results');
        this.bar = this.overlay.querySelector('.quick-action-bar');
    }

    attachEventListeners() {
        // Global keyboard shortcut
        document.addEventListener('keydown', (e) => {
            // Ctrl+Shift+Space to open
            if (e.ctrlKey && e.shiftKey && e.code === 'Space') {
                e.preventDefault();
                this.toggle();
                return;
            }

            // Escape to close
            if (e.key === 'Escape' && this.isOpen) {
                e.preventDefault();
                this.close();
                return;
            }
        });

        // Click outside to close
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.close();
            }
        });

        // Input handling
        this.input.addEventListener('input', () => this.onInput());
        this.input.addEventListener('keydown', (e) => this.onKeydown(e));
    }

    onInput() {
        const query = this.input.value.trim();
        this.filterActions(query);
    }

    onKeydown(e) {
        const items = this.resultsContainer.querySelectorAll('.quick-action-item');

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.selectedIndex = Math.min(this.selectedIndex + 1, items.length - 1);
                this.updateSelection();
                break;

            case 'ArrowUp':
                e.preventDefault();
                this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
                this.updateSelection();
                break;

            case 'Enter':
                e.preventDefault();
                this.executeSelected();
                break;

            case 'Tab':
                e.preventDefault();
                this.autocomplete();
                break;
        }
    }

    updateSelection() {
        const items = this.resultsContainer.querySelectorAll('.quick-action-item');
        items.forEach((item, i) => {
            item.classList.toggle('selected', i === this.selectedIndex);
        });

        // Scroll into view
        if (items[this.selectedIndex]) {
            items[this.selectedIndex].scrollIntoView({ block: 'nearest' });
        }
    }

    filterActions(query) {
        this.selectedIndex = 0;

        if (!query) {
            // Show recent commands and default actions
            this.showDefaultActions();
            return;
        }

        const lowerQuery = query.toLowerCase();

        // Check if this is a natural language command
        if (this.looksLikeCommand(query)) {
            this.showCommandMode(query);
            return;
        }

        // Filter default actions
        const filtered = this.defaultActions.filter(action => {
            const matchTitle = action.title.toLowerCase().includes(lowerQuery);
            const matchDesc = action.description.toLowerCase().includes(lowerQuery);
            const matchKeywords = action.keywords.some(k => k.includes(lowerQuery) || lowerQuery.includes(k));
            return matchTitle || matchDesc || matchKeywords;
        });

        this.items = filtered;
        this.renderItems(filtered);
    }

    looksLikeCommand(query) {
        // Detect natural language commands
        const commandPatterns = [
            /^(search|find|look up|google)\s+/i,
            /^(go to|navigate to|open|visit)\s+/i,
            /^(summarize|explain|tell me about)\s+/i,
            /^(book|order|buy|purchase)\s+/i,
            /^(compare|versus|vs)\s+/i,
            /^(fill|complete|submit)\s+/i,
            /^(download|save|export)\s+/i,
            /^(what|how|why|when|where|who)\s+/i,
        ];

        return commandPatterns.some(p => p.test(query));
    }

    showCommandMode(query) {
        this.resultsContainer.innerHTML = `
      <div class="quick-action-section">
        <h4 class="quick-action-section-title">AI Command</h4>
      </div>
      <div class="quick-action-item selected" data-action="execute-command" data-command="${this.escapeHtml(query)}">
        <div class="quick-action-item-icon ai">🚀</div>
        <div class="quick-action-item-content">
          <p class="quick-action-item-title">Execute: "${query}"</p>
          <p class="quick-action-item-description">AI will perform this task for you</p>
        </div>
        <span class="quick-action-item-action">Enter ↵</span>
      </div>
    `;

        this.items = [{ action: 'execute-command', command: query }];
        this.attachItemListeners();
    }

    showDefaultActions() {
        let html = '';

        // Recent commands
        if (this.recentCommands.length > 0) {
            html += `
        <div class="quick-action-section">
          <h4 class="quick-action-section-title">Recent</h4>
        </div>
      `;
            this.recentCommands.slice(0, 3).forEach((cmd, i) => {
                html += `
          <div class="quick-action-item${i === 0 ? ' selected' : ''}" data-action="execute-command" data-command="${this.escapeHtml(cmd)}">
            <div class="quick-action-item-icon ai">🕐</div>
            <div class="quick-action-item-content">
              <p class="quick-action-item-title">${this.escapeHtml(cmd)}</p>
              <p class="quick-action-item-description">Recent command</p>
            </div>
          </div>
        `;
            });
        }

        // Default actions
        html += `
      <div class="quick-action-section">
        <h4 class="quick-action-section-title">Quick Actions</h4>
      </div>
    `;

        const startIndex = this.recentCommands.length > 0 ? this.recentCommands.slice(0, 3).length : 0;
        this.defaultActions.forEach((action, i) => {
            const isSelected = startIndex === 0 && i === 0;
            html += this.renderActionItem(action, isSelected);
        });

        this.resultsContainer.innerHTML = html;
        this.items = [...this.recentCommands.slice(0, 3).map(c => ({ action: 'execute-command', command: c })), ...this.defaultActions];
        this.attachItemListeners();
    }

    renderItems(items) {
        if (items.length === 0) {
            this.resultsContainer.innerHTML = `
        <div class="quick-action-empty">
          <div class="quick-action-empty-icon">🔍</div>
          <p class="quick-action-empty-text">No matching actions. Try typing a command like "search for laptops"</p>
        </div>
      `;
            return;
        }

        let html = `
      <div class="quick-action-section">
        <h4 class="quick-action-section-title">Actions</h4>
      </div>
    `;

        items.forEach((action, i) => {
            html += this.renderActionItem(action, i === 0);
        });

        this.resultsContainer.innerHTML = html;
        this.attachItemListeners();
    }

    renderActionItem(action, isSelected = false) {
        return `
      <div class="quick-action-item${isSelected ? ' selected' : ''}" data-action="${action.action}" data-id="${action.id}">
        <div class="quick-action-item-icon ${action.iconClass}">${action.icon}</div>
        <div class="quick-action-item-content">
          <p class="quick-action-item-title">${action.title}</p>
          <p class="quick-action-item-description">${action.description}</p>
        </div>
        <span class="quick-action-item-action">Enter ↵</span>
      </div>
    `;
    }

    attachItemListeners() {
        const items = this.resultsContainer.querySelectorAll('.quick-action-item');
        items.forEach((item, i) => {
            item.addEventListener('click', () => {
                this.selectedIndex = i;
                this.updateSelection();
                this.executeSelected();
            });

            item.addEventListener('mouseenter', () => {
                this.selectedIndex = i;
                this.updateSelection();
            });
        });
    }

    autocomplete() {
        if (this.items.length > 0 && this.items[this.selectedIndex]) {
            const item = this.items[this.selectedIndex];
            if (item.title) {
                this.input.value = item.title;
            } else if (item.command) {
                this.input.value = item.command;
            }
        }
    }

    async executeSelected() {
        if (this.isExecuting) return;

        const selectedItem = this.resultsContainer.querySelector('.quick-action-item.selected');
        if (!selectedItem) return;

        const action = selectedItem.dataset.action;
        const command = selectedItem.dataset.command;
        const query = this.input.value.trim();

        this.isExecuting = true;
        selectedItem.classList.add('executing');

        // Show loading
        this.showLoading('Processing command...');

        try {
            // Save to recent if it's a command
            if (command || query) {
                this.saveRecentCommand(command || query);
            }

            await this.executeAction(action, command || query);
            this.close();
        } catch (error) {
            console.error('[QuickAction] Error:', error);
            this.showError(error.message);
        } finally {
            this.isExecuting = false;
        }
    }

    async executeAction(action, query = '') {
        switch (action) {
            case 'execute-command':
                await this.executeNaturalCommand(query);
                break;

            case 'summarize':
                this.triggerQuickAction('summarize');
                break;

            case 'search':
                if (query && query !== 'Search the web') {
                    await this.executeNaturalCommand(`search for ${query}`);
                } else {
                    this.openAiPanelWithMessage('What would you like me to search for?');
                }
                break;

            case 'extract':
                this.triggerQuickAction('extract');
                break;

            case 'compare':
                if (window.researchModePanel) {
                    window.researchModePanel.open();
                } else if (window.researchAgent) {
                    window.researchAgent.analyze();
                }
                break;

            case 'fill-form':
                if (window.formAgent) {
                    window.formAgent.analyze();
                }
                break;

            case 'record-macro':
                if (window.macroAgent) {
                    window.macroAgent.toggleRecording();
                }
                break;

            case 'ask-ai':
                this.openAiPanel();
                break;

            case 'navigate':
                if (query && query !== 'Navigate to...') {
                    await this.executeNaturalCommand(`go to ${query}`);
                }
                break;

            case 'research':
                if (window.researchModePanel) {
                    window.researchModePanel.open();
                } else if (window.researchAgent) {
                    window.researchAgent.analyze();
                }
                break;

            case 'remember':
                this.triggerQuickAction('remember');
                break;

            default:
                console.log(`[QuickAction] Unknown action: ${action}`);
        }
    }

    async executeNaturalCommand(command) {
        // Open AI panel and send the command
        if (window.aiPanel) {
            window.aiPanel.open();

            // Wait for panel to be ready
            await new Promise(r => setTimeout(r, 100));

            // Find the input and simulate sending
            const aiInput = document.getElementById('ai-input');
            if (aiInput) {
                aiInput.value = command;
                aiInput.dispatchEvent(new Event('input', { bubbles: true }));

                // Trigger send
                const sendBtn = document.getElementById('ai-send');
                if (sendBtn) {
                    sendBtn.click();
                }
            }
        }
    }

    triggerQuickAction(action) {
        if (window.aiPanel) {
            window.aiPanel.open();
            window.aiPanel.handleQuickAction(action);
        }
    }

    openAiPanel() {
        if (window.aiPanel) {
            window.aiPanel.open();
        }
    }

    openAiPanelWithMessage(message) {
        if (window.aiPanel) {
            window.aiPanel.open();
            const aiInput = document.getElementById('ai-input');
            if (aiInput) {
                aiInput.focus();
                aiInput.placeholder = message;
            }
        }
    }

    showLoading(message) {
        this.resultsContainer.innerHTML = `
      <div class="quick-action-loading">
        <div class="quick-action-spinner"></div>
        <span class="quick-action-loading-text">${message}</span>
      </div>
    `;
    }

    showError(message) {
        this.resultsContainer.innerHTML = `
      <div class="quick-action-empty">
        <div class="quick-action-empty-icon">❌</div>
        <p class="quick-action-empty-text">${message}</p>
      </div>
    `;

        // Auto-close after showing error
        setTimeout(() => this.close(), 2000);
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        this.isOpen = true;
        this.overlay.classList.add('active');
        this.input.value = '';
        this.selectedIndex = 0;
        this.showDefaultActions();

        // Focus input after animation
        setTimeout(() => {
            this.input.focus();
        }, 100);
    }

    close() {
        this.isOpen = false;
        this.overlay.classList.remove('active');
        this.input.value = '';
        this.isExecuting = false;
    }

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

// Initialize
window.quickActionBar = new QuickActionBar();
