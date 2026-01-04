/**
 * EVOS Proactive AI Assistant
 * Intelligently suggests actions based on current page context
 */

class ProactiveAgent {
    constructor() {
        this.isEnabled = true;
        this.lastUrl = '';
        this.lastSuggestion = null;
        this.dismissedSuggestions = new Set();
        this.cooldownMs = 30000; // Don't show same suggestion for 30s
        this.lastSuggestionTime = 0;

        this.patterns = [
            {
                id: 'shopping',
                match: (url, content) => {
                    const shoppingDomains = ['amazon', 'ebay', 'walmart', 'bestbuy', 'target', 'flipkart', 'alibaba'];
                    const hasPrice = /\$[\d,]+\.?\d*|\₹[\d,]+|price|add to cart/i.test(content);
                    const isShoppingSite = shoppingDomains.some(d => url.includes(d));
                    return (isShoppingSite || hasPrice) && /product|item|buy|price/i.test(content);
                },
                suggestions: [
                    { icon: '🔍', text: 'Find cheaper alternatives?', action: 'compare-prices' },
                    { icon: '📊', text: 'Compare with similar products?', action: 'compare-products' },
                    { icon: '🏷️', text: 'Check for coupon codes?', action: 'find-coupons' }
                ]
            },
            {
                id: 'article',
                match: (url, content) => {
                    const articleDomains = ['medium.com', 'dev.to', 'hackernews', 'techcrunch', 'reuters', 'bbc', 'cnn', 'nytimes', 'theguardian'];
                    const hasArticleStructure = content.length > 2000 && /<article|<p.*>/i.test(content);
                    const isArticleSite = articleDomains.some(d => url.includes(d));
                    return isArticleSite || hasArticleStructure;
                },
                suggestions: [
                    { icon: '📝', text: 'Summarize this article?', action: 'summarize' },
                    { icon: '💾', text: 'Save key points to memory?', action: 'remember' },
                    { icon: '🔊', text: 'Read aloud?', action: 'read-aloud' }
                ]
            },
            {
                id: 'form',
                match: (url, content) => {
                    const hasForm = /<form|<input|type="text"|type="email"|type="password"/i.test(content);
                    const hasManyInputs = (content.match(/<input/gi) || []).length >= 3;
                    return hasForm && hasManyInputs;
                },
                suggestions: [
                    { icon: '✏️', text: 'Auto-fill this form?', action: 'fill-form' },
                    { icon: '👤', text: 'Use saved profile?', action: 'use-profile' }
                ]
            },
            {
                id: 'search-results',
                match: (url, content) => {
                    const searchDomains = ['google.com/search', 'bing.com/search', 'duckduckgo.com'];
                    return searchDomains.some(d => url.includes(d));
                },
                suggestions: [
                    { icon: '📚', text: 'Research top results?', action: 'research-results' },
                    { icon: '📊', text: 'Compare top 3 options?', action: 'compare-results' }
                ]
            },
            {
                id: 'documentation',
                match: (url, content) => {
                    const docPatterns = ['docs.', 'documentation', '/api/', 'readme', 'github.com', 'developer.'];
                    const hasCodeBlocks = /<pre|<code|```/i.test(content);
                    return docPatterns.some(p => url.includes(p)) || hasCodeBlocks;
                },
                suggestions: [
                    { icon: '📝', text: 'Extract code examples?', action: 'extract-code' },
                    { icon: '💾', text: 'Save to reference?', action: 'remember' }
                ]
            },
            {
                id: 'video',
                match: (url, content) => {
                    const videoDomains = ['youtube.com/watch', 'vimeo.com', 'dailymotion.com'];
                    return videoDomains.some(d => url.includes(d));
                },
                suggestions: [
                    { icon: '📝', text: 'Get video summary?', action: 'summarize-video' },
                    { icon: '📋', text: 'Extract key timestamps?', action: 'extract-timestamps' }
                ]
            },
            {
                id: 'email',
                match: (url, content) => {
                    const emailDomains = ['mail.google.com', 'outlook.live.com', 'mail.yahoo.com'];
                    const isCompose = /compose|reply|forward|new message/i.test(content);
                    return emailDomains.some(d => url.includes(d)) && isCompose;
                },
                suggestions: [
                    { icon: '✨', text: 'Help write this email?', action: 'help-email' },
                    { icon: '🎯', text: 'Make it more professional?', action: 'improve-email' }
                ]
            },
            {
                id: 'social',
                match: (url, content) => {
                    const socialDomains = ['twitter.com', 'x.com', 'linkedin.com', 'facebook.com'];
                    return socialDomains.some(d => url.includes(d));
                },
                suggestions: [
                    { icon: '📊', text: 'Analyze trending topics?', action: 'analyze-trends' },
                    { icon: '✍️', text: 'Help craft a post?', action: 'help-post' }
                ]
            },
            {
                id: 'recipe',
                match: (url, content) => {
                    const recipePatterns = ['recipe', 'ingredients', 'cooking', 'bake', 'allrecipes', 'foodnetwork'];
                    const hasIngredients = /ingredients|cups?|tablespoons?|teaspoons?/i.test(content);
                    return recipePatterns.some(p => url.includes(p) || content.toLowerCase().includes(p)) || hasIngredients;
                },
                suggestions: [
                    { icon: '📋', text: 'Extract ingredient list?', action: 'extract-ingredients' },
                    { icon: '⏱️', text: 'Create cooking timer?', action: 'create-timer' }
                ]
            }
        ];

        this.createUI();
        this.setupObserver();
    }

    createUI() {
        // Floating suggestion container
        this.container = document.createElement('div');
        this.container.className = 'proactive-suggestion';
        this.container.innerHTML = `
      <div class="proactive-suggestion-content">
        <span class="proactive-icon">💡</span>
        <span class="proactive-text">AI suggestion here</span>
        <button class="proactive-action">Try it</button>
        <button class="proactive-dismiss">×</button>
      </div>
    `;

        document.body.appendChild(this.container);

        // Event listeners
        this.container.querySelector('.proactive-action').addEventListener('click', () => {
            if (this.lastSuggestion) {
                this.executeSuggestion(this.lastSuggestion);
            }
            this.hide();
        });

        this.container.querySelector('.proactive-dismiss').addEventListener('click', () => {
            if (this.lastSuggestion) {
                this.dismissedSuggestions.add(this.lastSuggestion.id);
            }
            this.hide();
        });

        // Inject styles
        this.injectStyles();
    }

    injectStyles() {
        if (document.getElementById('proactive-styles')) return;

        const style = document.createElement('style');
        style.id = 'proactive-styles';
        style.textContent = `
      .proactive-suggestion {
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%) translateY(20px);
        background: linear-gradient(135deg, rgba(99, 102, 241, 0.95), rgba(139, 92, 246, 0.95));
        border-radius: 14px;
        padding: 10px 16px;
        z-index: 9997;
        opacity: 0;
        visibility: hidden;
        transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 8px 32px rgba(99, 102, 241, 0.4);
        backdrop-filter: blur(10px);
      }
      
      .proactive-suggestion.active {
        opacity: 1;
        visibility: visible;
        transform: translateX(-50%) translateY(0);
      }
      
      .proactive-suggestion-content {
        display: flex;
        align-items: center;
        gap: 12px;
        color: white;
      }
      
      .proactive-icon {
        font-size: 18px;
      }
      
      .proactive-text {
        font-size: 14px;
        font-weight: 500;
      }
      
      .proactive-action {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        border-radius: 8px;
        color: white;
        padding: 8px 16px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .proactive-action:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: scale(1.02);
      }
      
      .proactive-dismiss {
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.7);
        font-size: 18px;
        cursor: pointer;
        padding: 4px 8px;
        transition: color 0.2s;
      }
      
      .proactive-dismiss:hover {
        color: white;
      }
    `;
        document.head.appendChild(style);
    }

    setupObserver() {
        // Watch for URL changes
        setInterval(() => {
            this.checkPage();
        }, 3000);
    }

    async checkPage() {
        if (!this.isEnabled) return;

        // Rate limit
        if (Date.now() - this.lastSuggestionTime < this.cooldownMs) return;

        // Get current page info
        const pageInfo = await this.getPageInfo();
        if (!pageInfo) return;

        const { url, content } = pageInfo;

        // Skip if same URL
        if (url === this.lastUrl) return;
        this.lastUrl = url;

        // Find matching pattern
        for (const pattern of this.patterns) {
            if (this.dismissedSuggestions.has(pattern.id)) continue;

            try {
                if (pattern.match(url, content)) {
                    // Pick a random suggestion from the pattern
                    const suggestion = pattern.suggestions[Math.floor(Math.random() * pattern.suggestions.length)];
                    this.showSuggestion({ ...suggestion, patternId: pattern.id });
                    break;
                }
            } catch (e) {
                // Pattern match failed, continue
            }
        }
    }

    async getPageInfo() {
        try {
            const webviews = document.querySelectorAll('webview');
            const activeWebview = Array.from(webviews).find(wv =>
                wv.style.display !== 'none' && wv.style.visibility !== 'hidden'
            );

            if (!activeWebview) return null;

            const url = activeWebview.getURL() || '';
            let content = '';

            try {
                content = await activeWebview.executeJavaScript(`
          document.documentElement.outerHTML.substring(0, 10000)
        `);
            } catch (e) {
                // Couldn't get content
            }

            return { url, content };
        } catch (e) {
            return null;
        }
    }

    showSuggestion(suggestion) {
        this.lastSuggestion = suggestion;
        this.lastSuggestionTime = Date.now();

        this.container.querySelector('.proactive-icon').textContent = suggestion.icon;
        this.container.querySelector('.proactive-text').textContent = suggestion.text;
        this.container.classList.add('active');

        // Auto-hide after 10 seconds
        setTimeout(() => this.hide(), 10000);
    }

    hide() {
        this.container.classList.remove('active');
    }

    async executeSuggestion(suggestion) {
        const { action } = suggestion;

        switch (action) {
            case 'summarize':
            case 'summarize-video':
                if (window.aiPanel) {
                    window.aiPanel.open();
                    window.aiPanel.handleQuickAction('summarize');
                }
                break;

            case 'remember':
                if (window.aiPanel) {
                    window.aiPanel.open();
                    window.aiPanel.handleQuickAction('remember');
                }
                break;

            case 'compare-prices':
            case 'compare-products':
            case 'compare-results':
                // Add to task queue
                if (window.taskQueue) {
                    window.taskQueue.addTask({
                        name: 'Compare alternatives',
                        command: 'Find and compare similar products or alternatives to what I\'m looking at',
                        type: 'ai',
                        priority: 'normal'
                    });
                }
                break;

            case 'find-coupons':
                if (window.taskQueue) {
                    window.taskQueue.addTask({
                        name: 'Find coupon codes',
                        command: 'Search for coupon codes or discounts for this website',
                        type: 'ai'
                    });
                }
                break;

            case 'fill-form':
            case 'use-profile':
                if (window.formAgent) {
                    window.formAgent.analyze();
                }
                break;

            case 'research-results':
                if (window.researchAgent) {
                    window.researchAgent.analyze();
                }
                break;

            case 'extract-code':
            case 'extract-ingredients':
            case 'extract-timestamps':
                if (window.aiPanel) {
                    window.aiPanel.open();
                    window.aiPanel.handleQuickAction('extract');
                }
                break;

            case 'help-email':
            case 'improve-email':
            case 'help-post':
                if (window.aiPanel) {
                    window.aiPanel.open();
                    // Pre-fill with helpful prompt
                    const aiInput = document.getElementById('ai-input');
                    if (aiInput) {
                        aiInput.value = 'Help me write/improve this message';
                        aiInput.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }
                break;

            default:
                if (window.aiPanel) {
                    window.aiPanel.open();
                }
        }
    }

    enable() {
        this.isEnabled = true;
    }

    disable() {
        this.isEnabled = false;
        this.hide();
    }

    toggle() {
        this.isEnabled = !this.isEnabled;
        if (!this.isEnabled) this.hide();
        return this.isEnabled;
    }
}

// Initialize
window.proactiveAgent = new ProactiveAgent();
