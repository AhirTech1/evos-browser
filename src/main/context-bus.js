/**
 * EVOS Context Bus
 * Global state management for cross-tab communication and AI context
 * This is the foundation for multi-tab reasoning and agent coordination
 */

// Safe import for testing environments
let ipcMain, webContents;
try {
    ({ ipcMain, webContents } = require('electron'));
} catch (e) {
    console.warn('[ContextBus] Electron not available');
}

const { v4: uuidv4 } = require('uuid');

class ContextBus {
    constructor() {
        // Stores state for each tab/webview
        this.tabStates = new Map();

        // Global unified state
        this.globalState = {
            activeTabId: null,
            tabCount: 0,
            lastUpdate: Date.now(),
            aggregatedContent: {},
            crossTabData: {}
        };

        // Event listeners
        this.listeners = new Map();

        // State history for temporal reasoning
        this.stateHistory = [];
        this.maxHistorySize = 100;

        // Initialize IPC handlers
        this.setupIPC();

        console.log('[ContextBus] Initialized');
    }

    // ==========================================
    // IPC Setup
    // ==========================================

    setupIPC() {
        if (!ipcMain) return;

        // Register tab state from renderer
        ipcMain.handle('context-bus:register-tab', (event, tabData) => {
            return this.registerTab(tabData);
        });

        // Update tab state
        ipcMain.handle('context-bus:update-tab', (event, tabId, updates) => {
            return this.updateTabState(tabId, updates);
        });

        // Get single tab state
        ipcMain.handle('context-bus:get-tab', (event, tabId) => {
            return this.getTabState(tabId);
        });

        // Get all tabs
        ipcMain.handle('context-bus:get-all-tabs', () => {
            return this.getAllTabs();
        });

        // Get global state
        ipcMain.handle('context-bus:get-global-state', () => {
            return this.getGlobalState();
        });

        // Set active tab
        ipcMain.handle('context-bus:set-active', (event, tabId) => {
            return this.setActiveTab(tabId);
        });

        // Remove tab
        ipcMain.handle('context-bus:remove-tab', (event, tabId) => {
            return this.removeTab(tabId);
        });

        // Query across tabs
        ipcMain.handle('context-bus:query', (event, query) => {
            return this.queryTabs(query);
        });

        // Get context for AI
        ipcMain.handle('context-bus:get-ai-context', (event, options) => {
            return this.getAIContext(options);
        });

        // Broadcast event to all tabs
        ipcMain.handle('context-bus:broadcast', (event, eventName, data) => {
            return this.broadcast(eventName, data);
        });

        // Subscribe to events
        ipcMain.on('context-bus:subscribe', (event, eventName) => {
            const webContentsId = event.sender.id;
            this.subscribe(eventName, webContentsId);
        });
    }

    // ==========================================
    // Tab State Management
    // ==========================================

    registerTab(tabData) {
        const tabId = tabData.id || uuidv4();

        const state = {
            id: tabId,
            webContentsId: tabData.webContentsId,
            url: tabData.url || '',
            title: tabData.title || 'New Tab',
            domain: this.extractDomain(tabData.url),
            favicon: tabData.favicon || null,

            // Content data
            content: {
                text: '',
                headings: [],
                links: [],
                images: [],
                forms: [],
                meta: {}
            },

            // Extracted structured data
            structuredData: {
                prices: [],
                dates: [],
                emails: [],
                phones: [],
                products: [],
                entities: []
            },

            // Tab metadata
            metadata: {
                isActive: false,
                isPinned: tabData.isPinned || false,
                groupId: tabData.groupId || null,
                createdAt: Date.now(),
                lastAccessed: Date.now(),
                visitCount: 1
            },

            // AI context
            aiContext: {
                lastSummary: null,
                memories: [],
                tags: [],
                importance: 0
            }
        };

        this.tabStates.set(tabId, state);
        this.globalState.tabCount = this.tabStates.size;
        this.globalState.lastUpdate = Date.now();

        // Add to history
        this.addToHistory('tab-registered', { tabId });

        // Notify listeners
        this.emit('tab-registered', { tabId, state });

        console.log(`[ContextBus] Tab registered: ${tabId}`);
        return { success: true, tabId, state };
    }

