/**
 * EVOS Task Dashboard
 * Visual task management with performance analytics
 * Access via Ctrl+Shift+D or button in AI panel
 */

class TaskDashboard {
    constructor() {
        this.isOpen = false;
        this.activeTab = 'overview';
        this.stats = {
            tasksCompleted: 0,
            timeSavedMinutes: 0,
            pagesAnalyzed: 0,
            formsAutofilled: 0
        };

        this.loadStats();
        this.createUI();
        this.attachEventListeners();
    }

    loadStats() {
        try {
            const saved = localStorage.getItem('evos-dashboard-stats');
            if (saved) {
                this.stats = { ...this.stats, ...JSON.parse(saved) };
            }
        } catch (e) {
            console.error('[Dashboard] Load error:', e);
        }
    }

    saveStats() {
        try {
            localStorage.setItem('evos-dashboard-stats', JSON.stringify(this.stats));
        } catch (e) {
            console.error('[Dashboard] Save error:', e);
        }
    }

    incrementStat(stat, amount = 1) {
        if (this.stats[stat] !== undefined) {
            this.stats[stat] += amount;
            this.saveStats();
            this.updateUI();
        }
    }

    createUI() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'task-dashboard-overlay';
        this.overlay.innerHTML = `
      <div class="task-dashboard">
        <div class="task-dashboard-header">
          <div class="task-dashboard-title">
            <span class="task-dashboard-logo">📊</span>
            <h2>EVOS Dashboard</h2>
          </div>
          <div class="task-dashboard-tabs">
            <button class="tab-btn active" data-tab="overview">Overview</button>
            <button class="tab-btn" data-tab="history">History</button>
            <button class="tab-btn" data-tab="analytics">Analytics</button>
          </div>
          <button class="task-dashboard-close">×</button>
        </div>
        
        <div class="task-dashboard-content">
          <!-- Overview Tab -->
          <div class="tab-content active" id="tab-overview">
            <div class="stats-grid">
              <div class="stat-card gradient-purple">
                <div class="stat-icon">🚀</div>
                <div class="stat-info">
                  <span class="stat-value" id="stat-tasks-completed">0</span>
                  <span class="stat-label">Tasks Completed</span>
                </div>
              </div>
              <div class="stat-card gradient-blue">
                <div class="stat-icon">⏱️</div>
                <div class="stat-info">
                  <span class="stat-value" id="stat-time-saved">0 min</span>
                  <span class="stat-label">Time Saved</span>
                </div>
              </div>
              <div class="stat-card gradient-green">
                <div class="stat-icon">📄</div>
                <div class="stat-info">
                  <span class="stat-value" id="stat-pages-analyzed">0</span>
                  <span class="stat-label">Pages Analyzed</span>
                </div>
              </div>
              <div class="stat-card gradient-orange">
                <div class="stat-icon">✏️</div>
                <div class="stat-info">
                  <span class="stat-value" id="stat-forms-filled">0</span>
                  <span class="stat-label">Forms Autofilled</span>
                </div>
              </div>
            </div>
            
            <div class="dashboard-section">
              <h3>Quick Actions</h3>
              <div class="quick-actions-grid">
                <button class="quick-action-card" data-action="new-task">
                  <span class="qa-icon">➕</span>
                  <span class="qa-text">New Task</span>
                </button>
                <button class="quick-action-card" data-action="view-queue">
                  <span class="qa-icon">📋</span>
                  <span class="qa-text">View Queue</span>
                </button>
                <button class="quick-action-card" data-action="macros">
                  <span class="qa-icon">🔄</span>
                  <span class="qa-text">My Macros</span>
                </button>
                <button class="quick-action-card" data-action="memories">
                  <span class="qa-icon">🧠</span>
                  <span class="qa-text">AI Memory</span>
                </button>
              </div>
            </div>
            
            <div class="dashboard-section">
              <h3>Recent Activity</h3>
              <div class="activity-list" id="recent-activity">
                <div class="activity-empty">No recent activity</div>
              </div>
            </div>
          </div>
          
          <!-- History Tab -->
          <div class="tab-content" id="tab-history">
            <div class="history-controls">
              <input type="text" id="history-search" placeholder="Search history..." class="history-search">
              <select id="history-filter" class="history-filter">
                <option value="all">All Types</option>
                <option value="ai">AI Tasks</option>
                <option value="macro">Macros</option>
                <option value="research">Research</option>
                <option value="form">Forms</option>
              </select>
            </div>
            <div class="history-list" id="history-list">
              <div class="history-empty">No task history yet</div>
            </div>
          </div>
          
          <!-- Analytics Tab -->
          <div class="tab-content" id="tab-analytics">
            <div class="analytics-grid">
              <div class="analytics-card">
                <h4>Tasks by Type</h4>
                <div class="analytics-chart" id="chart-tasks-by-type">
                  <div class="chart-bar-container">
                    <div class="chart-bar gradient-purple" style="height: 60%;">
                      <span class="chart-label">AI</span>
                    </div>
                    <div class="chart-bar gradient-blue" style="height: 30%;">
                      <span class="chart-label">Macro</span>
                    </div>
                    <div class="chart-bar gradient-green" style="height: 45%;">
                      <span class="chart-label">Research</span>
                    </div>
                    <div class="chart-bar gradient-orange" style="height: 25%;">
                      <span class="chart-label">Form</span>
                    </div>
                  </div>
                </div>
              </div>
              <div class="analytics-card">
                <h4>Productivity Score</h4>
                <div class="productivity-score">
                  <div class="score-ring" id="productivity-ring">
                    <span class="score-value">85</span>
                  </div>
                  <p class="score-label">Great job! You're 85% more productive with AI assistance.</p>
                </div>
              </div>
              <div class="analytics-card wide">
                <h4>Weekly Activity</h4>
                <div class="weekly-activity" id="weekly-activity">
                  <div class="day-bar" data-day="Mon" style="--height: 40%;"></div>
                  <div class="day-bar" data-day="Tue" style="--height: 70%;"></div>
                  <div class="day-bar" data-day="Wed" style="--height: 55%;"></div>
                  <div class="day-bar" data-day="Thu" style="--height: 85%;"></div>
                  <div class="day-bar" data-day="Fri" style="--height: 60%;"></div>
                  <div class="day-bar" data-day="Sat" style="--height: 30%;"></div>
                  <div class="day-bar" data-day="Sun" style="--height: 20%;"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

        document.body.appendChild(this.overlay);
        this.dashboard = this.overlay.querySelector('.task-dashboard');
        this.injectStyles();
    }

    injectStyles() {
        if (document.getElementById('task-dashboard-styles')) return;

        const style = document.createElement('style');
        style.id = 'task-dashboard-styles';
        style.textContent = `
      .task-dashboard-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(10px);
        z-index: 10003;
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .task-dashboard-overlay.active {
        opacity: 1;
        visibility: visible;
      }
      
