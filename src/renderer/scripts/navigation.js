// Navigation Controller for EVOS Browser

class NavigationController {
  constructor(tabManager) {
    this.tabManager = tabManager;
    this.init();
  }

  init() {
    this.setupNavigationButtons();
    this.setupUrlBar();
    this.setupKeyboardShortcuts();
    this.setupMenuListeners();
    this.setupFindBar();
  }

  setupNavigationButtons() {
    const backBtn = document.getElementById('btn-back');
    const forwardBtn = document.getElementById('btn-forward');
    const reloadBtn = document.getElementById('btn-reload');
    const homeBtn = document.getElementById('btn-home');

    if (backBtn) {
      backBtn.addEventListener('click', () => this.tabManager.goBack());
    }

    if (forwardBtn) {
      forwardBtn.addEventListener('click', () => this.tabManager.goForward());
    }

    if (reloadBtn) {
      reloadBtn.addEventListener('click', () => {
        const tab = this.tabManager.getActiveTab();
        if (tab && tab.isLoading) {
          this.tabManager.stopActiveTab();
        } else {
          this.tabManager.reloadActiveTab();
        }
      });
    }

    if (homeBtn) {
      homeBtn.addEventListener('click', async () => {
        const homepage = await window.electronAPI.getHomepage();
        this.tabManager.navigateActiveTab(homepage);
      });
    }
  }

