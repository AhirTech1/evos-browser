// Main Application Entry Point for EVOS Browser

class EVOSBrowser {
  constructor() {
    this.tabManager = null;
    this.navigationController = null;
    this.panelController = null;
    this.menuController = null;
    this.aiPanel = null;
    this.settings = null;
    
    this.init();
  }

  async init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      await this.setup();
    }
  }

  async setup() {
    // Load settings
    await this.loadSettings();
    
    // Apply theme
    this.applyTheme();

    // Initialize controllers
    this.tabManager = new TabManager();
    this.navigationController = new NavigationController(this.tabManager);
    this.panelController = new PanelController(this.tabManager);
    this.menuController = new MenuController(
      this.tabManager, 
      this.navigationController, 
      this.panelController
    );

    // Initialize AI components
    await this.initializeAI();

    // Setup window controls
    this.setupWindowControls();
    
    // Setup settings listener
    this.setupSettingsListener();

    // Setup webview event forwarding for find-in-page
    this.setupWebviewEventForwarding();

    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();

    console.log('EVOS Browser initialized');
  }

  async initializeAI() {
    try {
      // Initialize AI Panel (Python backend)
      this.aiPanel = new AIPanel();
      
      // Setup AI button
      const aiBtn = document.getElementById('btn-ai');
      if (aiBtn) {
        aiBtn.addEventListener('click', () => {
          this.aiPanel.toggle();
        });
      }

      // Listen for AI navigation events
      window.addEventListener('ai-navigate', (e) => {
        this.navigationController.navigateTo(e.detail);
      });

      console.log('[EVOSBrowser] AI Panel initialized');
    } catch (error) {
      console.error('[EVOSBrowser] Failed to initialize AI Panel:', error);
    }
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+A - Toggle AI Panel
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        if (this.aiPanel) {
          this.aiPanel.toggle();
        }
      }
    });
  }

  async loadSettings() {
    try {
      this.settings = await window.electronAPI.getSettings();
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.settings = {
        homepage: 'https://www.google.com',
        searchEngine: 'google',
        themeMode: 'dark' // Default to dark mode
      };
    }
  }

  applyTheme() {
    const themeMode = this.settings?.themeMode || 'dark';
    
    if (themeMode === 'system') {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.body.classList.add('dark-theme');
      } else {
        document.body.classList.remove('dark-theme');
      }
      // Listen for system theme changes
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (this.settings?.themeMode === 'system') {
          if (e.matches) {
            document.body.classList.add('dark-theme');
          } else {
            document.body.classList.remove('dark-theme');
          }
        }
      });
    } else if (themeMode === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }

  setupWindowControls() {
    const minimizeBtn = document.getElementById('btn-minimize');
    const maximizeBtn = document.getElementById('btn-maximize');
    const closeBtn = document.getElementById('btn-close');

    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', () => {
        window.electronAPI.minimizeWindow();
      });
    }

    if (maximizeBtn) {
      maximizeBtn.addEventListener('click', async () => {
        window.electronAPI.maximizeWindow();
        // Update button icon based on window state
        const isMaximized = await window.electronAPI.isMaximized();
        this.updateMaximizeButton(isMaximized);
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        window.electronAPI.closeWindow();
      });
    }
  }

  updateMaximizeButton(isMaximized) {
    const maximizeBtn = document.getElementById('btn-maximize');
    if (maximizeBtn) {
      if (isMaximized) {
        maximizeBtn.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect width="7" height="7" x="1.5" y="3.5" fill="none" stroke="currentColor" stroke-width="1"/>
            <path d="M3.5 3.5V1.5h7v7h-2" stroke="currentColor" stroke-width="1" fill="none"/>
          </svg>
        `;
        maximizeBtn.title = 'Restore';
      } else {
        maximizeBtn.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect width="9" height="9" x="1.5" y="1.5" fill="none" stroke="currentColor" stroke-width="1"/>
          </svg>
        `;
        maximizeBtn.title = 'Maximize';
      }
    }
  }

  setupSettingsListener() {
    window.electronAPI.onSettingsUpdated((settings) => {
      this.settings = settings;
      this.applyTheme();
    });
  }

  setupWebviewEventForwarding() {
    // Forward find-in-page results from webviews
    const webviewsContainer = document.getElementById('webviews-container');
    
    if (webviewsContainer) {
      // Use MutationObserver to watch for new webviews
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.tagName === 'WEBVIEW') {
              this.attachWebviewListeners(node);
            }
          });
        });
      });

      observer.observe(webviewsContainer, { childList: true });
    }
  }

  attachWebviewListeners(webview) {
    webview.addEventListener('found-in-page', (e) => {
      const event = new CustomEvent('found-in-page', { detail: e.result });
      document.dispatchEvent(event);
    });
  }
}

// Initialize the browser
window.evosBrowser = new EVOSBrowser();
