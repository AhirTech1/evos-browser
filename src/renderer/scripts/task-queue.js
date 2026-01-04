/**
 * EVOS Task Queue Manager
 * Multi-task orchestration with parallel execution support
 */

class TaskQueue {
    constructor() {
        this.tasks = [];
        this.activeTask = null;
        this.isProcessing = false;
        this.maxParallel = 3; // Max parallel tasks
        this.parallelTasks = [];
        this.history = [];
        this.stats = {
            completed: 0,
            failed: 0,
            totalTimeMs: 0
        };

        this.listeners = {
            onTaskStart: [],
            onTaskComplete: [],
            onTaskError: [],
            onQueueChange: [],
            onProgress: []
        };

        this.loadState();
        this.createUI();
    }

    loadState() {
        try {
            const saved = localStorage.getItem('evos-task-queue');
            if (saved) {
                const data = JSON.parse(saved);
                this.history = data.history || [];
                this.stats = data.stats || this.stats;
            }
        } catch (e) {
            console.error('[TaskQueue] Load error:', e);
        }
    }

    saveState() {
        try {
            localStorage.setItem('evos-task-queue', JSON.stringify({
                history: this.history.slice(0, 100), // Keep last 100
                stats: this.stats
            }));
        } catch (e) {
            console.error('[TaskQueue] Save error:', e);
        }
    }

