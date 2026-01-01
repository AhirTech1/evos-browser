// Menu Controller for EVOS Browser

class MenuController {
  constructor(tabManager, navigationController, panelController) {
    this.tabManager = tabManager;
    this.navigationController = navigationController;
    this.panelController = panelController;
    this.isMenuOpen = false;
    
    this.init();
  }

  init() {
    this.setupMenuButton();
    this.setupMenuItems();
    this.setupClickOutside();
  }

  setupMenuButton() {
    const menuBtn = document.getElementById('btn-menu');
    const menu = document.getElementById('dropdown-menu');

    if (menuBtn && menu) {
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMenu();
      });
    }
  }

  setupMenuItems() {
    // New Tab
    this.addMenuAction('menu-new-tab', () => {
      this.tabManager.createTab();
      this.hideMenu();
    });

    // New Window - Note: This will be handled by the main process
    this.addMenuAction('menu-new-window', () => {
      // For now, just create a new tab
      this.tabManager.createTab();
      this.hideMenu();
    });

    // History
    this.addMenuAction('menu-history', () => {
      this.panelController.showPanel('history');
      this.hideMenu();
    });

    // Downloads
    this.addMenuAction('menu-downloads', () => {
      this.panelController.showPanel('downloads');
      this.hideMenu();
    });

    // Bookmarks
    this.addMenuAction('menu-bookmarks', () => {
      this.panelController.showPanel('bookmarks');
      this.hideMenu();
    });

    // Zoom controls
    const zoomIn = document.getElementById('zoom-in');
    const zoomOut = document.getElementById('zoom-out');

    if (zoomIn) {
      zoomIn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.navigationController.zoomIn();
        this.updateZoomDisplay();
      });
    }

    if (zoomOut) {
      zoomOut.addEventListener('click', (e) => {
        e.stopPropagation();
        this.navigationController.zoomOut();
        this.updateZoomDisplay();
      });
    }

    // Print
    this.addMenuAction('menu-print', () => {
      this.navigationController.print();
      this.hideMenu();
    });

    // Find in page
    this.addMenuAction('menu-find', () => {
      this.navigationController.showFindBar();
      this.hideMenu();
    });

    // Developer Tools
    this.addMenuAction('menu-devtools', () => {
      this.navigationController.toggleDevTools();
      this.hideMenu();
    });

    // Settings
    this.addMenuAction('menu-settings', () => {
      window.electronAPI.openSettings();
      this.hideMenu();
    });

    // About
    this.addMenuAction('menu-about', () => {
      this.showAboutDialog();
      this.hideMenu();
    });
  }

  setupClickOutside() {
    document.addEventListener('click', (e) => {
      const menu = document.getElementById('dropdown-menu');
      const menuBtn = document.getElementById('btn-menu');
      
      if (this.isMenuOpen && menu && !menu.contains(e.target) && !menuBtn?.contains(e.target)) {
        this.hideMenu();
      }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isMenuOpen) {
        this.hideMenu();
      }
    });
  }

  addMenuAction(id, callback) {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('click', callback);
    }
  }

  toggleMenu() {
    if (this.isMenuOpen) {
      this.hideMenu();
    } else {
      this.showMenu();
    }
  }

  showMenu() {
    const menu = document.getElementById('dropdown-menu');
    if (menu) {
      menu.style.display = 'block';
      this.isMenuOpen = true;
      
      // Update zoom level display
      this.updateZoomDisplay();
    }
  }

  updateZoomDisplay() {
    const zoomLevel = document.getElementById('zoom-level');
    if (zoomLevel) {
      zoomLevel.textContent = `${this.tabManager.getZoom()}%`;
    }
  }

  hideMenu() {
    const menu = document.getElementById('dropdown-menu');
    if (menu) {
      menu.style.display = 'none';
      this.isMenuOpen = false;
    }
  }

  showAboutDialog() {
    // Create a simple modal for about
    const modal = document.createElement('div');
    modal.className = 'about-modal';
    modal.innerHTML = `
      <div class="about-modal-content">
        <div class="about-logo">
          <span style="font-size: 48px; font-weight: 300;">EVOS</span>
        </div>
        <h2>EVOS Browser</h2>
        <p class="version">Version 1.0.0</p>
        <p class="description">An AI-powered Chromium-based browser built for the future.</p>
        <p class="credits">Built with Electron</p>
        <p class="copyright">© 2024 AhirTech1</p>
        <button class="about-close-btn">Close</button>
      </div>
    `;

    // Add styles
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100000;
    `;

    const content = modal.querySelector('.about-modal-content');
    content.style.cssText = `
      background: var(--bg-primary);
      padding: 32px;
      border-radius: var(--radius-lg);
      text-align: center;
      max-width: 400px;
      box-shadow: var(--shadow-lg);
    `;

    const closeBtn = modal.querySelector('.about-close-btn');
    closeBtn.style.cssText = `
      margin-top: 24px;
      padding: 10px 24px;
      background: var(--accent-color);
      color: white;
      border: none;
      border-radius: var(--radius-md);
      cursor: pointer;
      font-size: 14px;
    `;

    closeBtn.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    document.body.appendChild(modal);
  }
}

// Export for use in other modules
window.MenuController = MenuController;