    updateTabState(tabId, updates) {
        const state = this.tabStates.get(tabId);
        if (!state) {
            return { success: false, error: 'Tab not found' };
        }

        // Deep merge updates
        this.deepMerge(state, updates);
        state.metadata.lastAccessed = Date.now();

        // Update domain if URL changed
        if (updates.url) {
            state.domain = this.extractDomain(updates.url);
        }

        this.globalState.lastUpdate = Date.now();

        // Add to history
        this.addToHistory('tab-updated', { tabId, updates: Object.keys(updates) });

        // Notify listeners
        this.emit('tab-updated', { tabId, state });

        return { success: true, state };
    }

    getTabState(tabId) {
        const state = this.tabStates.get(tabId);
        return state ? { success: true, state } : { success: false, error: 'Tab not found' };
    }

    getAllTabs() {
        const tabs = Array.from(this.tabStates.values());
        return {
            success: true,
            tabs,
            count: tabs.length,
            activeTabId: this.globalState.activeTabId
        };
    }

    getGlobalState() {
        return {
            ...this.globalState,
            tabs: Array.from(this.tabStates.values()).map(t => ({
                id: t.id,
                title: t.title,
                url: t.url,
                domain: t.domain,
                isActive: t.metadata.isActive
            }))
        };
    }

    setActiveTab(tabId) {
        // Deactivate previous
        if (this.globalState.activeTabId) {
            const prevState = this.tabStates.get(this.globalState.activeTabId);
            if (prevState) {
                prevState.metadata.isActive = false;
            }
        }

        // Activate new
        const state = this.tabStates.get(tabId);
        if (state) {
            state.metadata.isActive = true;
            state.metadata.lastAccessed = Date.now();
            state.metadata.visitCount++;
        }

        this.globalState.activeTabId = tabId;
        this.globalState.lastUpdate = Date.now();

        this.emit('active-tab-changed', { tabId });

        return { success: true, activeTabId: tabId };
    }

    removeTab(tabId) {
        const removed = this.tabStates.delete(tabId);

        if (removed) {
            this.globalState.tabCount = this.tabStates.size;
            this.globalState.lastUpdate = Date.now();

            if (this.globalState.activeTabId === tabId) {
                this.globalState.activeTabId = null;
            }

            this.addToHistory('tab-removed', { tabId });
            this.emit('tab-removed', { tabId });
        }

        return { success: removed };
    }

    // ==========================================
    // Cross-Tab Queries
    // ==========================================

    queryTabs(query) {
        const results = [];
        const { type, filter, limit = 10 } = query;

        for (const [tabId, state] of this.tabStates) {
            let matches = true;

            // Apply filters
            if (filter) {
                if (filter.domain && state.domain !== filter.domain) matches = false;
                if (filter.hasPrice && state.structuredData.prices.length === 0) matches = false;
                if (filter.hasForm && state.content.forms.length === 0) matches = false;
                if (filter.urlContains && !state.url.includes(filter.urlContains)) matches = false;
                if (filter.titleContains && !state.title.toLowerCase().includes(filter.titleContains.toLowerCase())) matches = false;
            }

            if (matches) {
                results.push({
                    tabId,
                    title: state.title,
                    url: state.url,
                    domain: state.domain,
                    ...(type === 'full' ? state : {}),
                    ...(type === 'prices' ? { prices: state.structuredData.prices } : {}),
                    ...(type === 'content' ? { content: state.content.text.substring(0, 1000) } : {})
                });
            }

            if (results.length >= limit) break;
        }

        return { success: true, results, count: results.length };
    }

    // ==========================================
    // AI Context Generation
    // ==========================================

    getAIContext(options = {}) {
        const {
            includeActive = true,
            includeAll = false,
            maxContentLength = 2000,
            includePrices = true,
            includeForms = true
        } = options;

        const context = {
            timestamp: Date.now(),
            activeTab: null,
            relatedTabs: [],
            aggregatedData: {
                allPrices: [],
                allProducts: [],
                domains: []
            }
        };

        // Get active tab context
        if (includeActive && this.globalState.activeTabId) {
            const activeState = this.tabStates.get(this.globalState.activeTabId);
            if (activeState) {
                context.activeTab = {
                    id: activeState.id,
                    title: activeState.title,
                    url: activeState.url,
                    domain: activeState.domain,
                    content: activeState.content.text.substring(0, maxContentLength),
                    headings: activeState.content.headings.slice(0, 10),
                    prices: includePrices ? activeState.structuredData.prices : [],
                    hasForms: activeState.content.forms.length > 0,
                    meta: activeState.content.meta
                };
            }
        }

        // Get all tabs context
        if (includeAll) {
            for (const [tabId, state] of this.tabStates) {
                if (tabId === this.globalState.activeTabId) continue;

                context.relatedTabs.push({
                    id: state.id,
                    title: state.title,
                    url: state.url,
                    domain: state.domain,
                    summary: state.aiContext.lastSummary || state.content.text.substring(0, 200)
                });

                // Aggregate data
                context.aggregatedData.allPrices.push(...state.structuredData.prices);
                context.aggregatedData.allProducts.push(...state.structuredData.products);
                if (!context.aggregatedData.domains.includes(state.domain)) {
                    context.aggregatedData.domains.push(state.domain);
                }
            }
        }

        return { success: true, context };
    }

