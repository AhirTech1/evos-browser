const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  openSettings: () => ipcRenderer.send('open-settings'),
  closeSettings: () => ipcRenderer.send('close-settings'),

  // History
  getHistory: () => ipcRenderer.invoke('get-history'),
  addToHistory: (entry) => ipcRenderer.invoke('add-to-history', entry),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  deleteHistoryItem: (id) => ipcRenderer.invoke('delete-history-item', id),

  // Bookmarks
  getBookmarks: () => ipcRenderer.invoke('get-bookmarks'),
  addBookmark: (bookmark) => ipcRenderer.invoke('add-bookmark', bookmark),
  removeBookmark: (id) => ipcRenderer.invoke('remove-bookmark', id),
  updateBookmark: (bookmark) => ipcRenderer.invoke('update-bookmark', bookmark),
  isBookmarked: (url) => ipcRenderer.invoke('is-bookmarked', url),

  // Downloads
  getDownloads: () => ipcRenderer.invoke('get-downloads'),
  clearDownloads: () => ipcRenderer.invoke('clear-downloads'),

  // Search
  getSearchUrl: (query) => ipcRenderer.invoke('get-search-url', query),

  // Homepage
  getHomepage: () => ipcRenderer.invoke('get-homepage'),

  // Event listeners
  onNewTabRequest: (callback) => ipcRenderer.on('new-tab-request', (event, url) => callback(url)),
  onMenuNewTab: (callback) => ipcRenderer.on('menu-new-tab', callback),
  onMenuCloseTab: (callback) => ipcRenderer.on('menu-close-tab', callback),
  onMenuReload: (callback) => ipcRenderer.on('menu-reload', callback),
  onMenuHardReload: (callback) => ipcRenderer.on('menu-hard-reload', callback),
  onMenuBack: (callback) => ipcRenderer.on('menu-back', callback),
  onMenuForward: (callback) => ipcRenderer.on('menu-forward', callback),
  onMenuZoomIn: (callback) => ipcRenderer.on('menu-zoom-in', callback),
  onMenuZoomOut: (callback) => ipcRenderer.on('menu-zoom-out', callback),
  onMenuZoomReset: (callback) => ipcRenderer.on('menu-zoom-reset', callback),
  onMenuDevtools: (callback) => ipcRenderer.on('menu-devtools', callback),
  onMenuShowHistory: (callback) => ipcRenderer.on('menu-show-history', callback),
  onMenuShowBookmarks: (callback) => ipcRenderer.on('menu-show-bookmarks', callback),
  onMenuAddBookmark: (callback) => ipcRenderer.on('menu-add-bookmark', callback),
  onSettingsUpdated: (callback) => ipcRenderer.on('settings-updated', (event, settings) => callback(settings)),
  onHistoryCleared: (callback) => ipcRenderer.on('history-cleared', callback),

  // Download events
  onDownloadStarted: (callback) => ipcRenderer.on('download-started', (event, info) => callback(info)),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (event, info) => callback(info)),
  onDownloadComplete: (callback) => ipcRenderer.on('download-complete', (event, info) => callback(info)),

  // AI Action events (AI opens URLs, navigates, etc.)
  onAIOpenUrl: (callback) => ipcRenderer.on('ai-open-url', (event, data) => callback(data)),

  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});

// AI API - Native node-llama-cpp powered
contextBridge.exposeInMainWorld('aiAPI', {
  // Status
  getStatus: () => ipcRenderer.invoke('ai-get-status'),

  // Model management
  downloadModel: () => ipcRenderer.invoke('ai-download-model'),
  cancelDownload: () => ipcRenderer.invoke('ai-cancel-download'),
  initialize: () => ipcRenderer.invoke('ai-initialize'),
  getModelInfo: () => ipcRenderer.invoke('ai-model-info'),

  // Mode switching
  switchMode: (mode) => ipcRenderer.invoke('ai-switch-mode', mode),
  getMode: () => ipcRenderer.invoke('ai-get-mode'),

  // Chat with LLM
  chat: (message, context) => ipcRenderer.invoke('ai-chat', { message, context }),

  // Agent execution (with browser tools)
  executeAgent: (task, context) => ipcRenderer.invoke('ai-agent-execute', { task, context }),

  // Memory operations
  rememberPage: (url, title, content, summary) =>
    ipcRenderer.invoke('ai-remember-page', { url, title, content, summary }),
  search: (query, limit) =>
    ipcRenderer.invoke('ai-search', { query, limit }),
  getRecent: (limit) => ipcRenderer.invoke('ai-get-recent', limit),
  getMemoryStats: () => ipcRenderer.invoke('ai-memory-stats'),
  deleteMemory: (id) => ipcRenderer.invoke('ai-delete-memory', id),
  clearMemory: () => ipcRenderer.invoke('ai-clear-memory'),

  // Chat history
  clearHistory: () => ipcRenderer.invoke('ai-clear-history'),

  // Knowledge Graph
  getKnowledgeContext: () => ipcRenderer.invoke('ai-get-knowledge-context'),

  // Legacy local storage (fallback)
  getMemories: () => ipcRenderer.invoke('ai-get-memories'),
  saveMemory: (memory) => ipcRenderer.invoke('ai-save-memory', memory),
  searchMemories: (query) => ipcRenderer.invoke('ai-search-memories', query),

  // Workflow operations
  getWorkflows: () => ipcRenderer.invoke('ai-get-workflows'),
  saveWorkflow: (workflow) => ipcRenderer.invoke('ai-save-workflow', workflow),
  deleteWorkflow: (id) => ipcRenderer.invoke('ai-delete-workflow', id),

  // Ghost task operations
  getGhostTasks: () => ipcRenderer.invoke('ai-get-ghost-tasks'),
  saveGhostTask: (task) => ipcRenderer.invoke('ai-save-ghost-task', task),
  deleteGhostTask: (id) => ipcRenderer.invoke('ai-delete-ghost-task', id),

  // Skill operations
  getSkills: () => ipcRenderer.invoke('ai-get-skills'),
  saveSkill: (skill) => ipcRenderer.invoke('ai-save-skill', skill),

  // AI Settings
  getSettings: () => ipcRenderer.invoke('ai-get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('ai-save-settings', settings),

  // Stats
  getStats: () => ipcRenderer.invoke('ai-get-stats'),

  // Events
  onStatus: (callback) => ipcRenderer.on('ai-status', (event, data) => callback(data)),
  onNeedsSetup: (callback) => ipcRenderer.on('ai-needs-setup', (event, data) => callback(data)),
  onDownloadProgress: (callback) => ipcRenderer.on('ai-download-progress', (event, data) => callback(data)),
  onAgentProgress: (callback) => ipcRenderer.on('ai-agent-progress', (event, data) => callback(data)),

  // Remove listeners
  removeListener: (channel) => ipcRenderer.removeAllListeners(channel),

  // Web search for research
  webSearch: (query) => ipcRenderer.invoke('ai-web-search', query)
});
