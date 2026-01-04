require('dotenv').config();
const { app, BrowserWindow, ipcMain, session, Menu, dialog, nativeTheme } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { v4: uuidv4 } = require('uuid');

// AI System imports - wrapped in try-catch to prevent app crash
let llmEngine, aiAgent, aiMemory, modelDownloader, browserTools, knowledgeGraph;
let aiModulesLoaded = false;

try {
  const aiModules = require('../ai');
  llmEngine = aiModules.llmEngine;
  aiAgent = aiModules.aiAgent;
  aiMemory = aiModules.aiMemory;
  modelDownloader = aiModules.modelDownloader;
  browserTools = aiModules.browserTools;
  knowledgeGraph = aiModules.knowledgeGraph;
  aiModulesLoaded = true;
  console.log('[Main] AI modules loaded successfully');
} catch (error) {
  console.error('[Main] Failed to load AI modules:', error.message);
  // Create stub implementations to prevent crashes
  llmEngine = { unload: async () => { }, initialize: async () => false, getInfo: () => ({ isLoaded: false }) };
  aiAgent = { chat: async () => 'AI is not available', run: async () => ({ error: 'AI not loaded' }), clearHistory: () => { } };
  aiMemory = { initialize: async () => { }, search: async () => [], getRecent: async () => [], rememberPage: async () => { }, getStats: () => ({}), deleteMemory: async () => false, clearAll: async () => { } };
  modelDownloader = { isModelReady: () => false, getStatus: () => ({ isReady: false }), downloadModel: async () => { }, onProgress: () => () => { }, getModelPath: () => '' };
  browserTools = { setBrowserContext: () => { } };
  knowledgeGraph = { extractFromText: async () => { }, getContextForAI: () => '', queryForContext: () => ({ entities: [], relationships: [] }) };
}

// Initialize store for persistent data
const store = new Store({
  name: 'evos-browser-data',
  defaults: {
    bookmarks: [],
    history: [],
    downloads: [],
    settings: {
      homepage: 'https://www.google.com',
      searchEngine: 'google',
      themeMode: 'dark', // 'dark', 'light', or 'system'
      blockPopups: true,
      enableJavaScript: true,
      enableImages: true,
      defaultZoom: 100
    }
  }
});

let mainWindow;
let settingsWindow;
let aiReady = false;
let aiMode = 'online'; // 'online' or 'offline' - default to online
let geminiModel = null; // Gemini model instance

// Load Gemini API (optional - graceful fail if not installed)
let GoogleGenerativeAI = null;
try {
  const genaiModule = require('@google/generative-ai');
  GoogleGenerativeAI = genaiModule.GoogleGenerativeAI;
  console.log('[Main] Google Generative AI loaded');
} catch (e) {
  console.log('[Main] @google/generative-ai not installed, online mode disabled');
}

// Initialize Gemini if API key is available
async function initializeGemini() {
  if (!GoogleGenerativeAI) return false;

  const apiKey = process.env.EVOS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log('[Gemini] No API key found (EVOS_GEMINI_API_KEY or GEMINI_API_KEY)');
    return false;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Use gemini-2.0-flash-001 (latest stable flash model)
    // Alternative: gemini-1.5-flash-latest, gemini-2.0-flash-exp
    geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    console.log('[Gemini] Initialized with gemini-2.0-flash');
    return true;
  } catch (error) {
    console.error('[Gemini] Initialization failed:', error.message);
    return false;
  }
}

// Chat with Gemini
async function chatWithGemini(message) {
  if (!geminiModel) {
    throw new Error('Gemini not initialized. Check API key.');
  }

  try {
    const result = await geminiModel.generateContent(message);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('[Gemini] Chat error:', error);
    // Rethrow with cleaner message
    throw new Error(`Gemini API error: ${error.message || 'Unknown error'}`);
  }
}

