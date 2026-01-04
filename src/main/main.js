require('dotenv').config();
const { app, BrowserWindow, ipcMain, session, Menu, dialog, nativeTheme } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { v4: uuidv4 } = require('uuid');

// AI System imports - wrapped in try-catch to prevent app crash
let llmEngine, aiAgent, aiMemory, modelDownloader, browserTools;
let aiModulesLoaded = false;

try {
  const aiModules = require('../ai');
  llmEngine = aiModules.llmEngine;
  aiAgent = aiModules.aiAgent;
  aiMemory = aiModules.aiMemory;
  modelDownloader = aiModules.modelDownloader;
  browserTools = aiModules.browserTools;
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
    geminiModel = genAI.getGenerativeModel({ model: 'gemini-3-flash' });
    console.log('[Gemini] Initialized successfully');
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

  const result = await geminiModel.generateContent(message);
  const response = await result.response;
  return response.text();
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

// Chat with AI (simple response)
ipcMain.handle('ai-chat', async (event, { message, context }) => {
  // Check current mode
  const currentMode = aiStore.get('settings.aiMode', 'online');

  // Build enhanced message with context
  let enhancedMessage = message;
  if (context && (context.title || context.url || context.content)) {
    enhancedMessage = `[Current page: "${context.title || 'Unknown'}" at ${context.url || 'unknown URL'}]\n`;
    if (context.content) {
      const truncatedContent = context.content.substring(0, 3000);
      enhancedMessage += `[Page content excerpt: ${truncatedContent}${context.content.length > 3000 ? '...' : ''}]\n\n`;
    }
    enhancedMessage += `User: ${message}`;
  }

  // Route to appropriate engine
  if (currentMode === 'online' && geminiModel) {
    try {
      const response = await chatWithGemini(enhancedMessage);
      return { response, type: 'success', mode: 'online' };
    } catch (error) {
      console.error('[Gemini] Chat error:', error);
      return { response: `Gemini Error: ${error.message}`, type: 'error' };
    }
  } else {
    // Offline mode (node-llama-cpp)
    if (!aiReady) {
      return { response: 'AI is not ready. Please wait for the model to load.', type: 'error' };
    }

    try {
      const response = await aiAgent.chat(enhancedMessage);
      return { response, type: 'success', mode: 'offline' };
    } catch (error) {
      console.error('[AI] Chat error:', error);
      return { response: `AI Error: ${error.message}`, type: 'error' };
    }
  }
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

// Clear chat history
ipcMain.handle('ai-clear-history', async () => {
  aiAgent.clearHistory();
  return { success: true };
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
    return { success: true, mode: 'online', model: 'gemini-2.0-flash-exp' };

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
