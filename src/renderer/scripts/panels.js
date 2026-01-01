// Panel Controller for EVOS Browser (History, Bookmarks, Downloads)

class PanelController {
  constructor(tabManager) {
    this.tabManager = tabManager;
    this.currentPanel = null;
    this.searchQuery = '';
    
    this.init();
  }

  init() {
    this.setupPanelButtons();
    this.setupPanelControls();
    this.setupMenuListeners();
    this.setupDownloadListeners();
  }

  setupPanelButtons() {
    const historyBtn = document.getElementById('btn-history');
    const bookmarksBtn = document.getElementById('btn-bookmarks');
    const downloadsBtn = document.getElementById('btn-downloads');

    if (historyBtn) {
      historyBtn.addEventListener('click', () => this.togglePanel('history'));
    }

    if (bookmarksBtn) {
      bookmarksBtn.addEventListener('click', () => this.togglePanel('bookmarks'));
    }

    if (downloadsBtn) {
      downloadsBtn.addEventListener('click', () => this.togglePanel('downloads'));
    }
  }

  setupPanelControls() {
    const closeBtn = document.getElementById('panel-close');
    const searchInput = document.getElementById('panel-search-input');
    const clearBtn = document.getElementById('panel-clear-btn');

    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hidePanel());
    }

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase();
        this.refreshPanel();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearCurrentPanel());
    }

    // Close panel on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.currentPanel) {
        this.hidePanel();
      }
    });

    // Close panel when clicking outside
    document.addEventListener('click', (e) => {
      const panel = document.getElementById('side-panel');
      const historyBtn = document.getElementById('btn-history');
      const bookmarksBtn = document.getElementById('btn-bookmarks');
      const downloadsBtn = document.getElementById('btn-downloads');
      const menuBtn = document.getElementById('btn-menu');
      const dropdownMenu = document.getElementById('dropdown-menu');
      
      if (this.currentPanel && panel && !panel.contains(e.target) && 
          !historyBtn?.contains(e.target) && 
          !bookmarksBtn?.contains(e.target) && 
          !downloadsBtn?.contains(e.target) &&
          !menuBtn?.contains(e.target) &&
          !dropdownMenu?.contains(e.target)) {
        this.hidePanel();
      }
    });
  }

  setupMenuListeners() {
    window.electronAPI.onMenuShowHistory(() => this.showPanel('history'));
    window.electronAPI.onMenuShowBookmarks(() => this.showPanel('bookmarks'));
    window.electronAPI.onHistoryCleared(() => {
      if (this.currentPanel === 'history') {
        this.refreshPanel();
      }
    });
  }

  setupDownloadListeners() {
    window.electronAPI.onDownloadStarted((info) => {
      this.updateDownloadsBadge();
      if (this.currentPanel === 'downloads') {
        this.refreshPanel();
      }
    });

    window.electronAPI.onDownloadProgress((info) => {
      this.updateDownloadItem(info);
    });

    window.electronAPI.onDownloadComplete((info) => {
      this.updateDownloadsBadge();
      if (this.currentPanel === 'downloads') {
        this.refreshPanel();
      }
    });
  }

  togglePanel(panelType) {
    if (this.currentPanel === panelType) {
      this.hidePanel();
    } else {
      this.showPanel(panelType);
    }
  }

  showPanel(panelType) {
    const panel = document.getElementById('side-panel');
    const title = document.getElementById('panel-title');
    const footer = document.getElementById('panel-footer');
    const searchInput = document.getElementById('panel-search-input');

    if (!panel) return;

    this.currentPanel = panelType;
    this.searchQuery = '';
    
    if (searchInput) {
      searchInput.value = '';
    }

    // Set panel title and footer visibility
    switch (panelType) {
      case 'history':
        title.textContent = 'History';
        footer.style.display = 'block';
        document.getElementById('panel-clear-btn').textContent = 'Clear Browsing Data';
        break;
      case 'bookmarks':
        title.textContent = 'Bookmarks';
        footer.style.display = 'none';
        break;
      case 'downloads':
        title.textContent = 'Downloads';
        footer.style.display = 'block';
        document.getElementById('panel-clear-btn').textContent = 'Clear Downloads';
        break;
    }

    panel.style.display = 'flex';
    this.refreshPanel();
  }

  hidePanel() {
    const panel = document.getElementById('side-panel');
    if (panel) {
      panel.style.display = 'none';
    }
    this.currentPanel = null;
  }

  async refreshPanel() {
    if (!this.currentPanel) return;

    switch (this.currentPanel) {
      case 'history':
        await this.renderHistory();
        break;
      case 'bookmarks':
        await this.renderBookmarks();
        break;
      case 'downloads':
        await this.renderDownloads();
        break;
    }
  }

  async renderHistory() {
    const content = document.getElementById('panel-content');
    if (!content) return;

    const history = await window.electronAPI.getHistory();
    
    // Filter by search query
    let filtered = history;
    if (this.searchQuery) {
      filtered = history.filter(item => 
        item.title?.toLowerCase().includes(this.searchQuery) ||
        item.url?.toLowerCase().includes(this.searchQuery)
      );
    }

    if (filtered.length === 0) {
      content.innerHTML = this.renderEmptyState(
        'No history found',
        this.searchQuery ? 'Try a different search term' : 'Pages you visit will appear here'
      );
      return;
    }

    // Group by date
    const groups = this.groupHistoryByDate(filtered);
    
    let html = '';
    for (const [date, items] of Object.entries(groups)) {
      html += `<div class="panel-group-header">${date}</div>`;
      for (const item of items) {
        html += this.renderHistoryItem(item);
      }
    }

    content.innerHTML = html;
    this.attachHistoryListeners();
  }

  groupHistoryByDate(history) {
    const groups = {};
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    for (const item of history) {
      const date = new Date(item.timestamp).toDateString();
      let label;
      
      if (date === today) {
        label = 'Today';
      } else if (date === yesterday) {
        label = 'Yesterday';
      } else {
        label = new Date(item.timestamp).toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric'
        });
      }

      if (!groups[label]) {
        groups[label] = [];
      }
      groups[label].push(item);
    }

    return groups;
  }

  renderHistoryItem(item) {
    const time = new Date(item.timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });

    return `
      <div class="panel-item" data-id="${item.id}" data-url="${this.escapeHtml(item.url)}">
        <div class="panel-item-icon">
          <svg width="16" height="16" viewBox="0 0 16 16">
            <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5" fill="none"/>
            <path d="M8 4v4l2.5 1.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="panel-item-content">
          <div class="panel-item-title">${this.escapeHtml(item.title || 'Untitled')}</div>
          <div class="panel-item-subtitle">${this.escapeHtml(item.url)}</div>
          <div class="panel-item-meta">${time}</div>
        </div>
        <div class="panel-item-actions">
          <button class="panel-item-btn delete-btn danger" title="Remove">
            <svg width="14" height="14" viewBox="0 0 14 14">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  attachHistoryListeners() {
    const content = document.getElementById('panel-content');
    if (!content) return;

    content.querySelectorAll('.panel-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (!e.target.closest('.panel-item-actions')) {
          const url = item.dataset.url;
          this.tabManager.navigateActiveTab(url);
          this.hidePanel();
        }
      });

      const deleteBtn = item.querySelector('.delete-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await window.electronAPI.deleteHistoryItem(item.dataset.id);
          item.remove();
        });
      }
    });
  }

  async renderBookmarks() {
    const content = document.getElementById('panel-content');
    if (!content) return;

    const bookmarks = await window.electronAPI.getBookmarks();
    
    // Filter by search query
    let filtered = bookmarks;
    if (this.searchQuery) {
      filtered = bookmarks.filter(item => 
        item.title?.toLowerCase().includes(this.searchQuery) ||
        item.url?.toLowerCase().includes(this.searchQuery)
      );
    }

    if (filtered.length === 0) {
      content.innerHTML = this.renderEmptyState(
        'No bookmarks found',
        this.searchQuery ? 'Try a different search term' : 'Bookmarks you add will appear here'
      );
      return;
    }

    let html = '';
    for (const bookmark of filtered) {
      html += this.renderBookmarkItem(bookmark);
    }

    content.innerHTML = html;
    this.attachBookmarkListeners();
  }

  renderBookmarkItem(bookmark) {
    return `
      <div class="panel-item" data-id="${bookmark.id}" data-url="${this.escapeHtml(bookmark.url)}">
        <div class="panel-item-icon">
          ${bookmark.favicon 
            ? `<img src="${this.escapeHtml(bookmark.favicon)}" alt="" onerror="this.style.display='none'">`
            : `<svg width="16" height="16" viewBox="0 0 16 16">
                <path d="M3 2h10a1 1 0 011 1v12l-5.5-3L3 15V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.5" fill="none"/>
              </svg>`
          }
        </div>
        <div class="panel-item-content">
          <div class="panel-item-title">${this.escapeHtml(bookmark.title || 'Untitled')}</div>
          <div class="panel-item-subtitle">${this.escapeHtml(bookmark.url)}</div>
        </div>
        <div class="panel-item-actions">
          <button class="panel-item-btn delete-btn danger" title="Remove bookmark">
            <svg width="14" height="14" viewBox="0 0 14 14">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  attachBookmarkListeners() {
    const content = document.getElementById('panel-content');
    if (!content) return;

    content.querySelectorAll('.panel-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (!e.target.closest('.panel-item-actions')) {
          const url = item.dataset.url;
          this.tabManager.navigateActiveTab(url);
          this.hidePanel();
        }
      });

      const deleteBtn = item.querySelector('.delete-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await window.electronAPI.removeBookmark(item.dataset.id);
          item.remove();
          
          // Update bookmark button if current page was unbookmarked
          const tab = this.tabManager.getActiveTab();
          if (tab) {
            this.tabManager.updateBookmarkButton(tab.url);
          }
        });
      }
    });
  }

  async renderDownloads() {
    const content = document.getElementById('panel-content');
    if (!content) return;

    const downloads = await window.electronAPI.getDownloads();
    
    // Filter by search query
    let filtered = downloads;
    if (this.searchQuery) {
      filtered = downloads.filter(item => 
        item.filename?.toLowerCase().includes(this.searchQuery)
      );
    }

    if (filtered.length === 0) {
      content.innerHTML = this.renderEmptyState(
        'No downloads',
        this.searchQuery ? 'Try a different search term' : 'Files you download will appear here'
      );
      return;
    }

    let html = '';
    for (const download of filtered) {
      html += this.renderDownloadItem(download);
    }

    content.innerHTML = html;
  }

  renderDownloadItem(download) {
    const progress = download.size > 0 
      ? Math.round((download.receivedBytes / download.size) * 100) 
      : 0;
    
    const sizeText = this.formatFileSize(download.size);
    let statusText = '';
    let statusClass = '';

    switch (download.state) {
      case 'progressing':
        statusText = `${this.formatFileSize(download.receivedBytes)} of ${sizeText}`;
        break;
      case 'completed':
        statusText = 'Completed';
        statusClass = 'completed';
        break;
      case 'cancelled':
        statusText = 'Cancelled';
        statusClass = 'failed';
        break;
      case 'interrupted':
        statusText = 'Interrupted';
        statusClass = 'failed';
        break;
      default:
        statusText = download.state;
    }

    return `
      <div class="panel-item" data-id="${download.id}">
        <div class="panel-item-icon">
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M8 2v8M4 7l4 4 4-4M2 12h12" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="panel-item-content">
          <div class="panel-item-title">${this.escapeHtml(download.filename)}</div>
          ${download.state === 'progressing' ? `
            <div class="download-progress">
              <div class="download-progress-bar" style="width: ${progress}%"></div>
            </div>
          ` : ''}
          <div class="download-status ${statusClass}">${statusText}</div>
        </div>
      </div>
    `;
  }

  updateDownloadItem(info) {
    const item = document.querySelector(`.panel-item[data-id="${info.id}"]`);
    if (!item) return;

    const progressBar = item.querySelector('.download-progress-bar');
    const statusEl = item.querySelector('.download-status');

    if (progressBar && info.totalBytes > 0) {
      const progress = Math.round((info.receivedBytes / info.totalBytes) * 100);
      progressBar.style.width = `${progress}%`;
    }

    if (statusEl) {
      statusEl.textContent = `${this.formatFileSize(info.receivedBytes)} of ${this.formatFileSize(info.totalBytes)}`;
    }
  }

  async updateDownloadsBadge() {
    const badge = document.getElementById('downloads-badge');
    if (!badge) return;

    const downloads = await window.electronAPI.getDownloads();
    const activeDownloads = downloads.filter(d => d.state === 'progressing').length;

    if (activeDownloads > 0) {
      badge.textContent = activeDownloads;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  async clearCurrentPanel() {
    switch (this.currentPanel) {
      case 'history':
        await window.electronAPI.clearHistory();
        break;
      case 'downloads':
        await window.electronAPI.clearDownloads();
        break;
    }
    this.refreshPanel();
  }

  renderEmptyState(title, text) {
    return `
      <div class="panel-empty">
        <div class="panel-empty-icon">
          <svg width="64" height="64" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="28" stroke="currentColor" stroke-width="2" fill="none"/>
            <path d="M20 32h24M32 20v24" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.3"/>
          </svg>
        </div>
        <div class="panel-empty-title">${title}</div>
        <div class="panel-empty-text">${text}</div>
      </div>
    `;
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Export for use in other modules
window.PanelController = PanelController;
