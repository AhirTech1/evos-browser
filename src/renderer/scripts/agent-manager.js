/**
 * EVOS Agent Manager
 * Handles agent status bar, notifications, and task orchestration
 */

class AgentManager {
    constructor() {
        this.currentTask = null;
        this.taskQueue = [];
        this.isRecording = false;
        this.recordedActions = [];

        this.statusBar = null;
        this.toastContainer = null;
        this.modalOverlay = null;
        this.recordingIndicator = null;

        this.init();
    }

    init() {
        this.createStatusBar();
        this.createToastContainer();
        this.createModalOverlay();
        this.createRecordingIndicator();

        console.log('[AgentManager] Initialized');
    }

    // ==========================================
    // Status Bar
    // ==========================================
    createStatusBar() {
        const html = `
      <div class="agent-status-bar" id="agent-status-bar">
        <span class="agent-icon">🤖</span>
        <div class="agent-content">
          <div class="agent-title">Agent Working</div>
          <div class="agent-message">Initializing...</div>
          <div class="agent-progress">
            <div class="agent-progress-fill" id="agent-progress-fill"></div>
          </div>
        </div>
        <div class="agent-actions" id="agent-actions"></div>
        <button class="agent-close" id="agent-close">✕</button>
      </div>
    `;
        document.body.insertAdjacentHTML('beforeend', html);
        this.statusBar = document.getElementById('agent-status-bar');

        document.getElementById('agent-close').addEventListener('click', () => {
            this.cancelCurrentTask();
        });
    }