      .task-dashboard {
        background: linear-gradient(135deg, rgba(20, 20, 35, 0.98), rgba(15, 15, 25, 0.99));
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 24px;
        width: 900px;
        max-width: 95vw;
        max-height: 85vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 30px 100px rgba(0, 0, 0, 0.6);
        transform: scale(0.95) translateY(20px);
        transition: transform 0.3s ease;
        overflow: hidden;
      }
      
      .task-dashboard-overlay.active .task-dashboard {
        transform: scale(1) translateY(0);
      }
      
      .task-dashboard-header {
        display: flex;
        align-items: center;
        padding: 20px 24px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        gap: 20px;
      }
      
      .task-dashboard-title {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      
      .task-dashboard-logo {
        font-size: 28px;
      }
      
      .task-dashboard-title h2 {
        margin: 0;
        font-size: 20px;
        color: white;
        font-weight: 600;
      }
      
      .task-dashboard-tabs {
        display: flex;
        gap: 4px;
        flex: 1;
        justify-content: center;
      }
      
      .tab-btn {
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.5);
        padding: 10px 20px;
        border-radius: 10px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s;
      }
      
      .tab-btn:hover {
        color: rgba(255, 255, 255, 0.8);
        background: rgba(255, 255, 255, 0.05);
      }
      