// Search engine URLs
const searchEngines = {
  google: 'https://www.google.com/search?q=',
  bing: 'https://www.bing.com/search?q=',
  duckduckgo: 'https://duckduckgo.com/?q=',
  yahoo: 'https://search.yahoo.com/search?p='
};

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true,
      sandbox: false
    },
    icon: path.join(__dirname, '../../assets/icons/icon.png'),
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();

    // Apply theme based on settings
    const settings = store.get('settings');
    const themeMode = settings.themeMode || 'dark'; // Default to dark

    if (themeMode === 'system') {
      nativeTheme.themeSource = 'system';
    } else {
      nativeTheme.themeSource = themeMode;
    }
  });

  // Handle new window requests (for popups)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Send new tab request to renderer
    mainWindow.webContents.send('new-tab-request', url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Create application menu
  createMenu();
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Tab',
          accelerator: 'CmdOrCtrl+T',
          click: () => mainWindow.webContents.send('menu-new-tab')
        },
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+N',
          click: () => createMainWindow()
        },
        { type: 'separator' },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => mainWindow.webContents.send('menu-close-tab')
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: 'Alt+F4',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow.webContents.send('menu-reload')
        },
        {
          label: 'Hard Reload',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => mainWindow.webContents.send('menu-hard-reload')
        },
        { type: 'separator' },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => mainWindow.webContents.send('menu-zoom-in')
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => mainWindow.webContents.send('menu-zoom-out')
        },
        {
          label: 'Reset Zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => mainWindow.webContents.send('menu-zoom-reset')
        },
        { type: 'separator' },
        {
          label: 'Toggle Fullscreen',
          accelerator: 'F11',
          click: () => mainWindow.setFullScreen(!mainWindow.isFullScreen())
        },
        { type: 'separator' },
        {
          label: 'Developer Tools',
          accelerator: 'F12',
          click: () => mainWindow.webContents.send('menu-devtools')
        }
      ]
    },
    {
      label: 'History',
      submenu: [
        {
          label: 'Back',
          accelerator: 'Alt+Left',
          click: () => mainWindow.webContents.send('menu-back')
        },
        {
          label: 'Forward',
          accelerator: 'Alt+Right',
          click: () => mainWindow.webContents.send('menu-forward')
        },
        { type: 'separator' },
        {
          label: 'Show Full History',
          accelerator: 'CmdOrCtrl+H',
          click: () => mainWindow.webContents.send('menu-show-history')
        },
        {
          label: 'Clear History',
          click: () => {
            store.set('history', []);
            mainWindow.webContents.send('history-cleared');
          }
        }
      ]
    },
    {
      label: 'Bookmarks',
      submenu: [
        {
          label: 'Bookmark This Page',
          accelerator: 'CmdOrCtrl+D',
          click: () => mainWindow.webContents.send('menu-add-bookmark')
        },
        {
          label: 'Show Bookmarks',
          accelerator: 'CmdOrCtrl+Shift+B',
          click: () => mainWindow.webContents.send('menu-show-bookmarks')
        }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About EVOS Browser',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About EVOS Browser',
              message: 'EVOS Browser v1.0.0',
              detail: 'An AI-powered Chromium-based browser.\n\nBuilt with Electron.\n\n© 2024 AhirTech1'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 500,
    minHeight: 400,
    parent: mainWindow,
    modal: true,
    frame: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  settingsWindow.loadFile(path.join(__dirname, '../renderer/settings.html'));

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

// App lifecycle
app.whenReady().then(async () => {
  createMainWindow();

  // Initialize AI after window is ready
  mainWindow.once('ready-to-show', async () => {
    // Delay AI init slightly to ensure renderer is ready
    setTimeout(async () => {
      // Initialize Gemini (Online AI) first - quick check
      const geminiReady = await initializeGemini();

      // Default to online mode with Gemini
      if (geminiReady) {
        mainWindow.webContents.send('ai-status', { status: 'ready', message: 'Online AI (Gemini) active' });
      } else {
        // Fallback to offline if Gemini fails
        console.log('[AI] Gemini not available, trying offline model...');
        await initializeAI();
      }
    }, 1000);
  });

  // Configure session for downloads
  session.defaultSession.on('will-download', (event, item, webContents) => {
    const fileName = item.getFilename();
    const fileSize = item.getTotalBytes();

    const downloadId = uuidv4();
    const downloadInfo = {
      id: downloadId,
      filename: fileName,
      url: item.getURL(),
      size: fileSize,
      receivedBytes: 0,
      state: 'progressing',
      startTime: new Date().toISOString(),
      path: ''
    };

    // Add to downloads list
    const downloads = store.get('downloads');
    downloads.unshift(downloadInfo);
    store.set('downloads', downloads);

    mainWindow.webContents.send('download-started', downloadInfo);

    item.on('updated', (event, state) => {
      if (state === 'interrupted') {
        downloadInfo.state = 'interrupted';
      } else if (state === 'progressing') {
        if (item.isPaused()) {
          downloadInfo.state = 'paused';
        } else {
          downloadInfo.receivedBytes = item.getReceivedBytes();
          downloadInfo.state = 'progressing';
        }
      }

      mainWindow.webContents.send('download-progress', {
        id: downloadId,
        receivedBytes: item.getReceivedBytes(),
        totalBytes: fileSize,
        state: downloadInfo.state
      });
    });

    item.once('done', (event, state) => {
      downloadInfo.state = state;
      downloadInfo.path = item.getSavePath();
      downloadInfo.endTime = new Date().toISOString();

      // Update in store
      const downloads = store.get('downloads');
      const index = downloads.findIndex(d => d.id === downloadId);
      if (index !== -1) {
        downloads[index] = downloadInfo;
        store.set('downloads', downloads);
      }

      mainWindow.webContents.send('download-complete', {
        id: downloadId,
        state: state,
        path: item.getSavePath()
      });
    });
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Unload AI model to free memory
  llmEngine.unload().catch(() => { });

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  llmEngine.unload().catch(() => { });
});

// ==========================================
// Native AI System Management
// ==========================================

let aiInitializing = false;

async function initializeAI() {
  // Prevent multiple simultaneous initialization attempts
  if (aiInitializing) {
    console.log('[AI] Already initializing, skipping...');
    return false;
  }

  if (aiReady) {
    console.log('[AI] Already ready');
    return true;
  }

  console.log('[AI] Checking model status...');

  // Check if model is downloaded
  if (!modelDownloader.isModelReady()) {
    console.log('[AI] Model not found, needs download');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('ai-needs-setup', {
        status: 'needs-download',
        modelName: modelDownloader.getStatus().modelName,
        modelSize: modelDownloader.getStatus().modelSize
      });
    }
    return false;
  }

  aiInitializing = true;

  try {
    console.log('[AI] Loading LLM model...');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('ai-status', { status: 'loading', message: 'Initializing AI engine...' });
    }

    // Set up progress callback for detailed loading status
    llmEngine.setLoadProgressCallback((progress) => {
      console.log('[AI] Load progress:', progress.message);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('ai-status', {
          status: 'loading',
          message: progress.message
        });
      }
    });

    // Initialize LLM engine
    await llmEngine.initialize();

    // Initialize memory
    await aiMemory.initialize();

    aiReady = true;
    aiInitializing = false;
    console.log('[AI] System ready');

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('ai-status', { status: 'ready', message: 'AI ready' });
    }

    return true;
  } catch (error) {
    aiInitializing = false;
    console.error('[AI] Failed to initialize:', error);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('ai-status', {
        status: 'error',
        message: `Failed to load AI: ${error.message}`
      });
    }
    return false;
  }
}

