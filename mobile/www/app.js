/**
 * EVOS Browser Mobile - App
 */

class EvosMobile {
    constructor() {
        this.currentTab = 'ai';
        this.chatHistory = [];
        this.browseHistory = [];
        this.profile = null;
        this.geminiApiKey = '';

        this.init();
    }

    init() {
        this.loadData();
        this.setupEventListeners();
        this.loadApiKey();
    }

    loadData() {
        try {
            this.chatHistory = JSON.parse(localStorage.getItem('evos-chat-history') || '[]');
            this.browseHistory = JSON.parse(localStorage.getItem('evos-browse-history') || '[]');
            this.profile = JSON.parse(localStorage.getItem('evos-profile') || 'null');
        } catch (e) {
            console.error('Failed to load data:', e);
        }
    }

    saveData() {
        localStorage.setItem('evos-chat-history', JSON.stringify(this.chatHistory.slice(-50)));
        localStorage.setItem('evos-browse-history', JSON.stringify(this.browseHistory.slice(-100)));
        if (this.profile) {
            localStorage.setItem('evos-profile', JSON.stringify(this.profile));
        }
    }

    loadApiKey() {
        this.geminiApiKey = localStorage.getItem('evos-gemini-key') || '';
    }

    setupEventListeners() {
        // Bottom navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => this.switchTab(item.dataset.tab));
        });

        // Quick actions
        document.querySelectorAll('.action-card').forEach(card => {
            card.addEventListener('click', () => this.handleQuickAction(card.dataset.action));
        });

        // Chat input
        const chatInput = document.getElementById('chat-input');
        const sendBtn = document.getElementById('btn-send');

        sendBtn.addEventListener('click', () => this.sendMessage());
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        // URL bar
        const urlInput = document.getElementById('url-input');
        const goBtn = document.getElementById('btn-go');

        goBtn.addEventListener('click', () => this.navigateToUrl());
        urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.navigateToUrl();
        });

        // Browser close
        document.getElementById('btn-close-browser').addEventListener('click', () => {
            document.getElementById('browser-view').style.display = 'none';
        });

        // Settings
        document.getElementById('btn-settings').addEventListener('click', () => this.showSettings());
    }

    switchTab(tab) {
        this.currentTab = tab;

        // Update nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.tab === tab);
        });

        // Show appropriate view
        const aiView = document.getElementById('ai-view');
        const browserView = document.getElementById('browser-view');

        if (tab === 'ai') {
            aiView.style.display = 'block';
            browserView.style.display = 'none';
        } else if (tab === 'browse') {
            aiView.style.display = 'none';
            browserView.style.display = 'block';
        } else if (tab === 'history') {
            this.showHistory();
        } else if (tab === 'profile') {
            this.showProfile();
        }
    }

    handleQuickAction(action) {
        const chatInput = document.getElementById('chat-input');

        switch (action) {
            case 'search':
                chatInput.placeholder = 'What do you want to search for?';
                chatInput.focus();
                break;
            case 'research':
                this.addMessage('user', 'Help me research a topic');
                this.addMessage('ai', 'Sure! What topic would you like me to research? I can:\n\n• Compare products or services\n• Summarize articles\n• Find information on any subject\n\nJust tell me what you need!');
                break;
            case 'summarize':
                chatInput.value = 'Summarize this URL: ';
                chatInput.focus();
                break;
            case 'chat':
                document.getElementById('welcome-section').style.display = 'none';
                chatInput.focus();
                break;
        }
    }

    async sendMessage() {
        const input = document.getElementById('chat-input');
        const text = input.value.trim();

        if (!text) return;

        input.value = '';
        document.getElementById('welcome-section').style.display = 'none';

        // Add user message
        this.addMessage('user', text);

        // Show typing
        document.getElementById('typing-indicator').style.display = 'flex';

        try {
            const response = await this.getAIResponse(text);
            document.getElementById('typing-indicator').style.display = 'none';
            this.addMessage('ai', response);
        } catch (error) {
            document.getElementById('typing-indicator').style.display = 'none';
            this.addMessage('ai', 'Sorry, I had trouble responding. Please check your API key in settings.');
        }
    }

    async getAIResponse(prompt) {
        if (!this.geminiApiKey) {
            return 'Please set your Gemini API key in Settings (⚙️) to enable AI responses.';
        }

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiApiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: {
                            temperature: 0.7,
                            maxOutputTokens: 1024
                        }
                    })
                }
            );

            const data = await response.json();

            if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                return data.candidates[0].content.parts[0].text;
            }

            return 'I received an unexpected response. Please try again.';
        } catch (error) {
            console.error('AI Error:', error);
            throw error;
        }
    }

    addMessage(type, text) {
        const container = document.getElementById('chat-messages');

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.innerHTML = `<div class="message-bubble">${this.formatText(text)}</div>`;

        container.appendChild(messageDiv);
        container.scrollTop = container.scrollHeight;

        // Save to history
        this.chatHistory.push({ type, text, timestamp: Date.now() });
        this.saveData();
    }

    formatText(text) {
        // Basic markdown-like formatting
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>')
            .replace(/•/g, '&bull;');
    }

    navigateToUrl() {
        let url = document.getElementById('url-input').value.trim();

        if (!url) return;

        // Add protocol if missing
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            // Check if it looks like a URL
            if (url.includes('.') && !url.includes(' ')) {
                url = 'https://' + url;
            } else {
                // Treat as search
                url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
            }
        }

        // Show browser view
        document.getElementById('browser-view').style.display = 'block';
        document.getElementById('browser-frame').src = url;

        // Add to history
        this.browseHistory.push({ url, timestamp: Date.now() });
        this.saveData();

        this.switchTab('browse');
    }

    showHistory() {
        const aiView = document.getElementById('ai-view');
        aiView.innerHTML = `
            <h2 style="margin-bottom: 16px;">Browse History</h2>
            ${this.browseHistory.slice(-20).reverse().map(item => `
                <div class="history-item" onclick="app.openUrl('${item.url}')">
                    <div class="history-item-title">${new URL(item.url).hostname}</div>
                    <div class="history-item-url">${item.url}</div>
                </div>
            `).join('') || '<p style="color: var(--text-muted);">No history yet</p>'}
        `;
        aiView.style.display = 'block';
        document.getElementById('browser-view').style.display = 'none';
    }

    showProfile() {
        const aiView = document.getElementById('ai-view');
        const p = this.profile || {};

        aiView.innerHTML = `
            <h2 style="margin-bottom: 16px;">Profile</h2>
            <div class="profile-field">
                <label style="color: var(--text-muted); font-size: 12px;">Name</label>
                <input type="text" id="profile-name" value="${p.name || ''}" 
                       style="width: 100%; padding: 12px; background: var(--bg-primary); 
                              border: 1px solid var(--border); border-radius: 8px; 
                              color: var(--text-primary); margin-top: 4px;">
            </div>
            <div class="profile-field">
                <label style="color: var(--text-muted); font-size: 12px;">Email</label>
                <input type="email" id="profile-email" value="${p.email || ''}" 
                       style="width: 100%; padding: 12px; background: var(--bg-primary); 
                              border: 1px solid var(--border); border-radius: 8px; 
                              color: var(--text-primary); margin-top: 4px;">
            </div>
            <div class="profile-field">
                <label style="color: var(--text-muted); font-size: 12px;">Phone</label>
                <input type="tel" id="profile-phone" value="${p.phone || ''}" 
                       style="width: 100%; padding: 12px; background: var(--bg-primary); 
                              border: 1px solid var(--border); border-radius: 8px; 
                              color: var(--text-primary); margin-top: 4px;">
            </div>
            <button onclick="app.saveProfile()" style="
                width: 100%; padding: 14px; margin-top: 16px;
                background: linear-gradient(135deg, var(--accent), #a855f7);
                border: none; border-radius: 12px; color: white;
                font-weight: 600; cursor: pointer;
            ">Save Profile</button>
        `;
        aiView.style.display = 'block';
        document.getElementById('browser-view').style.display = 'none';
    }

    saveProfile() {
        this.profile = {
            name: document.getElementById('profile-name').value,
            email: document.getElementById('profile-email').value,
            phone: document.getElementById('profile-phone').value
        };
        this.saveData();
        this.showToast('Profile saved!');
    }

    openUrl(url) {
        document.getElementById('url-input').value = url;
        this.navigateToUrl();
    }

    showSettings() {
        const currentKey = this.geminiApiKey ? '••••••' + this.geminiApiKey.slice(-4) : 'Not set';

        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.8);
            display: flex; align-items: center; justify-content: center;
            z-index: 1000; padding: 20px;
        `;
        modal.innerHTML = `
            <div style="background: var(--bg-secondary); border-radius: 16px; 
                        padding: 24px; max-width: 400px; width: 100%;">
                <h3 style="margin-bottom: 16px;">Settings</h3>
                <label style="color: var(--text-muted); font-size: 12px;">Gemini API Key</label>
                <input type="password" id="api-key-input" placeholder="Enter your API key"
                       style="width: 100%; padding: 12px; background: var(--bg-tertiary); 
                              border: 1px solid var(--border); border-radius: 8px; 
                              color: var(--text-primary); margin: 8px 0 16px;">
                <p style="font-size: 11px; color: var(--text-muted); margin-bottom: 16px;">
                    Current: ${currentKey}
                </p>
                <div style="display: flex; gap: 8px;">
                    <button onclick="this.closest('div').parentElement.remove()" 
                            style="flex: 1; padding: 12px; background: var(--bg-tertiary); 
                                   border: none; border-radius: 8px; color: var(--text-primary); cursor: pointer;">
                        Cancel
                    </button>
                    <button onclick="app.saveApiKey()" 
                            style="flex: 1; padding: 12px; background: var(--accent); 
                                   border: none; border-radius: 8px; color: white; cursor: pointer;">
                        Save
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    saveApiKey() {
        const key = document.getElementById('api-key-input').value.trim();
        if (key) {
            this.geminiApiKey = key;
            localStorage.setItem('evos-gemini-key', key);
            this.showToast('API key saved!');
        }
        document.querySelector('[style*="position: fixed"]').remove();
    }

    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => toast.remove(), 3000);
    }
}

// Initialize app
const app = new EvosMobile();