    // Add event listener
    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
        return () => {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        };
    }

    // Emit event
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }

    // Add task to queue
    addTask(task) {
        const newTask = {
            id: this.generateId(),
            name: task.name || 'Unnamed Task',
            description: task.description || task.command,
            command: task.command,
            type: task.type || 'ai', // 'ai', 'macro', 'research', 'form'
            priority: task.priority || 'normal', // 'high', 'normal', 'low'
            status: 'queued', // 'queued', 'running', 'paused', 'completed', 'failed', 'cancelled'
            progress: 0,
            progressMessage: 'Waiting in queue...',
            createdAt: Date.now(),
            startedAt: null,
            completedAt: null,
            result: null,
            error: null,
            retries: 0,
            maxRetries: task.maxRetries || 1
        };

        // Insert based on priority
        if (task.priority === 'high') {
            const firstNonHigh = this.tasks.findIndex(t => t.priority !== 'high');
            if (firstNonHigh === -1) {
                this.tasks.push(newTask);
            } else {
                this.tasks.splice(firstNonHigh, 0, newTask);
            }
        } else {
            this.tasks.push(newTask);
        }

        this.emit('onQueueChange', { tasks: this.tasks });
        this.updateUI();
        this.processQueue();

        return newTask.id;
    }

    // Process the queue
    async processQueue() {
        if (this.isProcessing) return;

        const nextTask = this.tasks.find(t => t.status === 'queued');
        if (!nextTask) return;

        this.isProcessing = true;
        await this.executeTask(nextTask);
        this.isProcessing = false;

        // Continue processing
        this.processQueue();
    }

    // Execute a single task
    async executeTask(task) {
        task.status = 'running';
        task.startedAt = Date.now();
        task.progressMessage = 'Starting...';

        this.activeTask = task;
        this.emit('onTaskStart', task);
        this.updateUI();

        try {
            const result = await this.runTaskAction(task);

            task.status = 'completed';
            task.completedAt = Date.now();
            task.result = result;
            task.progress = 100;
            task.progressMessage = 'Completed';

            // Update stats
            this.stats.completed++;
            this.stats.totalTimeMs += (task.completedAt - task.startedAt);

            // Add to history
            this.addToHistory(task);

            this.emit('onTaskComplete', task);

        } catch (error) {
            console.error('[TaskQueue] Task error:', error);

            // Retry logic
            if (task.retries < task.maxRetries) {
                task.retries++;
                task.status = 'queued';
                task.progressMessage = `Retrying (${task.retries}/${task.maxRetries})...`;
            } else {
                task.status = 'failed';
                task.completedAt = Date.now();
                task.error = error.message;
                task.progressMessage = 'Failed';

                this.stats.failed++;
                this.addToHistory(task);
                this.emit('onTaskError', task);
            }
        }

        // Remove from queue
        this.tasks = this.tasks.filter(t => t.id !== task.id || t.status === 'queued');
        this.activeTask = null;
        this.updateUI();
        this.saveState();
    }

    // Run the actual task action
    async runTaskAction(task) {
        const updateProgress = (progress, message) => {
            task.progress = progress;
            task.progressMessage = message;
            this.emit('onProgress', { task, progress, message });
            this.updateUI();
        };

        switch (task.type) {
            case 'ai':
                return await this.executeAITask(task.command, updateProgress);
            case 'macro':
                return await this.executeMacroTask(task.command, updateProgress);
            case 'research':
                return await this.executeResearchTask(task.command, updateProgress);
            case 'form':
                return await this.executeFormTask(task.command, updateProgress);
            default:
                return await this.executeAITask(task.command, updateProgress);
        }
    }

    // Execute AI task
    async executeAITask(command, onProgress) {
        onProgress(10, 'Preparing AI...');

        // Get current page context
        const context = await this.getPageContext();
        onProgress(20, 'Analyzing request...');

        // Send to AI
        const response = await window.electronAPI.aiChat({
            message: command,
            context: context
        });

        onProgress(90, 'Processing response...');

        if (response.type === 'error') {
            throw new Error(response.response);
        }

        return response.response;
    }

    // Execute macro task
    async executeMacroTask(macroId, onProgress) {
        onProgress(10, 'Loading macro...');

        if (!window.macroAgent) {
            throw new Error('Macro agent not available');
        }

        onProgress(30, 'Playing macro...');
        await window.macroAgent.playMacro(macroId);

        return 'Macro completed';
    }

    // Execute research task
    async executeResearchTask(topic, onProgress) {
        onProgress(10, 'Starting research...');

        if (!window.researchAgent) {
            throw new Error('Research agent not available');
        }

        onProgress(30, 'Analyzing tabs...');
        const result = await window.researchAgent.analyze({ topic });

        return result;
    }

    // Execute form task
    async executeFormTask(data, onProgress) {
        onProgress(10, 'Detecting forms...');

        if (!window.formAgent) {
            throw new Error('Form agent not available');
        }

        onProgress(30, 'Filling form...');
        const result = await window.formAgent.analyze(data);

        return result;
    }

    // Get page context
    async getPageContext() {
        try {
            if (window.aiPanel && typeof window.aiPanel.getPageContext === 'function') {
                return window.aiPanel.getPageContext();
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    // Pause a task
    pauseTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task && task.status === 'queued') {
            task.status = 'paused';
            this.updateUI();
        }
    }

    // Resume a task
    resumeTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task && task.status === 'paused') {
            task.status = 'queued';
            this.updateUI();
            this.processQueue();
        }
    }

    // Cancel a task
    cancelTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.status = 'cancelled';
            task.completedAt = Date.now();
            this.tasks = this.tasks.filter(t => t.id !== taskId);
            this.addToHistory(task);
            this.updateUI();
        }
    }

    // Clear completed/failed tasks
    clearCompleted() {
        this.tasks = this.tasks.filter(t => !['completed', 'failed', 'cancelled'].includes(t.status));
        this.updateUI();
    }

    // Add to history
    addToHistory(task) {
        this.history.unshift({
            id: task.id,
            name: task.name,
            description: task.description,
            type: task.type,
            status: task.status,
            duration: task.completedAt - task.startedAt,
            createdAt: task.createdAt,
            completedAt: task.completedAt,
            error: task.error
        });

        // Keep only last 100
        if (this.history.length > 100) {
            this.history = this.history.slice(0, 100);
        }
    }

    // Get stats
    getStats() {
        const avgTime = this.stats.completed > 0
            ? Math.round(this.stats.totalTimeMs / this.stats.completed / 1000)
            : 0;

        return {
            ...this.stats,
            queued: this.tasks.filter(t => t.status === 'queued').length,
            running: this.tasks.filter(t => t.status === 'running').length,
            avgTimeSeconds: avgTime
        };
    }

    // Generate unique ID
    generateId() {
        return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Create the floating indicator UI
    createUI() {
        // Create floating indicator
        this.indicator = document.createElement('div');
        this.indicator.className = 'task-queue-indicator';
        this.indicator.innerHTML = `
      <div class="task-queue-indicator-content">
        <div class="task-queue-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            <path d="M9 12l2 2 4-4"/>
          </svg>
        </div>
        <span class="task-queue-count">0</span>
        <div class="task-queue-progress"></div>
      </div>
    `;

        this.indicator.addEventListener('click', () => this.showPanel());
        document.body.appendChild(this.indicator);

        // Create panel
        this.panel = document.createElement('div');
        this.panel.className = 'task-queue-panel';
        this.panel.innerHTML = `
      <div class="task-queue-header">
        <h3>Task Queue</h3>
        <div class="task-queue-header-actions">
          <button class="task-queue-btn-clear" title="Clear completed">Clear</button>
          <button class="task-queue-btn-close" title="Close">×</button>
        </div>
      </div>
      <div class="task-queue-stats">
        <div class="task-queue-stat">
          <span class="task-queue-stat-value" id="stat-queued">0</span>
          <span class="task-queue-stat-label">Queued</span>
        </div>
        <div class="task-queue-stat">
          <span class="task-queue-stat-value" id="stat-running">0</span>
          <span class="task-queue-stat-label">Running</span>
        </div>
        <div class="task-queue-stat">
          <span class="task-queue-stat-value" id="stat-completed">0</span>
          <span class="task-queue-stat-label">Completed</span>
        </div>
      </div>
      <div class="task-queue-list" id="task-queue-list">
        <div class="task-queue-empty">
          <span>📋</span>
          <p>No tasks in queue</p>
          <p class="text-muted">Use Ctrl+Shift+Space to add tasks</p>
        </div>
      </div>
      <div class="task-queue-add">
        <input type="text" id="task-queue-input" placeholder="Add a new task..." />
        <button id="task-queue-add-btn">Add</button>
      </div>
    `;

        document.body.appendChild(this.panel);

        // Event listeners
        this.panel.querySelector('.task-queue-btn-close').addEventListener('click', () => this.hidePanel());
        this.panel.querySelector('.task-queue-btn-clear').addEventListener('click', () => this.clearCompleted());

        const addBtn = this.panel.querySelector('#task-queue-add-btn');
        const addInput = this.panel.querySelector('#task-queue-input');

        addBtn.addEventListener('click', () => {
            const command = addInput.value.trim();
            if (command) {
                this.addTask({
                    name: command.substring(0, 50),
                    command: command,
                    type: 'ai'
                });
                addInput.value = '';
            }
        });

        addInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                addBtn.click();
            }
        });

        // Inject styles
        this.injectStyles();
    }

    injectStyles() {
        if (document.getElementById('task-queue-styles')) return;

        const style = document.createElement('style');
        style.id = 'task-queue-styles';
        style.textContent = `
      .task-queue-indicator {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        border-radius: 28px;
        padding: 8px 16px;
        cursor: pointer;
        z-index: 9998;
        box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
        transition: all 0.3s ease;
        display: none;
      }
      
      .task-queue-indicator.active {
        display: block;
      }
      
      .task-queue-indicator:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 25px rgba(99, 102, 241, 0.5);
      }
      
      .task-queue-indicator-content {
        display: flex;
        align-items: center;
        gap: 8px;
        color: white;
      }
      
      .task-queue-icon svg {
        display: block;
      }
      
      .task-queue-count {
        font-weight: 600;
        font-size: 14px;
      }
      
      .task-queue-progress {
        width: 30px;
        height: 4px;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 2px;
        overflow: hidden;
      }
      
      .task-queue-progress::after {
        content: '';
        display: block;
        height: 100%;
        background: white;
        animation: task-progress 1.5s ease-in-out infinite;
      }
      
      @keyframes task-progress {
        0% { width: 0; margin-left: 0; }
        50% { width: 50%; margin-left: 25%; }
        100% { width: 0; margin-left: 100%; }
      }
      
      .task-queue-panel {
        position: fixed;
        bottom: 70px;
        right: 20px;
        width: 380px;
        max-height: 500px;
        background: rgba(20, 20, 30, 0.98);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        z-index: 9999;
        opacity: 0;
        visibility: hidden;
        transform: translateY(10px);
        transition: all 0.25s ease;
        box-shadow: 0 15px 50px rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
      }
      
      .task-queue-panel.active {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
      }
      
      .task-queue-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }
      
      .task-queue-header h3 {
        margin: 0;
        font-size: 16px;
        color: white;
      }
      
      .task-queue-header-actions {
        display: flex;
        gap: 8px;
      }
      
      .task-queue-btn-clear, .task-queue-btn-close {
        background: rgba(255, 255, 255, 0.1);
        border: none;
        border-radius: 6px;
        color: rgba(255, 255, 255, 0.7);
        padding: 6px 10px;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s;
      }
      
      .task-queue-btn-clear:hover, .task-queue-btn-close:hover {
        background: rgba(255, 255, 255, 0.2);
        color: white;
      }
      
      .task-queue-stats {
        display: flex;
        padding: 12px 16px;
        gap: 12px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      }
      
      .task-queue-stat {
        display: flex;
        flex-direction: column;
        align-items: center;
        flex: 1;
      }
      
      .task-queue-stat-value {
        font-size: 20px;
        font-weight: 600;
        color: #6366f1;
      }
      
      .task-queue-stat-label {
        font-size: 10px;
        color: rgba(255, 255, 255, 0.5);
        text-transform: uppercase;
      }
      
      .task-queue-list {
        flex: 1;
        overflow-y: auto;
        padding: 8px;
        max-height: 280px;
      }
      
      .task-queue-empty {
        text-align: center;
        padding: 30px;
        color: rgba(255, 255, 255, 0.5);
      }
      
      .task-queue-empty span {
        font-size: 32px;
        display: block;
        margin-bottom: 8px;
      }
      
      .task-queue-empty p {
        margin: 4px 0;
      }
      
      .task-queue-empty .text-muted {
        font-size: 12px;
        opacity: 0.6;
      }
      
      .task-queue-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: rgba(255, 255, 255, 0.03);
        border-radius: 10px;
        margin-bottom: 8px;
        transition: background 0.2s;
      }
      
      .task-queue-item:hover {
        background: rgba(255, 255, 255, 0.06);
      }
      
      .task-queue-item-status {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      
      .task-queue-item-status.queued { background: #fbbf24; }
      .task-queue-item-status.running { background: #6366f1; animation: pulse 1s infinite; }
      .task-queue-item-status.completed { background: #10b981; }
      .task-queue-item-status.failed { background: #ef4444; }
      .task-queue-item-status.paused { background: #6b7280; }
      
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      
      .task-queue-item-content {
        flex: 1;
        min-width: 0;
      }
      
      .task-queue-item-name {
        font-size: 13px;
        color: white;
        margin: 0 0 4px 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .task-queue-item-progress {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.5);
        margin: 0;
      }
      
      .task-queue-item-actions {
        display: flex;
        gap: 4px;
      }
      
      .task-queue-item-btn {
        width: 24px;
        height: 24px;
        border: none;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 4px;
        color: rgba(255, 255, 255, 0.6);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }
      
      .task-queue-item-btn:hover {
        background: rgba(255, 255, 255, 0.2);
        color: white;
      }
      
      .task-queue-add {
        display: flex;
        gap: 8px;
        padding: 12px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }
      
      #task-queue-input {
        flex: 1;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 10px 14px;
        color: white;
        font-size: 13px;
        outline: none;
        transition: border-color 0.2s;
      }
      
      #task-queue-input:focus {
        border-color: #6366f1;
      }
      
      #task-queue-add-btn {
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        border: none;
        border-radius: 8px;
        padding: 10px 16px;
        color: white;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      #task-queue-add-btn:hover {
        transform: translateY(-1px);
      }
    `;
        document.head.appendChild(style);
    }

    updateUI() {
        const stats = this.getStats();
        const hasActiveTasks = this.tasks.length > 0 || stats.running > 0;

        // Update indicator
        this.indicator.classList.toggle('active', hasActiveTasks);
        this.indicator.querySelector('.task-queue-count').textContent =
            stats.queued + stats.running;

        // Update stats
        this.panel.querySelector('#stat-queued').textContent = stats.queued;
        this.panel.querySelector('#stat-running').textContent = stats.running;
        this.panel.querySelector('#stat-completed').textContent = stats.completed;

        // Update list
        const listEl = this.panel.querySelector('#task-queue-list');

        if (this.tasks.length === 0) {
            listEl.innerHTML = `
        <div class="task-queue-empty">
          <span>📋</span>
          <p>No tasks in queue</p>
          <p class="text-muted">Use Ctrl+Shift+Space to add tasks</p>
        </div>
      `;
            return;
        }

        listEl.innerHTML = this.tasks.map(task => `
      <div class="task-queue-item" data-id="${task.id}">
        <div class="task-queue-item-status ${task.status}"></div>
        <div class="task-queue-item-content">
          <p class="task-queue-item-name">${this.escapeHtml(task.name)}</p>
          <p class="task-queue-item-progress">${task.progressMessage}</p>
        </div>
        <div class="task-queue-item-actions">
          ${task.status === 'queued' ? `
            <button class="task-queue-item-btn" onclick="window.taskQueue.pauseTask('${task.id}')" title="Pause">⏸</button>
          ` : ''}
          ${task.status === 'paused' ? `
            <button class="task-queue-item-btn" onclick="window.taskQueue.resumeTask('${task.id}')" title="Resume">▶</button>
          ` : ''}
          <button class="task-queue-item-btn" onclick="window.taskQueue.cancelTask('${task.id}')" title="Cancel">×</button>
        </div>
      </div>
    `).join('');
    }

    showPanel() {
        this.panel.classList.add('active');
        this.updateUI();
    }

    hidePanel() {
        this.panel.classList.remove('active');
    }

    togglePanel() {
        this.panel.classList.toggle('active');
        if (this.panel.classList.contains('active')) {
            this.updateUI();
        }
    }

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

// Initialize
window.taskQueue = new TaskQueue();