// Download model with progress
let isDownloading = false;

async function downloadAIModel() {
  if (isDownloading) {
    console.log('[AI] Download already in progress');
    return { success: false, error: 'Download already in progress' };
  }

  isDownloading = true;

  try {
    console.log('[AI] Starting model download...');

    // Setup progress listener
    const unsubscribe = modelDownloader.onProgress((progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('ai-download-progress', progress);
      }

      // When download completes, trigger AI initialization
      if (progress.status === 'complete') {
        console.log('[AI] Download complete, will initialize...');
      }
    });

    await modelDownloader.downloadModel();
    unsubscribe();
    isDownloading = false;

    console.log('[AI] Model downloaded, verifying file...');

    // Verify model file exists
    const modelPath = modelDownloader.getModelPath();
    const fs = require('fs');
    if (fs.existsSync(modelPath)) {
      const stats = fs.statSync(modelPath);
      console.log('[AI] Model file verified:', modelPath, 'Size:', stats.size);
    } else {
      console.error('[AI] ERROR: Model file not found after download!');
      return { success: false, error: 'Model file not found after download' };
    }

    console.log('[AI] Initializing AI...');

    // After download, initialize AI
    const initResult = await initializeAI();

    return { success: initResult };
  } catch (error) {
    isDownloading = false;
    console.error('[AI] Download failed:', error);
    return { success: false, error: error.message };
  }
}

// IPC Handlers