  setupUrlBar() {
    const urlInput = document.getElementById('url-input');
    const bookmarkBtn = document.getElementById('btn-bookmark');

    if (urlInput) {
      // Focus and select all on click
      urlInput.addEventListener('focus', () => {
        setTimeout(() => urlInput.select(), 0);
      });

      // Handle navigation on Enter
      urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const query = urlInput.value.trim();
          if (query) {
            const url = this.processInput(query);
            this.tabManager.navigateActiveTab(url);
            urlInput.blur();
          }
        } else if (e.key === 'Escape') {
          // Restore current URL
          const tab = this.tabManager.getActiveTab();
          if (tab) {
            urlInput.value = tab.url;
          }
          urlInput.blur();
        }
      });

      // Focus URL bar with Ctrl+L or F6
      document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey && e.key === 'l') || e.key === 'F6') {
          e.preventDefault();
          urlInput.focus();
        }
      });
    }

    if (bookmarkBtn) {
      bookmarkBtn.addEventListener('click', () => this.toggleBookmark());
    }
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Reload
      if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
        e.preventDefault();
        this.tabManager.reloadActiveTab(e.shiftKey);
      }

      // Stop loading
      if (e.key === 'Escape') {
        const tab = this.tabManager.getActiveTab();
        if (tab && tab.isLoading) {
          this.tabManager.stopActiveTab();
        }
      }

      // Home
      if (e.altKey && e.key === 'Home') {
        e.preventDefault();
        window.electronAPI.getHomepage().then(homepage => {
          this.tabManager.navigateActiveTab(homepage);
        });
      }

      // Zoom
      if (e.ctrlKey && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        this.zoomIn();
      }
      if (e.ctrlKey && e.key === '-') {
        e.preventDefault();
        this.zoomOut();
      }
      if (e.ctrlKey && e.key === '0') {
        e.preventDefault();
        this.zoomReset();
      }

      // Find
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        this.showFindBar();
      }

      // Print
      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        this.print();
      }

      // Developer tools
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
        e.preventDefault();
        this.toggleDevTools();
      }
    });
  }

  setupMenuListeners() {
    window.electronAPI.onMenuReload(() => this.tabManager.reloadActiveTab());
    window.electronAPI.onMenuHardReload(() => this.tabManager.reloadActiveTab(true));
    window.electronAPI.onMenuBack(() => this.tabManager.goBack());
    window.electronAPI.onMenuForward(() => this.tabManager.goForward());
    window.electronAPI.onMenuZoomIn(() => this.zoomIn());
    window.electronAPI.onMenuZoomOut(() => this.zoomOut());
    window.electronAPI.onMenuZoomReset(() => this.zoomReset());
    window.electronAPI.onMenuDevtools(() => this.toggleDevTools());
    window.electronAPI.onMenuAddBookmark(() => this.toggleBookmark());
  }

  setupFindBar() {
    const findBar = document.getElementById('find-bar');
    const findInput = document.getElementById('find-input');
    const findPrev = document.getElementById('find-prev');
    const findNext = document.getElementById('find-next');
    const findClose = document.getElementById('find-close');
    const findResults = document.getElementById('find-results');

    if (!findBar || !findInput) return;

    let currentMatch = 0;
    let totalMatches = 0;

    const updateResults = () => {
      findResults.textContent = totalMatches > 0 ? `${currentMatch}/${totalMatches}` : '0/0';
    };

    const findInPage = (forward = true) => {
      const webview = this.tabManager.getActiveWebview();
      if (webview && findInput.value) {
        webview.findInPage(findInput.value, {
          forward,
          findNext: true
        });
      }
    };

    findInput.addEventListener('input', () => {
      const webview = this.tabManager.getActiveWebview();
      if (webview) {
        if (findInput.value) {
          webview.findInPage(findInput.value);
        } else {
          webview.stopFindInPage('clearSelection');
          totalMatches = 0;
          currentMatch = 0;
          updateResults();
        }
      }
    });

    findInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        findInPage(!e.shiftKey);
      } else if (e.key === 'Escape') {
        this.hideFindBar();
      }
    });

    findNext.addEventListener('click', () => findInPage(true));
    findPrev.addEventListener('click', () => findInPage(false));
    findClose.addEventListener('click', () => this.hideFindBar());

    // Listen for find results
    document.addEventListener('found-in-page', (e) => {
      if (e.detail) {
        currentMatch = e.detail.activeMatchOrdinal;
        totalMatches = e.detail.matches;
        updateResults();
      }
    });
  }

  processInput(input) {
    // Check if it's already a valid URL
    try {
      new URL(input);
      return input;
    } catch {
      // Check if it looks like a URL (has a dot and no spaces)
      if (input.includes('.') && !input.includes(' ') && !input.includes('?')) {
        return 'https://' + input;
      }
      // Treat as search query
      return `https://www.google.com/search?q=${encodeURIComponent(input)}`;
    }
  }

  async toggleBookmark() {
    const tab = this.tabManager.getActiveTab();
    if (!tab || tab.isNewTabPage) return;

    const isBookmarked = await window.electronAPI.isBookmarked(tab.url);
    
    if (isBookmarked) {
      // Get bookmarks and find this one
      const bookmarks = await window.electronAPI.getBookmarks();
      const bookmark = bookmarks.find(b => b.url === tab.url);
      if (bookmark) {
        await window.electronAPI.removeBookmark(bookmark.id);
      }
    } else {
      await window.electronAPI.addBookmark({
        url: tab.url,
        title: tab.title,
        favicon: tab.favicon
      });
    }

    // Update UI
    this.tabManager.updateBookmarkButton(tab.url);
  }

  zoomIn() {
    const currentZoom = this.tabManager.getZoom();
    const newZoom = Math.min(currentZoom + 10, 500);
    this.tabManager.setZoom(newZoom / 100);
    this.updateZoomDisplay(newZoom);
  }

  zoomOut() {
    const currentZoom = this.tabManager.getZoom();
    const newZoom = Math.max(currentZoom - 10, 25);
    this.tabManager.setZoom(newZoom / 100);
    this.updateZoomDisplay(newZoom);
  }

  zoomReset() {
    this.tabManager.setZoom(1);
    this.updateZoomDisplay(100);
  }

  updateZoomDisplay(zoom) {
    const zoomLevel = document.getElementById('zoom-level');
    if (zoomLevel) {
      zoomLevel.textContent = `${zoom}%`;
    }
  }

  showFindBar() {
    const findBar = document.getElementById('find-bar');
    const findInput = document.getElementById('find-input');
    
    if (findBar && findInput) {
      findBar.style.display = 'flex';
      findInput.focus();
      findInput.select();
    }
  }

  hideFindBar() {
    const findBar = document.getElementById('find-bar');
    const webview = this.tabManager.getActiveWebview();
    
    if (findBar) {
      findBar.style.display = 'none';
    }
    
    if (webview) {
      webview.stopFindInPage('clearSelection');
    }
  }

  toggleDevTools() {
    const webview = this.tabManager.getActiveWebview();
    if (webview) {
      if (webview.isDevToolsOpened()) {
        webview.closeDevTools();
      } else {
        webview.openDevTools();
      }
    }
  }

  print() {
    const webview = this.tabManager.getActiveWebview();
    if (webview) {
      webview.print();
    }
  }
}

// Export for use in other modules
window.NavigationController = NavigationController;