    showStatus(title, message, options = {}) {
        const { progress = -1, icon = '🤖', type = '', actions = [] } = options;

        this.statusBar.querySelector('.agent-icon').textContent = icon;
        this.statusBar.querySelector('.agent-title').textContent = title;
        this.statusBar.querySelector('.agent-message').textContent = message;

        // Progress
        const progressFill = document.getElementById('agent-progress-fill');
        if (progress >= 0) {
            progressFill.style.width = `${progress}%`;
            this.statusBar.querySelector('.agent-progress').style.display = 'block';
        } else {
            this.statusBar.querySelector('.agent-progress').style.display = 'none';
        }

        // Type (success, error)
        this.statusBar.classList.remove('success', 'error');
        if (type) this.statusBar.classList.add(type);

        // Actions
        const actionsContainer = document.getElementById('agent-actions');
        actionsContainer.innerHTML = actions.map(a =>
            `<button class="agent-btn ${a.primary ? 'primary' : 'secondary'}" data-action="${a.id}">${a.label}</button>`
        ).join('');

        actionsContainer.querySelectorAll('.agent-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = actions.find(a => a.id === btn.dataset.action);
                if (action && action.onClick) action.onClick();
            });
        });

        this.statusBar.classList.add('visible');
    }

    hideStatus() {
        this.statusBar.classList.remove('visible');
    }

    updateProgress(progress, message) {
        if (message) {
            this.statusBar.querySelector('.agent-message').textContent = message;
        }
        document.getElementById('agent-progress-fill').style.width = `${progress}%`;
    }

    // ==========================================
    // Toast Notifications
    // ==========================================
    createToastContainer() {
        const html = `<div class="toast-container" id="toast-container"></div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        this.toastContainer = document.getElementById('toast-container');
    }

    showToast(title, message, options = {}) {
        const { type = 'info', duration = 5000, actions = [], icon } = options;

        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        const toastId = `toast-${Date.now()}`;
        const html = `
      <div class="toast ${type}" id="${toastId}">
        <span class="toast-icon">${icon || icons[type]}</span>
        <div class="toast-content">
          <div class="toast-title">${title}</div>
          <div class="toast-message">${message}</div>
          ${actions.length ? `
            <div class="toast-actions">
              ${actions.map(a =>
            `<button class="agent-btn ${a.primary ? 'primary' : 'secondary'}" data-action="${a.id}">${a.label}</button>`
        ).join('')}
            </div>
          ` : ''}
        </div>
        <button class="toast-close">✕</button>
      </div>
    `;

        this.toastContainer.insertAdjacentHTML('beforeend', html);
        const toast = document.getElementById(toastId);

        // Show with animation
        requestAnimationFrame(() => {
            toast.classList.add('visible');
        });

        // Close button
        toast.querySelector('.toast-close').addEventListener('click', () => {
            this.dismissToast(toast);
        });

        // Action buttons
        toast.querySelectorAll('.agent-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = actions.find(a => a.id === btn.dataset.action);
                if (action && action.onClick) action.onClick();
                this.dismissToast(toast);
            });
        });

        // Auto dismiss
        if (duration > 0) {
            setTimeout(() => this.dismissToast(toast), duration);
        }

        return toastId;
    }

    dismissToast(toast) {
        if (!toast) return;
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 400);
    }

    // ==========================================
    // Modal Dialog
    // ==========================================
    createModalOverlay() {
        const html = `
      <div class="agent-modal-overlay" id="agent-modal-overlay">
        <div class="agent-modal">
          <div class="agent-modal-header">
            <span class="agent-modal-icon">🤖</span>
            <div class="agent-modal-title">Agent Needs Your Input</div>
          </div>
          <div class="agent-modal-body" id="agent-modal-body"></div>
          <div class="agent-modal-actions" id="agent-modal-actions"></div>
        </div>
      </div>
    `;
        document.body.insertAdjacentHTML('beforeend', html);
        this.modalOverlay = document.getElementById('agent-modal-overlay');
    }

    showModal(title, body, actions = [], options = {}) {
        const { icon = '🤖' } = options;

        this.modalOverlay.querySelector('.agent-modal-icon').textContent = icon;
        this.modalOverlay.querySelector('.agent-modal-title').textContent = title;
        document.getElementById('agent-modal-body').innerHTML = body;

        const actionsContainer = document.getElementById('agent-modal-actions');
        actionsContainer.innerHTML = actions.map(a =>
            `<button class="agent-btn ${a.primary ? 'primary' : 'secondary'}" data-action="${a.id}">${a.label}</button>`
        ).join('');

        return new Promise(resolve => {
            actionsContainer.querySelectorAll('.agent-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const action = actions.find(a => a.id === btn.dataset.action);
                    // IMPORTANT: Call onClick BEFORE hiding modal so it can read input values
                    if (action && action.onClick) {
                        action.onClick();
                    }
                    this.hideModal();
                    resolve(action ? action.id : null);
                });
            });

            this.modalOverlay.classList.add('visible');
        });
    }

    hideModal() {
        this.modalOverlay.classList.remove('visible');
    }

    // ==========================================
    // Recording Indicator
    // ==========================================
    createRecordingIndicator() {
        const html = `
      <div class="recording-indicator" id="recording-indicator">
        <div class="recording-dot"></div>
        <span class="recording-text">Recording actions...</span>
        <button class="recording-stop" id="recording-stop">Stop</button>
      </div>
    `;
        document.body.insertAdjacentHTML('beforeend', html);
        this.recordingIndicator = document.getElementById('recording-indicator');

        document.getElementById('recording-stop').addEventListener('click', () => {
            this.stopRecording();
        });
    }

    startRecording() {
        this.isRecording = true;
        this.recordedActions = [];
        this.recordingIndicator.classList.add('visible');

        // Notify main process to start capturing
        if (window.aiAPI && window.aiAPI.startRecording) {
            window.aiAPI.startRecording();
        }

        this.showToast('Recording Started', 'Perform the actions you want to automate, then click Stop.', {
            type: 'info',
            duration: 3000
        });
    }

    stopRecording() {
        this.isRecording = false;
        this.recordingIndicator.classList.remove('visible');

        // Get recorded actions from main process
        if (window.aiAPI && window.aiAPI.stopRecording) {
            window.aiAPI.stopRecording().then(actions => {
                this.recordedActions = actions;
                this.promptSaveMacro(actions);
            });
        }
    }

    async promptSaveMacro(actions) {
        const result = await this.showModal(
            'Save Macro',
            `
        <p>You recorded ${actions?.length || 0} actions. Give this macro a name:</p>
        <input type="text" id="macro-name-input" placeholder="e.g., Weekly Report Submission" 
               style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); 
                      background: rgba(0,0,0,0.3); color: #fff; margin-top: 12px;">
      `,
            [
                { id: 'save', label: 'Save Macro', primary: true },
                { id: 'cancel', label: 'Discard' }
            ],
            { icon: '🎬' }
        );

        if (result === 'save') {
            const name = document.getElementById('macro-name-input')?.value || 'Untitled Macro';
            // Save macro
            if (window.aiAPI && window.aiAPI.saveMacro) {
                await window.aiAPI.saveMacro(name, actions);
                this.showToast('Macro Saved', `"${name}" is ready to use!`, { type: 'success' });
            }
        }
    }

    // ==========================================
    // Task Management
    // ==========================================
    async runTask(taskType, taskData) {
        this.currentTask = { type: taskType, data: taskData, status: 'running' };

        try {
            switch (taskType) {
                case 'form-fill':
                    await this.runFormFillTask(taskData);
                    break;
                case 'research':
                    await this.runResearchTask(taskData);
                    break;
                case 'multi-account':
                    await this.runMultiAccountTask(taskData);
                    break;
                case 'tab-organize':
                    await this.runTabOrganizeTask(taskData);
                    break;
                case 'macro-replay':
                    await this.runMacroReplayTask(taskData);
                    break;
                default:
                    throw new Error(`Unknown task type: ${taskType}`);
            }
        } catch (error) {
            this.showStatus('Task Failed', error.message, { type: 'error', icon: '❌' });
            setTimeout(() => this.hideStatus(), 5000);
        }

        this.currentTask = null;
    }

    cancelCurrentTask() {
        if (this.currentTask) {
            this.currentTask.status = 'cancelled';
            this.hideStatus();
            this.showToast('Task Cancelled', 'The agent task was stopped.', { type: 'warning' });
        } else {
            this.hideStatus();
        }
    }

    // Task implementations will be added in separate modules
    async runFormFillTask(data) {
        // Placeholder - will be implemented in form-agent.js
        if (window.formAgent) {
            await window.formAgent.fill(data);
        }
    }

    async runResearchTask(data) {
        // Placeholder - will be implemented in research-agent.js
        if (window.researchAgent) {
            await window.researchAgent.analyze(data);
        }
    }

    async runMultiAccountTask(data) {
        // Placeholder
    }

    async runTabOrganizeTask(data) {
        // Placeholder - will be implemented in tab-agent.js
        if (window.tabAgent) {
            await window.tabAgent.organize(data);
        }
    }

    async runMacroReplayTask(data) {
        // Placeholder
    }
}

// Initialize global agent manager
window.agentManager = new AgentManager();

// Export for module usage
if (typeof module !== 'undefined') {
    module.exports = AgentManager;
}