// Window controls
ipcMain.on('window-minimize', () => {
  mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.on('window-close', () => {
  mainWindow.close();
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow.isMaximized();
});

// Settings
ipcMain.handle('get-settings', () => {
  return store.get('settings');
});

ipcMain.handle('save-settings', (event, settings) => {
  store.set('settings', settings);

  // Apply theme mode
  const themeMode = settings.themeMode || 'dark';
  if (themeMode === 'system') {
    nativeTheme.themeSource = 'system';
  } else {
    nativeTheme.themeSource = themeMode;
  }
  mainWindow.webContents.send('settings-updated', settings);

  return true;
});

ipcMain.on('open-settings', () => {
  createSettingsWindow();
});

ipcMain.on('close-settings', () => {
  if (settingsWindow) {
    settingsWindow.close();
  }
});

// History
ipcMain.handle('get-history', () => {
  return store.get('history');
});

ipcMain.handle('add-to-history', (event, entry) => {
  const history = store.get('history');

  // Add timestamp and ID
  entry.id = uuidv4();
  entry.timestamp = new Date().toISOString();

  // Add to beginning of array
  history.unshift(entry);

  // Keep only last 1000 entries
  if (history.length > 1000) {
    history.pop();
  }

  store.set('history', history);
  return true;
});

ipcMain.handle('clear-history', () => {
  store.set('history', []);
  return true;
});

ipcMain.handle('delete-history-item', (event, id) => {
  const history = store.get('history');
  const filtered = history.filter(item => item.id !== id);
  store.set('history', filtered);
  return true;
});

// Bookmarks
ipcMain.handle('get-bookmarks', () => {
  return store.get('bookmarks');
});

ipcMain.handle('add-bookmark', (event, bookmark) => {
  const bookmarks = store.get('bookmarks');

  // Check if already bookmarked
  const exists = bookmarks.some(b => b.url === bookmark.url);
  if (exists) {
    return { success: false, message: 'Already bookmarked' };
  }

  bookmark.id = uuidv4();
  bookmark.createdAt = new Date().toISOString();

  bookmarks.push(bookmark);
  store.set('bookmarks', bookmarks);

  return { success: true, bookmark };
});

ipcMain.handle('remove-bookmark', (event, id) => {
  const bookmarks = store.get('bookmarks');
  const filtered = bookmarks.filter(b => b.id !== id);
  store.set('bookmarks', filtered);
  return true;
});

ipcMain.handle('update-bookmark', (event, bookmark) => {
  const bookmarks = store.get('bookmarks');
  const index = bookmarks.findIndex(b => b.id === bookmark.id);
  if (index !== -1) {
    bookmarks[index] = { ...bookmarks[index], ...bookmark };
    store.set('bookmarks', bookmarks);
  }
  return true;
});

ipcMain.handle('is-bookmarked', (event, url) => {
  const bookmarks = store.get('bookmarks');
  return bookmarks.some(b => b.url === url);
});

// Downloads
ipcMain.handle('get-downloads', () => {
  return store.get('downloads');
});

ipcMain.handle('clear-downloads', () => {
  store.set('downloads', []);
  return true;
});

// Search
ipcMain.handle('get-search-url', (event, query) => {
  const settings = store.get('settings');
  const searchEngine = settings.searchEngine || 'google';
  return searchEngines[searchEngine] + encodeURIComponent(query);
});

// Get homepage
ipcMain.handle('get-homepage', () => {
  const settings = store.get('settings');
  return settings.homepage;
});

// ==========================================
// AI System IPC Handlers
// ==========================================

// AI Data Store
const aiStore = new Store({
  name: 'evos-ai-data',
  defaults: {
    memories: [],
    workflows: [],
    ghostTasks: [],
    skills: [],
    settings: {
      enableAI: true,
      offlineOnly: true,
      maxMemoryMB: 512,
      autoRemember: false,
      showSuggestions: true
    },
    aiMode: 'online' // Default AI mode
  }
});

// AI Memory - Get all memories
ipcMain.handle('ai-get-memories', () => {
  return aiStore.get('memories');
});

// AI Memory - Save memory
ipcMain.handle('ai-save-memory', (event, memory) => {
  const memories = aiStore.get('memories');
  memory.id = memory.id || uuidv4();
  memory.timestamp = memory.timestamp || Date.now();

  // Check for duplicate URLs
  const existingIndex = memories.findIndex(m => m.url === memory.url);
  if (existingIndex !== -1) {
    memories[existingIndex] = { ...memories[existingIndex], ...memory };
  } else {
    memories.unshift(memory);
  }

  // Keep only last 10000 memories
  if (memories.length > 10000) {
    memories.pop();
  }

  aiStore.set('memories', memories);
  return { success: true, memory };
});

// AI Memory - Search memories (legacy - for local store)
ipcMain.handle('ai-search-memories', (event, query) => {
  const memories = aiStore.get('memories');
  const searchTerms = query.toLowerCase().split(' ');

  return memories.filter(memory => {
    const searchText = `${memory.title} ${memory.url} ${memory.content || ''} ${(memory.entities || []).join(' ')}`.toLowerCase();
    return searchTerms.every(term => searchText.includes(term));
  }).slice(0, 50);
});

// AI Memory - Clear all (legacy - for local store)
ipcMain.handle('ai-clear-memories', () => {
  aiStore.set('memories', []);
  return true;
});

// AI Workflows - Get all
ipcMain.handle('ai-get-workflows', () => {
  return aiStore.get('workflows');
});

// AI Workflows - Save
ipcMain.handle('ai-save-workflow', (event, workflow) => {
  const workflows = aiStore.get('workflows');
  workflow.id = workflow.id || uuidv4();
  workflow.createdAt = workflow.createdAt || Date.now();

  const existingIndex = workflows.findIndex(w => w.id === workflow.id);
  if (existingIndex !== -1) {
    workflows[existingIndex] = workflow;
  } else {
    workflows.unshift(workflow);
  }

  aiStore.set('workflows', workflows);
  return { success: true, workflow };
});

// AI Workflows - Delete
ipcMain.handle('ai-delete-workflow', (event, id) => {
  const workflows = aiStore.get('workflows');
  const filtered = workflows.filter(w => w.id !== id);
  aiStore.set('workflows', filtered);
  return true;
});

// AI Ghost Tasks - Get all
ipcMain.handle('ai-get-ghost-tasks', () => {
  return aiStore.get('ghostTasks');
});

// AI Ghost Tasks - Save
ipcMain.handle('ai-save-ghost-task', (event, task) => {
  const tasks = aiStore.get('ghostTasks');
  task.id = task.id || uuidv4();
  task.createdAt = task.createdAt || Date.now();

  const existingIndex = tasks.findIndex(t => t.id === task.id);
  if (existingIndex !== -1) {
    tasks[existingIndex] = task;
  } else {
    tasks.unshift(task);
  }

  aiStore.set('ghostTasks', tasks);
  return { success: true, task };
});

// AI Ghost Tasks - Delete
ipcMain.handle('ai-delete-ghost-task', (event, id) => {
  const tasks = aiStore.get('ghostTasks');
  const filtered = tasks.filter(t => t.id !== id);
  aiStore.set('ghostTasks', filtered);
  return true;
});

// AI Skills - Get all
ipcMain.handle('ai-get-skills', () => {
  return aiStore.get('skills');
});

// AI Skills - Save
ipcMain.handle('ai-save-skill', (event, skill) => {
  const skills = aiStore.get('skills');
  skill.id = skill.id || uuidv4();
  skill.createdAt = skill.createdAt || Date.now();

  const existingIndex = skills.findIndex(s => s.id === skill.id);
  if (existingIndex !== -1) {
    skills[existingIndex] = skill;
  } else {
    skills.unshift(skill);
  }

  aiStore.set('skills', skills);
  return { success: true, skill };
});

// AI Settings - Get
ipcMain.handle('ai-get-settings', () => {
  return aiStore.get('settings');
});

// AI Settings - Save
ipcMain.handle('ai-save-settings', (event, settings) => {
  aiStore.set('settings', settings);
  mainWindow.webContents.send('ai-settings-updated', settings);
  return true;
});

// AI Stats
ipcMain.handle('ai-get-stats', () => {
  return {
    memories: aiStore.get('memories').length,
    workflows: aiStore.get('workflows').length,
    ghostTasks: aiStore.get('ghostTasks').length,
    skills: aiStore.get('skills').length
  };
});

// ==========================================
// AI Native IPC Handlers
// ==========================================

// Check AI status
ipcMain.handle('ai-get-status', async () => {
  const status = modelDownloader.getStatus();
  return {
    isReady: aiReady,
    isModelDownloaded: status.isReady,
    isDownloading: status.isDownloading,
    modelName: status.modelName,
    modelSize: status.modelSize,
    llmStatus: llmEngine.getInfo()
  };
});

// Start AI model download
ipcMain.handle('ai-download-model', async () => {
  return await downloadAIModel();
});

// Cancel model download
ipcMain.handle('ai-cancel-download', async () => {
  modelDownloader.cancelDownload();
  return { success: true };
});

// Initialize AI (after model is downloaded)
ipcMain.handle('ai-initialize', async () => {
  return await initializeAI();
});

// Conversation history for better context
let conversationHistory = [];
const MAX_HISTORY = 20;

// Add to conversation history
function addToConversationHistory(role, content) {
  conversationHistory.push({
    role,
    content,
    timestamp: Date.now()
  });
  // Keep only recent messages
  if (conversationHistory.length > MAX_HISTORY) {
    conversationHistory = conversationHistory.slice(-MAX_HISTORY);
  }
}

// Get conversation context string
function getConversationContext() {
  if (conversationHistory.length === 0) return '';

  const recentHistory = conversationHistory.slice(-10);
  return recentHistory.map(msg =>
    `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
  ).join('\n');
}

// Execute browser action
async function executeBrowserAction(action, params, webContentsId) {
  console.log(`[AI Action] Executing: ${action}`, params);

  try {
    // Get webContents for browser interaction
    let webContents = null;
    if (webContentsId) {
      webContents = require('electron').webContents.fromId(webContentsId);
    }

    switch (action) {
      case 'search':
      case 'search_web':
        const searchQuery = params.query || params.text || params;
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
        // Tell renderer to open new tab with search
        mainWindow.webContents.send('ai-open-url', { url: searchUrl, newTab: true });
        return { success: true, action: 'search', query: searchQuery, url: searchUrl };

      case 'navigate':
      case 'open':
      case 'go_to':
        let url = params.url || params;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'https://' + url;
        }
        mainWindow.webContents.send('ai-open-url', { url, newTab: params.newTab !== false });
        return { success: true, action: 'navigate', url };

      case 'open_zomato':
        const zomatoUrl = `https://www.zomato.com/${params.city || 'surat'}/restaurants`;
        mainWindow.webContents.send('ai-open-url', { url: zomatoUrl, newTab: true });
        return { success: true, action: 'open_zomato', url: zomatoUrl };

      case 'open_google_maps':
        const mapsQuery = params.query || params;
        const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(mapsQuery)}`;
        mainWindow.webContents.send('ai-open-url', { url: mapsUrl, newTab: true });
        return { success: true, action: 'open_google_maps', url: mapsUrl };

      case 'click':
        if (webContents) {
          await webContents.executeJavaScript(`
            (function() {
              const el = document.querySelector('${params.selector}');
              if (el) { el.click(); return true; }
              return false;
            })()
          `);
        }
        return { success: true, action: 'click' };

      case 'type':
        if (webContents) {
          await webContents.executeJavaScript(`
            (function() {
              const el = document.querySelector('${params.selector}');
              if (el) { 
                el.value = '${params.text}';
                el.dispatchEvent(new Event('input', { bubbles: true }));
                return true;
              }
              return false;
            })()
          `);
        }
        return { success: true, action: 'type' };

      case 'scroll':
        if (webContents) {
          await webContents.executeJavaScript(`window.scrollBy(0, ${params.amount || 500})`);
        }
        return { success: true, action: 'scroll' };

      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  } catch (error) {
    console.error(`[AI Action] Error executing ${action}:`, error);
    return { success: false, error: error.message };
  }
}

// Parse AI response for actions
function parseAIResponseForActions(response) {
  const actions = [];

  // Look for JSON action blocks
  const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.action) actions.push(parsed);
      if (Array.isArray(parsed.actions)) actions.push(...parsed.actions);
    } catch (e) { /* ignore parse errors */ }
  }

  // Look for ACTION: format
  const actionMatches = response.matchAll(/ACTION:\s*(\w+)\s*(?:\(([^)]*)\))?/gi);
  for (const match of actionMatches) {
    actions.push({
      action: match[1].toLowerCase(),
      params: match[2] || ''
    });
  }

  return actions;
}

// Chat with AI (FULLY AGENTIC - executes actions automatically)
ipcMain.handle('ai-chat', async (event, { message, context }) => {
  // Check current mode
  const currentMode = aiStore.get('settings.aiMode', 'online');

  // --- KNOWLEDGE GRAPH INTEGRATION ---
  try {
    await knowledgeGraph.extractFromText(message, { source: 'user_chat' });
  } catch (e) { /* ignore */ }

  // Get memory context
  let memoryContext = '';
  try {
    memoryContext = knowledgeGraph.getContextForAI();
  } catch (e) { /* ignore */ }

  // Also search aiMemory
  let searchMemoryContext = '';
  try {
    const memoryResults = await aiMemory.search(message, 3);
    if (memoryResults && memoryResults.length > 0) {
      searchMemoryContext = memoryResults.map(m => m.content).join('\n');
    }
  } catch (e) { /* ignore */ }

  const lowerMessage = message.toLowerCase();

  // Detect if this is a summarization or research request - skip action detection
  const isContentAnalysisRequest = lowerMessage.includes('summarize') ||
    lowerMessage.includes('summary') ||
    lowerMessage.includes('page content:') ||
    lowerMessage.includes('please provide a clear summary') ||
    lowerMessage.includes('compare') ||
    lowerMessage.includes('comparison') ||
    lowerMessage.includes('research') ||
    lowerMessage.includes('analyze') ||
    lowerMessage.includes('key feature') ||
    lowerMessage.includes('verdict') ||
    lowerMessage.includes('recommendation') ||
    lowerMessage.includes('respond in this exact format') ||
    lowerMessage.includes('| item |');

  // Detect action intent (but NOT for summarize requests)
  const actionPatterns = {
    search: /(?:search|find|look for|look up|google|search for)\s+(.+?)(?:\s+(?:on|in|for me))?$/i,
    restaurant: /(?:restaurant|places? to eat|dinner|lunch|breakfast|food|cafe|dining).*?(?:in|at|near|around)?\s*(\w+)?/i,
    navigate: /(?:go to|open|navigate to|visit|take me to)\s+(.+)/i,
    maps: /(?:map|directions|how to get to|route to|navigate to)\s+(.+)/i,
    shopping: /(?:buy|shop|purchase|order|price of)\s+(.+)/i,
    weather: /(?:weather|temperature|forecast).*?(?:in|at|for)?\s*(\w+)?/i,
    news: /(?:news|headlines|latest).*?(?:about|on|for)?\s*(.+)?/i,
  };

  let detectedAction = null;
  let actionParams = {};

  // Check for action patterns ONLY if this is NOT a content analysis request
  if (!isContentAnalysisRequest) {
    for (const [actionType, pattern] of Object.entries(actionPatterns)) {
      const match = lowerMessage.match(pattern);
      if (match) {
        detectedAction = actionType;
        actionParams = { query: match[1]?.trim() || message, fullMessage: message };
        break;
      }
    }
  }

  // Build page context if relevant
  const pageKeywords = ['this page', 'the page', 'current page', 'summarize', 'what is this', 'explain'];
  const needsPageContext = pageKeywords.some(kw => lowerMessage.includes(kw));

  let enhancedMessage = message;
  if (needsPageContext && context && context.title) {
    enhancedMessage = `[Current page: "${context.title}" at ${context.url}]\n`;
    if (context.content) {
      enhancedMessage += `[Page excerpt: ${context.content.substring(0, 2000)}]\n\n`;
    }
    enhancedMessage += `User: ${message}`;
  }

  // Get conversation history
  const conversationContext = getConversationContext();

  // Detect if this is a simple greeting (don't dump memory on greetings)
  const greetingPatterns = /^(hi|hello|hey|yo|sup|good morning|good afternoon|good evening|howdy|hola|namaste|what's up|whats up)[\s!?.]*$/i;
  const isSimpleGreeting = greetingPatterns.test(lowerMessage.trim());

  // Build AGENTIC system prompt - AI decides and executes actions
  let systemPrompt = `You are EVOS AI, an intelligent browser assistant that can TAKE ACTIONS on behalf of the user.

🎯 YOUR MISSION: Help users by ACTUALLY DOING things, not just suggesting!

⚡ AVAILABLE ACTIONS (use these to help the user):
1. SEARCH: Search the web for anything
2. NAVIGATE: Open any website
3. OPEN_ZOMATO: Open Zomato for restaurant searches
4. OPEN_GOOGLE_MAPS: Open Google Maps for locations

📋 HOW TO TAKE ACTION:
When you decide to take an action, include it in your response like this:
\`\`\`json
{"action": "search", "params": {"query": "your search query"}}
\`\`\`

Or for multiple actions:
\`\`\`json
{"actions": [
  {"action": "search", "params": {"query": "romantic restaurants in Surat"}},
  {"action": "open_zomato", "params": {"city": "surat"}}
]}
\`\`\`

🧠 DECISION MAKING:
- If user asks to find/search something → USE search action
- If user asks about restaurants → USE open_zomato AND search
- If user asks for directions/locations → USE open_google_maps
- If user asks to open a website → USE navigate action
- For questions you can answer directly → Just answer (no action needed)
- For simple greetings (hi, hello) → Just greet back warmly, DON'T mention what you remember about them

💡 GUIDELINES:
1. BE PROACTIVE - Take action immediately when user needs something
2. EXPLAIN what you're doing briefly
3. Use emojis to be friendly 😊
4. You have memory about the user - use it ONLY when relevant to their question
5. For greetings, just say hi back naturally - don't list everything you know about them`;

  // Add memory/conversation context ONLY if not a simple greeting
  if (memoryContext && !isSimpleGreeting) {
    systemPrompt += `\n\n📚 USER MEMORY (use only when relevant, don't mention on greetings):\n${memoryContext}`;
  }
  if (searchMemoryContext && !isSimpleGreeting) {
    systemPrompt += `\n\n🔍 RELEVANT CONTEXT:\n${searchMemoryContext}`;
  }
  if (conversationContext) {
    systemPrompt += `\n\n💬 CONVERSATION HISTORY:\n${conversationContext}`;
  }

  // Add detected action hint
  if (detectedAction) {
    systemPrompt += `\n\n⚡ DETECTED INTENT: User wants to ${detectedAction}. Query: "${actionParams.query}". You SHOULD take action!`;
  }

  // Add user message to history
  addToConversationHistory('user', message);

  let response = '';
  let executedActions = [];

  // Get AI response
  if (currentMode === 'online' && geminiModel) {
    try {
      const fullPrompt = systemPrompt + '\n\nUser: ' + enhancedMessage + '\n\nAssistant (remember to include action JSON if taking action):';
      response = await chatWithGemini(fullPrompt);
    } catch (error) {
      console.error('[Gemini] Chat error:', error);
      return { response: `Error: ${error.message}`, type: 'error' };
    }
  } else {
    if (!aiReady) {
      return { response: 'AI is not ready. Please wait for the model to load.', type: 'error' };
    }
    try {
      response = await aiAgent.chat(enhancedMessage);
    } catch (error) {
      return { response: `Error: ${error.message}`, type: 'error' };
    }
  }

  // Parse and execute any actions from the response
  const actions = parseAIResponseForActions(response);

  // Also check for detected action if AI didn't include one
  if (actions.length === 0 && detectedAction) {
    // AI didn't include action, but we detected one - execute it
    if (detectedAction === 'search') {
      actions.push({ action: 'search', params: { query: actionParams.query } });
    } else if (detectedAction === 'restaurant') {
      const city = actionParams.query || 'surat';
      actions.push({ action: 'search', params: { query: `best restaurants in ${city}` } });
      actions.push({ action: 'open_zomato', params: { city } });
    } else if (detectedAction === 'navigate') {
      actions.push({ action: 'navigate', params: { url: actionParams.query } });
    } else if (detectedAction === 'maps') {
      actions.push({ action: 'open_google_maps', params: { query: actionParams.query } });
    }
  }

  // Execute all detected actions
  for (const actionData of actions) {
    const result = await executeBrowserAction(
      actionData.action,
      actionData.params || actionData,
      context?.webContentsId
    );
    executedActions.push({ ...actionData, result });
    console.log('[AI] Executed action:', actionData.action, result);
  }

  // Clean up response (remove JSON blocks for display)
  let cleanResponse = response.replace(/```json[\s\S]*?```/g, '').trim();

  // Add action confirmation if actions were executed
  if (executedActions.length > 0) {
    const actionSummary = executedActions.map(a => {
      if (a.action === 'search') return `🔍 Searching for "${a.params?.query || a.params}"`;
      if (a.action === 'open_zomato') return `🍽️ Opening Zomato`;
      if (a.action === 'open_google_maps') return `🗺️ Opening Google Maps`;
      if (a.action === 'navigate') return `🌐 Opening ${a.params?.url || a.params}`;
      return `✅ ${a.action}`;
    }).join('\n');

    if (!cleanResponse.includes('Opening') && !cleanResponse.includes('Searching')) {
      cleanResponse = actionSummary + '\n\n' + cleanResponse;
    }
  }

  // Add response to history
  addToConversationHistory('assistant', cleanResponse);

  // Remember interaction
  try {
    await knowledgeGraph.extractFromText(response, { source: 'ai_response' });
  } catch (e) { /* ignore */ }

  return {
    response: cleanResponse,
    type: 'success',
    mode: currentMode,
    actions: executedActions
  };
});

// Execute agent task (with tools)
ipcMain.handle('ai-agent-execute', async (event, { task, context }) => {
  if (!aiReady) {
    return { status: 'error', error: 'AI is not ready' };
  }

  try {
    // Set browser context for tools if provided
    if (context && context.webContentsId) {
      const webContents = require('electron').webContents.fromId(context.webContentsId);
      if (webContents) {
        aiAgent.setBrowserContext(webContents);
      }
    }

    const result = await aiAgent.run(task, (progress) => {
      // Send progress updates to renderer
      mainWindow.webContents.send('ai-agent-progress', progress);
    });

    return result;
  } catch (error) {
    console.error('[AI] Agent error:', error);
    return { status: 'error', error: error.message };
  }
});

// Remember page in AI memory
ipcMain.handle('ai-remember-page', async (event, { url, title, content, summary }) => {
  try {
    const memory = await aiMemory.rememberPage({ url, title, description: summary, summary: content });
    return { success: true, memoryId: memory?.id };
  } catch (error) {
    return { error: error.message };
  }
});

// Search AI memory
ipcMain.handle('ai-search', async (event, { query, limit = 10 }) => {
  try {
    const results = await aiMemory.search(query, limit);
    return { results };
  } catch (error) {
    return { results: [], error: error.message };
  }
});

// Get recent from AI memory
ipcMain.handle('ai-get-recent', async (event, limit = 20) => {
  try {
    const results = await aiMemory.getRecent(limit);
    return { results };
  } catch (error) {
    return { results: [], error: error.message };
  }
});

// Get AI memory stats
ipcMain.handle('ai-memory-stats', async () => {
  try {
    return aiMemory.getStats();
  } catch (error) {
    return { error: error.message };
  }
});

// Delete memory
ipcMain.handle('ai-delete-memory', async (event, id) => {
  try {
    const success = await aiMemory.deleteMemory(id);
    return { success };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Clear all memories
ipcMain.handle('ai-clear-memory', async () => {
  try {
    await aiMemory.clearAll();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Knowledge Graph Access
ipcMain.handle('ai-get-knowledge-context', async () => {
  if (knowledgeGraph) {
    try {
      const context = knowledgeGraph.getContextForAI();
      const stats = knowledgeGraph.getStats ? knowledgeGraph.getStats() : null;
      return { context: context || '', stats };
    } catch (error) {
      console.error('[KnowledgeGraph] IPC Error:', error);
      return { context: '', stats: null };
    }
  }
  return { context: '', stats: null };
});

// Clear AI Chat History
ipcMain.handle('ai-clear-history', async () => {
  if (aiAgent) {
    aiAgent.clearHistory();
    return true;
  }
  return false;
});

// Get model info
// Get model info
ipcMain.handle('ai-model-info', async () => {
  const currentMode = aiStore.get('settings.aiMode', 'online');
  return {
    available: aiReady || !!geminiModel,
    mode: currentMode,
    geminiAvailable: !!geminiModel,
    offlineAvailable: aiReady,
    ...llmEngine.getInfo(),
    downloadStatus: modelDownloader.getStatus()
  };
});

// Get AI Mode
ipcMain.handle('ai-get-mode', async () => {
  const currentMode = aiStore.get('settings.aiMode', 'online');
  return {
    mode: currentMode,
    geminiAvailable: !!geminiModel,
    offlineAvailable: aiReady
  };
});

// Switch AI Mode
ipcMain.handle('ai-switch-mode', async (event, mode) => {
  console.log(`[AI] Switching mode to: ${mode}`);

  if (mode === 'online') {
    // Check if Gemini is available
    if (!geminiModel) {
      const success = await initializeGemini();
      if (!success) {
        return { success: false, error: 'Gemini not available. Check API key.' };
      }
    }
    aiStore.set('settings.aiMode', 'online');
    mainWindow.webContents.send('ai-status', { status: 'ready', message: 'Online AI (Gemini) active' });
    return { success: true, mode: 'online', model: 'gemini-3-flash' };

  } else if (mode === 'offline') {
    // Check if offline model is ready
    if (!aiReady) {
      // Try to initialize it
      mainWindow.webContents.send('ai-status', { status: 'loading', message: 'Loading offline model...' });
      const loaded = await initializeAI();
      if (!loaded) {
        return { success: false, error: 'Offline model not available. Please download it first.' };
      }
    }
    aiStore.set('settings.aiMode', 'offline');
    mainWindow.webContents.send('ai-status', { status: 'ready', message: 'Offline AI active' });
    return { success: true, mode: 'offline', model: llmEngine.getInfo()?.modelName || 'Local Model' };
  }

  return { success: false, error: 'Invalid mode' };
});