      .tab-btn.active {
        color: white;
        background: rgba(99, 102, 241, 0.2);
      }
      
      .task-dashboard-close {
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.5);
        font-size: 28px;
        cursor: pointer;
        padding: 4px 12px;
        transition: color 0.2s;
      }
      
      .task-dashboard-close:hover {
        color: white;
      }
      
      .task-dashboard-content {
        flex: 1;
        overflow-y: auto;
        padding: 24px;
      }
      
      .tab-content {
        display: none;
      }
      
      .tab-content.active {
        display: block;
      }
      
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
        margin-bottom: 32px;
      }
      
      .stat-card {
        border-radius: 16px;
        padding: 20px;
        display: flex;
        align-items: center;
        gap: 16px;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      
      .stat-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      }
      
      .gradient-purple { background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.1)); border: 1px solid rgba(99, 102, 241, 0.3); }
      .gradient-blue { background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.1)); border: 1px solid rgba(59, 130, 246, 0.3); }
      .gradient-green { background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.1)); border: 1px solid rgba(16, 185, 129, 0.3); }
      .gradient-orange { background: linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.1)); border: 1px solid rgba(245, 158, 11, 0.3); }
      
      .stat-icon {
        font-size: 32px;
      }
      
      .stat-info {
        display: flex;
        flex-direction: column;
      }
      
      .stat-value {
        font-size: 28px;
        font-weight: 700;
        color: white;
      }
      
      .stat-label {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
      }
      
      .dashboard-section {
        margin-bottom: 32px;
      }
      
      .dashboard-section h3 {
        color: white;
        font-size: 16px;
        margin: 0 0 16px 0;
        font-weight: 600;
      }
      
      .quick-actions-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
      }
      
      .quick-action-card {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .quick-action-card:hover {
        background: rgba(99, 102, 241, 0.1);
        border-color: rgba(99, 102, 241, 0.3);
        transform: translateY(-2px);
      }
      
      .qa-icon {
        font-size: 28px;
      }
      
      .qa-text {
        color: white;
        font-size: 13px;
        font-weight: 500;
      }
      
      .activity-list {
        background: rgba(255, 255, 255, 0.02);
        border-radius: 12px;
        overflow: hidden;
      }
      
      .activity-empty, .history-empty {
        text-align: center;
        padding: 40px;
        color: rgba(255, 255, 255, 0.4);
      }
      
      .activity-item {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 14px 18px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        transition: background 0.2s;
      }
      
      .activity-item:hover {
        background: rgba(255, 255, 255, 0.03);
      }
      
      .activity-item:last-child {
        border-bottom: none;
      }
      
      .activity-icon {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
      }
      
      .activity-info {
        flex: 1;
      }
      
      .activity-title {
        color: white;
        font-size: 14px;
        margin: 0 0 4px 0;
      }
      
      .activity-time {
        color: rgba(255, 255, 255, 0.4);
        font-size: 12px;
      }
      
      .activity-status {
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 500;
      }
      
      .activity-status.completed { background: rgba(16, 185, 129, 0.2); color: #10b981; }
      .activity-status.failed { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
      .activity-status.running { background: rgba(99, 102, 241, 0.2); color: #6366f1; }
      
      /* History Tab */
      .history-controls {
        display: flex;
        gap: 12px;
        margin-bottom: 20px;
      }
      
      .history-search {
        flex: 1;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        padding: 12px 16px;
        color: white;
        font-size: 14px;
        outline: none;
      }
      
      .history-filter {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        padding: 12px 16px;
        color: white;
        font-size: 14px;
        outline: none;
      }
      
      .history-list {
        background: rgba(255, 255, 255, 0.02);
        border-radius: 12px;
        max-height: 500px;
        overflow-y: auto;
      }
      
      /* Analytics Tab */
      .analytics-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 20px;
      }
      
      .analytics-card {
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 16px;
        padding: 24px;
      }
      
      .analytics-card.wide {
        grid-column: span 2;
      }
      
      .analytics-card h4 {
        color: white;
        margin: 0 0 20px 0;
        font-size: 15px;
        font-weight: 500;
      }
      
      .chart-bar-container {
        display: flex;
        align-items: flex-end;
        justify-content: space-around;
        height: 120px;
        padding-top: 20px;
      }
      
      .chart-bar {
        width: 50px;
        border-radius: 8px 8px 0 0;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        padding-bottom: 8px;
        transition: height 0.5s ease;
      }
      
      .chart-label {
        color: white;
        font-size: 11px;
        font-weight: 500;
      }
      
      .productivity-score {
        display: flex;
        align-items: center;
        gap: 20px;
      }
      
      .score-ring {
        width: 100px;
        height: 100px;
        border-radius: 50%;
        background: conic-gradient(#6366f1 0% 85%, rgba(255, 255, 255, 0.1) 85% 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      }
      
      .score-ring::after {
        content: '';
        position: absolute;
        inset: 8px;
        background: rgba(20, 20, 35, 1);
        border-radius: 50%;
      }
      
      .score-value {
        position: relative;
        z-index: 1;
        font-size: 32px;
        font-weight: 700;
        color: #6366f1;
      }
      
      .score-label {
        color: rgba(255, 255, 255, 0.6);
        font-size: 13px;
        margin: 0;
        flex: 1;
      }
      
      .weekly-activity {
        display: flex;
        align-items: flex-end;
        justify-content: space-around;
        height: 150px;
        padding: 20px 0;
      }
      
      .day-bar {
        width: 60px;
        background: linear-gradient(to top, rgba(99, 102, 241, 0.8), rgba(139, 92, 246, 0.6));
        border-radius: 8px 8px 0 0;
        height: var(--height, 50%);
        transition: height 0.5s ease;
        position: relative;
      }
      
      .day-bar::after {
        content: attr(data-day);
        position: absolute;
        bottom: -24px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 12px;
        color: rgba(255, 255, 255, 0.5);
      }
      
      @media (max-width: 768px) {
        .stats-grid {
          grid-template-columns: repeat(2, 1fr);
        }
        .quick-actions-grid {
          grid-template-columns: repeat(2, 1fr);
        }
        .analytics-grid {
          grid-template-columns: 1fr;
        }
        .analytics-card.wide {
          grid-column: span 1;
        }
      }
    `;
        document.head.appendChild(style);
    }

    attachEventListeners() {
        // Keyboard shortcut
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.code === 'KeyD') {
                e.preventDefault();
                this.toggle();
            }
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });

        // Close button
        this.overlay.querySelector('.task-dashboard-close').addEventListener('click', () => this.close());

        // Click outside
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });

        // Tabs
        this.overlay.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchTab(btn.dataset.tab);
            });
        });

        // Quick actions
        this.overlay.querySelectorAll('.quick-action-card').forEach(card => {
            card.addEventListener('click', () => {
                this.handleQuickAction(card.dataset.action);
            });
        });

        // History search
        const historySearch = this.overlay.querySelector('#history-search');
        if (historySearch) {
            historySearch.addEventListener('input', () => this.filterHistory());
        }

        const historyFilter = this.overlay.querySelector('#history-filter');
        if (historyFilter) {
            historyFilter.addEventListener('change', () => this.filterHistory());
        }
    }

    switchTab(tabName) {
        this.activeTab = tabName;

        // Update tab buttons
        this.overlay.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab content
        this.overlay.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabName}`);
        });

        // Load tab data
        if (tabName === 'history') {
            this.loadHistory();
        }
    }

    handleQuickAction(action) {
        this.close();

        switch (action) {
            case 'new-task':
                if (window.quickActionBar) {
                    window.quickActionBar.open();
                }
                break;
            case 'view-queue':
                if (window.taskQueue) {
                    window.taskQueue.showPanel();
                }
                break;
            case 'macros':
                if (window.macroAgent) {
                    window.macroAgent.showMacrosList();
                }
                break;
            case 'memories':
                if (window.aiPanel) {
                    window.aiPanel.open();
                    window.aiPanel.switchTab('memory');
                }
                break;
        }
    }

    updateUI() {
        // Update stats
        this.overlay.querySelector('#stat-tasks-completed').textContent = this.stats.tasksCompleted;
        this.overlay.querySelector('#stat-time-saved').textContent = `${this.stats.timeSavedMinutes} min`;
        this.overlay.querySelector('#stat-pages-analyzed').textContent = this.stats.pagesAnalyzed;
        this.overlay.querySelector('#stat-forms-filled').textContent = this.stats.formsAutofilled;

        // Update recent activity from task queue
        this.loadRecentActivity();
    }

    loadRecentActivity() {
        const activityList = this.overlay.querySelector('#recent-activity');

        // Get from task queue history
        let history = [];
        if (window.taskQueue && window.taskQueue.history) {
            history = window.taskQueue.history.slice(0, 5);
        }

        if (history.length === 0) {
            activityList.innerHTML = '<div class="activity-empty">No recent activity</div>';
            return;
        }

        activityList.innerHTML = history.map(item => `
      <div class="activity-item">
        <div class="activity-icon gradient-${this.getTypeColor(item.type)}">
          ${this.getTypeIcon(item.type)}
        </div>
        <div class="activity-info">
          <p class="activity-title">${this.escapeHtml(item.name)}</p>
          <span class="activity-time">${this.formatTime(item.completedAt)}</span>
        </div>
        <span class="activity-status ${item.status}">${item.status}</span>
      </div>
    `).join('');
    }

    loadHistory() {
        const historyList = this.overlay.querySelector('#history-list');

        let history = [];
        if (window.taskQueue && window.taskQueue.history) {
            history = window.taskQueue.history;
        }

        if (history.length === 0) {
            historyList.innerHTML = '<div class="history-empty">No task history yet</div>';
            return;
        }

        historyList.innerHTML = history.map(item => `
      <div class="activity-item" data-type="${item.type}">
        <div class="activity-icon gradient-${this.getTypeColor(item.type)}">
          ${this.getTypeIcon(item.type)}
        </div>
        <div class="activity-info">
          <p class="activity-title">${this.escapeHtml(item.name)}</p>
          <span class="activity-time">${this.formatTime(item.completedAt)} • ${this.formatDuration(item.duration)}</span>
        </div>
        <span class="activity-status ${item.status}">${item.status}</span>
      </div>
    `).join('');
    }

    filterHistory() {
        const search = this.overlay.querySelector('#history-search').value.toLowerCase();
        const filter = this.overlay.querySelector('#history-filter').value;
        const items = this.overlay.querySelectorAll('#history-list .activity-item');

        items.forEach(item => {
            const matchesSearch = item.textContent.toLowerCase().includes(search);
            const matchesFilter = filter === 'all' || item.dataset.type === filter;
            item.style.display = matchesSearch && matchesFilter ? 'flex' : 'none';
        });
    }

    getTypeIcon(type) {
        const icons = {
            ai: '🤖',
            macro: '🔄',
            research: '📚',
            form: '✏️'
        };
        return icons[type] || '📋';
    }

    getTypeColor(type) {
        const colors = {
            ai: 'purple',
            macro: 'blue',
            research: 'green',
            form: 'orange'
        };
        return colors[type] || 'purple';
    }

    formatTime(timestamp) {
        if (!timestamp) return 'Unknown';
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return date.toLocaleDateString();
    }

    formatDuration(ms) {
        if (!ms) return '0s';
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${Math.round(ms / 1000)}s`;
        return `${Math.round(ms / 60000)}m`;
    }

    open() {
        this.isOpen = true;
        this.overlay.classList.add('active');
        this.updateUI();
    }

    close() {
        this.isOpen = false;
        this.overlay.classList.remove('active');
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

// Initialize
window.taskDashboard = new TaskDashboard();
