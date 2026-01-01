// Tab Management System for EVOS Browser

class TabManager {
  constructor() {
    this.tabs = new Map();
    this.groups = new Map(); // Tab groups: groupId -> { name, color, tabIds[], collapsed }
    this.activeTabId = null;
    this.activeGroupId = null;
    this.tabCounter = 0;
    this.groupCounter = 0;

    // Color palette for groups
    this.groupColors = ['blue', 'purple', 'green', 'orange', 'pink', 'yellow', 'cyan', 'gray'];
    this.colorIndex = 0;

    this.tabsContainer = document.getElementById('tabs-container');
    this.webviewsContainer = document.getElementById('webviews-container');
    this.newTabBtn = document.getElementById('btn-new-tab');

    this.init();
  }

  init() {
    // New tab button
    this.newTabBtn.addEventListener('click', () => this.createTab());

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 't') {
        e.preventDefault();
        this.createTab();
      }
      if (e.ctrlKey && e.key === 'w') {
        e.preventDefault();
        if (this.activeTabId) {
          this.closeTab(this.activeTabId);
        }
      }
      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault();
        this.switchToNextTab(e.shiftKey);
      }
      // Switch to tab by number
      if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        const tabIds = Array.from(this.tabs.keys());
        if (index < tabIds.length) {
          this.activateTab(tabIds[index]);
        }
      }
    });

    // Listen for menu events
    window.electronAPI.onMenuNewTab(() => this.createTab());
    window.electronAPI.onMenuCloseTab(() => {
      if (this.activeTabId) {
        this.closeTab(this.activeTabId);
      }
    });

    // Listen for new tab requests (from popups, etc)
    window.electronAPI.onNewTabRequest((url) => {
      this.createTab(url);
    });

    // Create initial tab
    this.createTab();
  }

  async createTab(url = null) {
    const tabId = `tab-${++this.tabCounter}`;
    const homepage = url || await window.electronAPI.getHomepage();

    const tab = {
      id: tabId,
      title: 'New Tab',
      url: homepage,
      favicon: null,
      isLoading: false,
      canGoBack: false,
      canGoForward: false,
      zoom: 100,
      isNewTabPage: !url
    };

    this.tabs.set(tabId, tab);

    // Create tab element
    const tabElement = this.createTabElement(tab);
    // Insert before the new tab button
    this.tabsContainer.insertBefore(tabElement, this.newTabBtn);

    // Create webview or new tab page
    if (tab.isNewTabPage) {
      const newTabPage = this.createNewTabPage(tabId);
      this.webviewsContainer.appendChild(newTabPage);
    }

    const webview = this.createWebview(tabId, tab.isNewTabPage ? '' : homepage);
    this.webviewsContainer.appendChild(webview);

    // Activate the new tab
    this.activateTab(tabId);

    return tabId;
  }

  createTabElement(tab) {
    const tabEl = document.createElement('div');
    tabEl.className = 'tab';
    tabEl.id = tab.id;
    tabEl.draggable = true;

    tabEl.innerHTML = `
      <img class="tab-favicon" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path d='M8 1a7 7 0 100 14A7 7 0 008 1zm0 1.5c.5 0 1 .2 1.5.6.3.4.7 1 1 1.9H5.5c.3-.9.7-1.5 1-1.9.5-.4 1-.6 1.5-.6zM4.3 5.5h7.4c.2.7.3 1.6.3 2.5s-.1 1.8-.3 2.5H4.3c-.2-.7-.3-1.6-.3-2.5s.1-1.8.3-2.5zm-1.5 0c-.2.7-.3 1.6-.3 2.5s.1 1.8.3 2.5h-1C1.5 9.7 1.5 9 1.5 8s0-1.7.3-2.5h1zm10.4 0h1c.3.8.3 1.5.3 2.5s0 1.7-.3 2.5h-1c.2-.7.3-1.6.3-2.5s-.1-1.8-.3-2.5zM5.5 12h5c-.3.9-.7 1.5-1 1.9-.5.4-1 .6-1.5.6s-1-.2-1.5-.6c-.3-.4-.7-1-1-1.9z' fill='%239aa0a6'/></svg>" alt="">
      <span class="tab-audio" title="Tab is playing audio">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path d="M2 4h2l3-3v10L4 8H2a1 1 0 01-1-1V5a1 1 0 011-1zm7 1a2 2 0 010 2" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
        </svg>
      </span>
      <span class="tab-title">${tab.title}</span>
      <button class="tab-close" title="Close tab">
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    `;

    // Tab click - activate
    tabEl.addEventListener('click', (e) => {
      if (!e.target.closest('.tab-close')) {
        this.activateTab(tab.id);
      }
    });

    // Tab close
    tabEl.querySelector('.tab-close').addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeTab(tab.id);
    });

    // Middle click to close
    tabEl.addEventListener('auxclick', (e) => {
      if (e.button === 1) {
        e.preventDefault();
        this.closeTab(tab.id);
      }
    });

    // Drag and drop for tab reordering
    tabEl.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', tab.id);
      tabEl.classList.add('dragging');
    });

    tabEl.addEventListener('dragend', () => {
      tabEl.classList.remove('dragging');
    });

    tabEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      tabEl.classList.add('drag-over');
    });

    tabEl.addEventListener('dragleave', () => {
      tabEl.classList.remove('drag-over');
    });

    tabEl.addEventListener('drop', (e) => {
      e.preventDefault();
      tabEl.classList.remove('drag-over');
      const draggedTabId = e.dataTransfer.getData('text/plain');
      this.reorderTabs(draggedTabId, tab.id);
    });

    return tabEl;
  }

  createNewTabPage(tabId) {
    const page = document.createElement('div');
    page.className = 'new-tab-page';
    page.id = `ntp-${tabId}`;

    page.innerHTML = `
      <div class="new-tab-logo">
        <span class="new-tab-logo-text">EVOS</span>
      </div>
      <div class="new-tab-search">
        <input type="text" class="new-tab-search-input" placeholder="Search the web or enter URL" autocomplete="off">
      </div>
      <div class="shortcuts-container" id="shortcuts-${tabId}">
        <div class="shortcut-item" data-url="https://www.google.com">
          <div class="shortcut-icon">
            <img src="https://www.google.com/favicon.ico" alt="Google">
          </div>
          <span class="shortcut-title">Google</span>
        </div>
        <div class="shortcut-item" data-url="https://www.youtube.com">
          <div class="shortcut-icon">
            <img src="https://www.youtube.com/favicon.ico" alt="YouTube">
          </div>
          <span class="shortcut-title">YouTube</span>
        </div>
        <div class="shortcut-item" data-url="https://www.github.com">
          <div class="shortcut-icon">
            <img src="https://github.com/favicon.ico" alt="GitHub">
          </div>
          <span class="shortcut-title">GitHub</span>
        </div>
        <div class="shortcut-item" data-url="https://www.reddit.com">
          <div class="shortcut-icon">
            <img src="https://www.reddit.com/favicon.ico" alt="Reddit">
          </div>
          <span class="shortcut-title">Reddit</span>
        </div>
        <div class="shortcut-item" data-url="https://twitter.com">
          <div class="shortcut-icon">
            <img src="https://twitter.com/favicon.ico" alt="Twitter">
          </div>
          <span class="shortcut-title">Twitter</span>
        </div>
        <div class="shortcut-item" data-url="https://www.amazon.com">
          <div class="shortcut-icon">
            <img src="https://www.amazon.com/favicon.ico" alt="Amazon">
          </div>
          <span class="shortcut-title">Amazon</span>
        </div>
      </div>
    `;

    // Search functionality
    const searchInput = page.querySelector('.new-tab-search-input');
    searchInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        const query = searchInput.value.trim();
        if (query) {
          const url = this.processUrlInput(query);
          this.navigate(tabId, url);
        }
      }
    });

    // Shortcut clicks
    page.querySelectorAll('.shortcut-item').forEach(item => {
      item.addEventListener('click', () => {
        const url = item.dataset.url;
        this.navigate(tabId, url);
      });
    });

    return page;
  }

  createWebview(tabId, url) {
    const webview = document.createElement('webview');
    webview.id = `webview-${tabId}`;
    webview.setAttribute('allowpopups', '');
    webview.setAttribute('webpreferences', 'contextIsolation=yes');

    if (url) {
      webview.src = url;
    }

    // Webview events
    webview.addEventListener('did-start-loading', () => {
      this.updateTabLoading(tabId, true);
    });

    webview.addEventListener('did-stop-loading', () => {
      this.updateTabLoading(tabId, false);
    });

    webview.addEventListener('page-title-updated', (e) => {
      this.updateTabTitle(tabId, e.title);
    });

    webview.addEventListener('page-favicon-updated', (e) => {
      if (e.favicons && e.favicons.length > 0) {
        this.updateTabFavicon(tabId, e.favicons[0]);
      }
    });

    webview.addEventListener('did-navigate', (e) => {
      this.updateTabUrl(tabId, e.url);
      this.updateNavigationState(tabId, webview);
      this.addToHistory(e.url, this.tabs.get(tabId)?.title || 'Untitled');
    });

    webview.addEventListener('did-navigate-in-page', (e) => {
      if (e.isMainFrame) {
        this.updateTabUrl(tabId, e.url);
        this.updateNavigationState(tabId, webview);
      }
    });

    webview.addEventListener('new-window', (e) => {
      e.preventDefault();
      this.createTab(e.url);
    });

    webview.addEventListener('did-fail-load', (e) => {
      if (e.errorCode !== -3) { // Ignore aborted loads
        console.error('Failed to load:', e.errorDescription);
      }
    });

    // Update navigation buttons when focus changes
    webview.addEventListener('dom-ready', () => {
      this.updateNavigationState(tabId, webview);

      // Inject elegant scrollbar styles into the webview
      this.injectScrollbarStyles(webview);
    });

    // Media started playing
    webview.addEventListener('media-started-playing', () => {
      const tabEl = document.getElementById(tabId);
      if (tabEl) {
        tabEl.classList.add('playing-audio');
      }
    });

    webview.addEventListener('media-paused', () => {
      const tabEl = document.getElementById(tabId);
      if (tabEl) {
        tabEl.classList.remove('playing-audio');
      }
    });

    // Status bar updates
    webview.addEventListener('update-target-url', (e) => {
      if (e.url) {
        this.showStatus(e.url);
      } else {
        this.hideStatus();
      }
    });

    return webview;
  }

  activateTab(tabId) {
    // Deactivate previous tab
    if (this.activeTabId) {
      const prevTab = document.getElementById(this.activeTabId);
      const prevWebview = document.getElementById(`webview-${this.activeTabId}`);
      const prevNtp = document.getElementById(`ntp-${this.activeTabId}`);

      if (prevTab) prevTab.classList.remove('active');
      if (prevWebview) prevWebview.classList.remove('active');
      if (prevNtp) prevNtp.classList.remove('active');
    }

    // Activate new tab
    this.activeTabId = tabId;
    const tab = this.tabs.get(tabId);
    const tabEl = document.getElementById(tabId);
    const webview = document.getElementById(`webview-${tabId}`);
    const ntp = document.getElementById(`ntp-${tabId}`);

    if (tabEl) tabEl.classList.add('active');

    if (tab && tab.isNewTabPage && ntp) {
      ntp.classList.add('active');
      const searchInput = ntp.querySelector('.new-tab-search-input');
      if (searchInput) {
        setTimeout(() => searchInput.focus(), 50);
      }
    } else if (webview) {
      webview.classList.add('active');
    }

    // Update URL bar
    if (tab) {
      this.updateUrlBar(tab.url, tab.isNewTabPage);
      this.updateNavigationButtons(tab);
    }

    // Scroll tab into view
    if (tabEl) {
      tabEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }

  closeTab(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab) return;

    // Remove from group if in one (and clean up empty groups)
    if (tab.groupId) {
      const group = this.groups.get(tab.groupId);
      if (group) {
        group.tabIds = group.tabIds.filter(id => id !== tabId);
        // Delete group if now empty
        if (group.tabIds.length === 0) {
          this.groups.delete(tab.groupId);
        }
      }
    }

    // Remove elements
    const tabEl = document.getElementById(tabId);
    const webview = document.getElementById(`webview-${tabId}`);
    const ntp = document.getElementById(`ntp-${tabId}`);

    if (tabEl) tabEl.remove();
    if (webview) webview.remove();
    if (ntp) ntp.remove();

    this.tabs.delete(tabId);

    // Re-render if we have groups
    if (this.groups.size > 0) {
      this.renderTabGroups();
    }

    // If this was the active tab, activate another one
    if (this.activeTabId === tabId) {
      const tabIds = Array.from(this.tabs.keys());
      if (tabIds.length > 0) {
        this.activateTab(tabIds[tabIds.length - 1]);
      } else {
        // No tabs left, create a new one
        this.createTab();
      }
    }
  }

  switchToNextTab(reverse = false) {
    const tabIds = Array.from(this.tabs.keys());
    const currentIndex = tabIds.indexOf(this.activeTabId);

    let nextIndex;
    if (reverse) {
      nextIndex = currentIndex <= 0 ? tabIds.length - 1 : currentIndex - 1;
    } else {
      nextIndex = currentIndex >= tabIds.length - 1 ? 0 : currentIndex + 1;
    }

    this.activateTab(tabIds[nextIndex]);
  }

  reorderTabs(draggedId, targetId) {
    const draggedEl = document.getElementById(draggedId);
    const targetEl = document.getElementById(targetId);

    if (draggedEl && targetEl && draggedId !== targetId) {
      const rect = targetEl.getBoundingClientRect();
      const afterTarget = event.clientX > rect.left + rect.width / 2;

      if (afterTarget) {
        targetEl.parentNode.insertBefore(draggedEl, targetEl.nextSibling);
      } else {
        targetEl.parentNode.insertBefore(draggedEl, targetEl);
      }
    }
  }

  navigate(tabId, url) {
    const tab = this.tabs.get(tabId);
    if (!tab) return;

    // Hide new tab page
    const ntp = document.getElementById(`ntp-${tabId}`);
    if (ntp) {
      ntp.classList.remove('active');
      tab.isNewTabPage = false;
    }

    const webview = document.getElementById(`webview-${tabId}`);
    if (webview) {
      webview.classList.add('active');
      webview.src = url;
    }

    tab.url = url;
    this.updateUrlBar(url, false);
  }

  processUrlInput(input) {
    // Check if it's already a valid URL
    try {
      new URL(input);
      return input;
    } catch {
      // Check if it looks like a URL (has a dot and no spaces)
      if (input.includes('.') && !input.includes(' ')) {
        return 'https://' + input;
      }
      // Treat as search query
      return `https://www.google.com/search?q=${encodeURIComponent(input)}`;
    }
  }

  // UI Updates
  updateTabLoading(tabId, isLoading) {
    const tab = this.tabs.get(tabId);
    if (tab) {
      tab.isLoading = isLoading;
    }

    const tabEl = document.getElementById(tabId);
    if (tabEl) {
      const favicon = tabEl.querySelector('.tab-favicon');
      if (isLoading) {
        tabEl.classList.add('loading');
        favicon.classList.add('loading');
        // Store current favicon before replacing with spinner
        if (favicon.dataset.currentFavicon === undefined) {
          favicon.dataset.currentFavicon = favicon.src;
        }
        favicon.src = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><circle cx='8' cy='8' r='6' stroke='%231a73e8' stroke-width='2' fill='none' stroke-dasharray='25 10' stroke-linecap='round'/></svg>";
      } else {
        tabEl.classList.remove('loading');
        favicon.classList.remove('loading');
        // Restore favicon after loading completes
        if (tab && tab.favicon) {
          favicon.src = tab.favicon;
        } else if (favicon.dataset.currentFavicon && !favicon.dataset.currentFavicon.includes('stroke-dasharray')) {
          favicon.src = favicon.dataset.currentFavicon;
        } else {
          // Default globe icon
          favicon.src = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path d='M8 1a7 7 0 100 14A7 7 0 008 1zm0 1.5c.5 0 1 .2 1.5.6.3.4.7 1 1 1.9H5.5c.3-.9.7-1.5 1-1.9.5-.4 1-.6 1.5-.6zM4.3 5.5h7.4c.2.7.3 1.6.3 2.5s-.1 1.8-.3 2.5H4.3c-.2-.7-.3-1.6-.3-2.5s.1-1.8.3-2.5zm-1.5 0c-.2.7-.3 1.6-.3 2.5s.1 1.8.3 2.5h-1C1.5 9.7 1.5 9 1.5 8s0-1.7.3-2.5h1zm10.4 0h1c.3.8.3 1.5.3 2.5s0 1.7-.3 2.5h-1c.2-.7.3-1.6.3-2.5s-.1-1.8-.3-2.5zM5.5 12h5c-.3.9-.7 1.5-1 1.9-.5.4-1 .6-1.5.6s-1-.2-1.5-.6c-.3-.4-.7-1-1-1.9z' fill='%239aa0a6'/></svg>";
        }
        delete favicon.dataset.currentFavicon;
      }
    }

    // Update loading bar
    if (tabId === this.activeTabId) {
      const loadingBar = document.getElementById('loading-bar');
      if (loadingBar) {
        loadingBar.style.display = isLoading ? 'block' : 'none';
      }

      // Update reload button
      const reloadBtn = document.getElementById('btn-reload');
      if (reloadBtn) {
        const reloadIcon = reloadBtn.querySelector('.reload-icon');
        const stopIcon = reloadBtn.querySelector('.stop-icon');
        if (reloadIcon && stopIcon) {
          reloadIcon.style.display = isLoading ? 'none' : 'block';
          stopIcon.style.display = isLoading ? 'block' : 'none';
        }
      }
    }
  }

  updateTabTitle(tabId, title) {
    const tab = this.tabs.get(tabId);
    if (tab) {
      tab.title = title;
    }

    const tabEl = document.getElementById(tabId);
    if (tabEl) {
      const titleEl = tabEl.querySelector('.tab-title');
      if (titleEl) {
        titleEl.textContent = title;
        titleEl.title = title;
      }
    }

    // Update document title if this is the active tab
    if (tabId === this.activeTabId) {
      document.title = title ? `${title} - EVOS Browser` : 'EVOS Browser';
    }
  }

  updateTabFavicon(tabId, faviconUrl) {
    const tab = this.tabs.get(tabId);
    if (tab) {
      tab.favicon = faviconUrl;
    }

    const tabEl = document.getElementById(tabId);
    if (tabEl && !tab?.isLoading) {
      const favicon = tabEl.querySelector('.tab-favicon');
      if (favicon) {
        favicon.src = faviconUrl;
        favicon.onerror = () => {
          favicon.src = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path d='M8 1a7 7 0 100 14A7 7 0 008 1zm0 1.5c.5 0 1 .2 1.5.6.3.4.7 1 1 1.9H5.5c.3-.9.7-1.5 1-1.9.5-.4 1-.6 1.5-.6zM4.3 5.5h7.4c.2.7.3 1.6.3 2.5s-.1 1.8-.3 2.5H4.3c-.2-.7-.3-1.6-.3-2.5s.1-1.8.3-2.5zm-1.5 0c-.2.7-.3 1.6-.3 2.5s.1 1.8.3 2.5h-1C1.5 9.7 1.5 9 1.5 8s0-1.7.3-2.5h1zm10.4 0h1c.3.8.3 1.5.3 2.5s0 1.7-.3 2.5h-1c.2-.7.3-1.6.3-2.5s-.1-1.8-.3-2.5zM5.5 12h5c-.3.9-.7 1.5-1 1.9-.5.4-1 .6-1.5.6s-1-.2-1.5-.6c-.3-.4-.7-1-1-1.9z' fill='%239aa0a6'/></svg>";
        };
      }
    }
  }

  updateTabUrl(tabId, url) {
    const tab = this.tabs.get(tabId);
    if (tab) {
      tab.url = url;
      tab.isNewTabPage = false;
    }

    if (tabId === this.activeTabId) {
      this.updateUrlBar(url, false);
    }
  }

  updateUrlBar(url, isNewTab) {
    const urlInput = document.getElementById('url-input');
    const securityIndicator = document.getElementById('security-indicator');

    if (urlInput) {
      urlInput.value = isNewTab ? '' : url;
    }

    if (securityIndicator) {
      const secureIcon = securityIndicator.querySelector('.secure-icon');
      const insecureIcon = securityIndicator.querySelector('.insecure-icon');

      if (url && url.startsWith('https://')) {
        securityIndicator.classList.add('secure');
        securityIndicator.classList.remove('insecure');
        securityIndicator.title = 'Connection is secure';
        if (secureIcon) secureIcon.style.display = 'block';
        if (insecureIcon) insecureIcon.style.display = 'none';
      } else if (url && url.startsWith('http://')) {
        securityIndicator.classList.remove('secure');
        securityIndicator.classList.add('insecure');
        securityIndicator.title = 'Connection is not secure';
        if (secureIcon) secureIcon.style.display = 'none';
        if (insecureIcon) insecureIcon.style.display = 'block';
      } else {
        securityIndicator.classList.remove('secure', 'insecure');
        if (secureIcon) secureIcon.style.display = 'none';
        if (insecureIcon) insecureIcon.style.display = 'none';
      }
    }

    // Update bookmark button state
    this.updateBookmarkButton(url);
  }

  async updateBookmarkButton(url) {
    const bookmarkBtn = document.getElementById('btn-bookmark');
    if (!bookmarkBtn) return;

    const isBookmarked = await window.electronAPI.isBookmarked(url);
    const emptyIcon = bookmarkBtn.querySelector('.bookmark-empty');
    const filledIcon = bookmarkBtn.querySelector('.bookmark-filled');

    if (isBookmarked) {
      bookmarkBtn.classList.add('bookmarked');
      if (emptyIcon) emptyIcon.style.display = 'none';
      if (filledIcon) filledIcon.style.display = 'block';
    } else {
      bookmarkBtn.classList.remove('bookmarked');
      if (emptyIcon) emptyIcon.style.display = 'block';
      if (filledIcon) filledIcon.style.display = 'none';
    }
  }

  updateNavigationState(tabId, webview) {
    const tab = this.tabs.get(tabId);
    if (tab && webview) {
      tab.canGoBack = webview.canGoBack();
      tab.canGoForward = webview.canGoForward();

      if (tabId === this.activeTabId) {
        this.updateNavigationButtons(tab);
      }
    }
  }

  updateNavigationButtons(tab) {
    const backBtn = document.getElementById('btn-back');
    const forwardBtn = document.getElementById('btn-forward');

    if (backBtn) {
      backBtn.disabled = !tab.canGoBack;
    }
    if (forwardBtn) {
      forwardBtn.disabled = !tab.canGoForward;
    }
  }

  showStatus(text) {
    const statusBar = document.getElementById('status-bar');
    const statusText = document.getElementById('status-text');

    if (statusBar && statusText) {
      statusText.textContent = text;
      statusBar.style.display = 'block';
    }
  }

  hideStatus() {
    const statusBar = document.getElementById('status-bar');
    if (statusBar) {
      statusBar.style.display = 'none';
    }
  }

  async addToHistory(url, title) {
    if (url && !url.startsWith('about:') && !url.startsWith('chrome:')) {
      await window.electronAPI.addToHistory({ url, title });
    }
  }

  // Public methods for external access
  getActiveTab() {
    return this.tabs.get(this.activeTabId);
  }

  getActiveWebview() {
    if (this.activeTabId) {
      return document.getElementById(`webview-${this.activeTabId}`);
    }
    return null;
  }

  navigateActiveTab(url) {
    if (this.activeTabId) {
      this.navigate(this.activeTabId, url);
    }
  }

  reloadActiveTab(hardReload = false) {
    const webview = this.getActiveWebview();
    if (webview) {
      if (hardReload) {
        webview.reloadIgnoringCache();
      } else {
        webview.reload();
      }
    }
  }

  stopActiveTab() {
    const webview = this.getActiveWebview();
    if (webview) {
      webview.stop();
    }
  }

  goBack() {
    const webview = this.getActiveWebview();
    if (webview && webview.canGoBack()) {
      webview.goBack();
    }
  }

  goForward() {
    const webview = this.getActiveWebview();
    if (webview && webview.canGoForward()) {
      webview.goForward();
    }
  }

  setZoom(zoomFactor) {
    const webview = this.getActiveWebview();
    const tab = this.getActiveTab();

    if (webview && tab) {
      tab.zoom = Math.round(zoomFactor * 100);
      webview.setZoomFactor(zoomFactor);
    }
  }

  getZoom() {
    const tab = this.getActiveTab();
    return tab ? tab.zoom : 100;
  }

  // Inject elegant scrollbar styles into webviews
  injectScrollbarStyles(webview) {
    const scrollbarCSS = `
      ::-webkit-scrollbar {
        width: 10px;
        height: 10px;
      }
      ::-webkit-scrollbar-track {
        background: transparent;
      }
      ::-webkit-scrollbar-thumb {
        background: rgba(128, 128, 128, 0.4);
        border-radius: 5px;
        border: 2px solid transparent;
        background-clip: content-box;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: rgba(128, 128, 128, 0.6);
        border: 2px solid transparent;
        background-clip: content-box;
      }
      ::-webkit-scrollbar-corner {
        background: transparent;
      }
    `;

    try {
      webview.insertCSS(scrollbarCSS);
    } catch (error) {
      console.error('Failed to inject scrollbar styles:', error);
    }
  }

  // ==========================================
  // Tab Groups Management
  // ==========================================

  /**
   * Create a new tab group
   * @param {string} name - Group name
   * @param {string[]} tabIds - Array of tab IDs to include
   * @param {string} color - Optional color
   */
  createGroup(name, tabIds = [], color = null) {
    const groupId = `group-${++this.groupCounter}`;
    const groupColor = color || this.groupColors[this.colorIndex++ % this.groupColors.length];

    const group = {
      id: groupId,
      name: name,
      color: groupColor,
      tabIds: [...tabIds],
      collapsed: false
    };

    this.groups.set(groupId, group);

    // Update tab objects to reference their group
    tabIds.forEach(tabId => {
      const tab = this.tabs.get(tabId);
      if (tab) tab.groupId = groupId;
    });

    // Render the groups
    this.renderTabGroups();

    return groupId;
  }

  /**
   * Add a tab to an existing group
   */
  addTabToGroup(tabId, groupId) {
    const group = this.groups.get(groupId);
    const tab = this.tabs.get(tabId);

    if (!group || !tab) return;

    // Remove from old group if any
    if (tab.groupId && tab.groupId !== groupId) {
      this.removeTabFromGroup(tabId);
    }

    group.tabIds.push(tabId);
    tab.groupId = groupId;

    this.renderTabGroups();
  }

  /**
   * Remove a tab from its group
   */
  removeTabFromGroup(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab || !tab.groupId) return;

    const group = this.groups.get(tab.groupId);
    if (group) {
      group.tabIds = group.tabIds.filter(id => id !== tabId);

      // Delete group if empty
      if (group.tabIds.length === 0) {
        this.groups.delete(tab.groupId);
      }
    }

    tab.groupId = null;
    this.renderTabGroups();
  }

  /**
   * Toggle group collapsed state
   */
  toggleGroupCollapse(groupId) {
    const group = this.groups.get(groupId);
    if (!group) return;

    // Expand this group, collapse others
    this.groups.forEach((g, id) => {
      if (id === groupId) {
        g.collapsed = !g.collapsed;
        if (!g.collapsed) this.activeGroupId = id;
      } else if (!g.collapsed && id !== groupId) {
        g.collapsed = true;
      }
    });

    this.renderTabGroups();
  }

  /**
   * Delete a group (tabs remain ungrouped)
   */
  deleteGroup(groupId) {
    const group = this.groups.get(groupId);
    if (!group) return;

    // Ungroup all tabs
    group.tabIds.forEach(tabId => {
      const tab = this.tabs.get(tabId);
      if (tab) tab.groupId = null;
    });

    this.groups.delete(groupId);
    this.renderTabGroups();
  }

  /**
   * Rename a group
   */
  renameGroup(groupId, newName) {
    const group = this.groups.get(groupId);
    if (group) {
      group.name = newName;
      this.renderTabGroups();
    }
  }

  /**
   * Render all tab groups and ungrouped tabs
   */
  renderTabGroups() {
    // Clear current tabs (except new tab button)
    const existingTabs = this.tabsContainer.querySelectorAll('.tab, .tab-group, .tabs-ungrouped');
    existingTabs.forEach(el => el.remove());

    // Collect ungrouped tabs
    const groupedTabIds = new Set();
    this.groups.forEach(group => {
      group.tabIds.forEach(id => groupedTabIds.add(id));
    });

    const ungroupedTabIds = Array.from(this.tabs.keys()).filter(id => !groupedTabIds.has(id));

    // Render each group
    this.groups.forEach((group, groupId) => {
      const groupEl = this.createGroupElement(group);
      this.tabsContainer.insertBefore(groupEl, this.newTabBtn);
    });

    // Render ungrouped tabs
    if (ungroupedTabIds.length > 0) {
      const ungroupedContainer = document.createElement('div');
      ungroupedContainer.className = 'tabs-ungrouped';

      ungroupedTabIds.forEach(tabId => {
        const tab = this.tabs.get(tabId);
        if (tab) {
          const tabEl = this.createTabElement(tab);
          ungroupedContainer.appendChild(tabEl);
        }
      });

      this.tabsContainer.insertBefore(ungroupedContainer, this.newTabBtn);
    }

    // Reactivate current tab styling
    if (this.activeTabId) {
      const activeTabEl = this.tabsContainer.querySelector(`[data-tab-id="${this.activeTabId}"]`);
      if (activeTabEl) activeTabEl.classList.add('active');
    }
  }

  /**
   * Create DOM element for a tab group
   */
  createGroupElement(group) {
    const groupEl = document.createElement('div');
    groupEl.className = `tab-group ${group.collapsed ? 'collapsed' : ''}`;
    groupEl.dataset.groupId = group.id;
    groupEl.dataset.color = group.color;

    // Header
    const header = document.createElement('div');
    header.className = 'tab-group-header';
    header.innerHTML = `
      <div class="tab-group-color"></div>
      <span class="tab-group-name">${group.name}</span>
      <span class="tab-group-count">${group.tabIds.length}</span>
      <span class="tab-group-toggle">▾</span>
    `;

    // Click to toggle collapse
    header.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleGroupCollapse(group.id);
    });

    // Right-click for context menu
    header.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showGroupContextMenu(group.id, e.clientX, e.clientY);
    });

    groupEl.appendChild(header);

    // Tabs container
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'tab-group-tabs';

    group.tabIds.forEach(tabId => {
      const tab = this.tabs.get(tabId);
      if (tab) {
        const tabEl = this.createTabElement(tab);
        tabsContainer.appendChild(tabEl);
      }
    });

    groupEl.appendChild(tabsContainer);

    return groupEl;
  }

  /**
   * Show context menu for group
   */
  showGroupContextMenu(groupId, x, y) {
    // Remove any existing menu
    document.querySelectorAll('.tab-group-menu').forEach(m => m.remove());

    const group = this.groups.get(groupId);
    if (!group) return;

    const menu = document.createElement('div');
    menu.className = 'tab-group-menu visible';
    menu.style.position = 'fixed';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    menu.innerHTML = `
      <div class="tab-group-menu-item" data-action="rename">✏️ Rename Group</div>
      <div class="tab-group-menu-item" data-action="ungroup">📤 Ungroup Tabs</div>
      <div class="tab-group-menu-item danger" data-action="close-all">❌ Close All Tabs</div>
    `;

    menu.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      if (action === 'rename') {
        menu.remove();
        this.showRenameDialog(groupId, group.name);
      } else if (action === 'ungroup') {
        this.deleteGroup(groupId);
        menu.remove();
      } else if (action === 'close-all') {
        const tabIds = [...group.tabIds];
        tabIds.forEach(tabId => this.closeTab(tabId));
        menu.remove();
      }
    });

    document.body.appendChild(menu);

    // Close on outside click
    const closeMenu = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  }

  /**
   * Show rename dialog for a group
   */
  showRenameDialog(groupId, currentName) {
    if (window.agentManager) {
      const body = `
        <input type="text" id="group-rename-input" value="${currentName}" 
               style="width: 100%; padding: 12px; border-radius: 8px; background: rgba(0,0,0,0.3); 
                      border: 1px solid rgba(255,255,255,0.2); color: #fff; font-size: 14px;"
               autofocus>
      `;

      window.agentManager.showModal('Rename Group', body, [
        {
          id: 'save',
          label: 'Save',
          primary: true,
          onClick: () => {
            const newName = document.getElementById('group-rename-input')?.value;
            if (newName && newName.trim()) {
              this.renameGroup(groupId, newName.trim());
            }
          }
        },
        { id: 'cancel', label: 'Cancel' }
      ], { icon: '✏️' });

      // Focus input after modal appears
      setTimeout(() => {
        const input = document.getElementById('group-rename-input');
        if (input) {
          input.focus();
          input.select();
        }
      }, 100);
    }
  }

  /**
   * Get all groups
   */
  getGroups() {
    return Array.from(this.groups.values());
  }

  /**
   * Create groups from AI analysis
   */
  applyAIGroups(groupsData) {
    // Clear existing groups
    this.groups.clear();
    this.tabs.forEach(tab => tab.groupId = null);

    // Get all tab IDs in order
    const allTabIds = Array.from(this.tabs.keys());

    // Create each group
    groupsData.forEach(gData => {
      const tabIds = gData.tabIndices
        .map(idx => allTabIds[idx])
        .filter(Boolean);

      if (tabIds.length > 0) {
        this.createGroup(gData.name, tabIds);
      }
    });

    // Expand first group
    const firstGroup = this.groups.values().next().value;
    if (firstGroup) {
      firstGroup.collapsed = false;
      this.activeGroupId = firstGroup.id;
    }
  }
}

// Export for use in other modules
window.TabManager = TabManager;