    // ==========================================
    // Event System
    // ==========================================

    subscribe(eventName, webContentsId) {
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, new Set());
        }
        this.listeners.get(eventName).add(webContentsId);
    }

    unsubscribe(eventName, webContentsId) {
        if (this.listeners.has(eventName)) {
            this.listeners.get(eventName).delete(webContentsId);
        }
    }

    emit(eventName, data) {
        const listeners = this.listeners.get(eventName);
        if (!listeners) return;

        for (const webContentsId of listeners) {
            try {
                const wc = webContents.fromId(webContentsId);
                if (wc && !wc.isDestroyed()) {
                    wc.send(`context-bus:${eventName}`, data);
                } else {
                    // Clean up dead listeners
                    listeners.delete(webContentsId);
                }
            } catch (e) {
                listeners.delete(webContentsId);
            }
        }
    }

    broadcast(eventName, data) {
        // Send to all webContents
        for (const wc of webContents.getAllWebContents()) {
            try {
                if (!wc.isDestroyed()) {
                    wc.send(`context-bus:${eventName}`, data);
                }
            } catch (e) {
                // Ignore errors
            }
        }
        return { success: true };
    }

    // ==========================================
    // History & Temporal Tracking
    // ==========================================

    addToHistory(action, data) {
        this.stateHistory.push({
            timestamp: Date.now(),
            action,
            data
        });

        // Trim history
        if (this.stateHistory.length > this.maxHistorySize) {
            this.stateHistory = this.stateHistory.slice(-this.maxHistorySize);
        }
    }

    getHistory(since = 0) {
        return this.stateHistory.filter(h => h.timestamp >= since);
    }

    // ==========================================
    // Utility Methods
    // ==========================================

    extractDomain(url) {
        try {
            return new URL(url).hostname;
        } catch {
            return '';
        }
    }

    deepMerge(target, source) {
        for (const key of Object.keys(source)) {
            if (source[key] instanceof Object && key in target) {
                Object.assign(source[key], this.deepMerge(target[key], source[key]));
            }
        }
        Object.assign(target, source);
        return target;
    }

    // ==========================================
    // Comparison Methods (for Research Agent)
    // ==========================================

    compareTabs(tabIds, criteria = 'all') {
        const comparison = {
            tabs: [],
            criteria,
            analysis: {}
        };

        for (const tabId of tabIds) {
            const state = this.tabStates.get(tabId);
            if (!state) continue;

            const tabData = {
                id: tabId,
                title: state.title,
                url: state.url,
                domain: state.domain
            };

            switch (criteria) {
                case 'prices':
                    tabData.prices = state.structuredData.prices;
                    break;
                case 'content':
                    tabData.content = state.content.text.substring(0, 2000);
                    tabData.headings = state.content.headings;
                    break;
                case 'products':
                    tabData.products = state.structuredData.products;
                    break;
                case 'all':
                default:
                    tabData.prices = state.structuredData.prices;
                    tabData.content = state.content.text.substring(0, 1000);
                    tabData.products = state.structuredData.products;
            }

            comparison.tabs.push(tabData);
        }

        // Generate basic analysis
        if (criteria === 'prices' && comparison.tabs.length > 1) {
            const allPrices = comparison.tabs.flatMap(t => t.prices || []);
            if (allPrices.length > 0) {
                const numericPrices = allPrices
                    .map(p => parseFloat(p.replace(/[^0-9.]/g, '')))
                    .filter(p => !isNaN(p));

                comparison.analysis = {
                    lowestPrice: Math.min(...numericPrices),
                    highestPrice: Math.max(...numericPrices),
                    priceRange: Math.max(...numericPrices) - Math.min(...numericPrices)
                };
            }
        }

        return { success: true, comparison };
    }
}

// Singleton instance
const contextBus = new ContextBus();

module.exports = { ContextBus, contextBus };
