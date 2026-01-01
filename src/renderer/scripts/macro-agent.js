/**
 * EVOS Macro Agent
 * Record and replay user actions as automated macros
 */

class MacroAgent {
    constructor() {
        this.isRecording = false;
        this.recordedActions = [];
        this.macros = [];
        this.currentPlayback = null;
        this.recordingWebview = null;

        this.loadMacros();
        this.setupEventListeners();
    }

    /**
     * Load saved macros from localStorage
     */
    loadMacros() {
        try {
            const saved = localStorage.getItem('evos-macros');
            this.macros = saved ? JSON.parse(saved) : [];
        } catch (e) {
            this.macros = [];
        }
    }

    /**
     * Save macros to localStorage
     */
    saveMacros() {
        try {
            localStorage.setItem('evos-macros', JSON.stringify(this.macros));
        } catch (e) {
            console.error('[MacroAgent] Failed to save macros:', e);
        }
    }

    /**
     * Setup event listeners for recording
     */
    setupEventListeners() {
        // Listen for action events from webviews
        window.addEventListener('message', (event) => {
            if (event.data?.type === 'macro-action' && this.isRecording) {
                this.recordAction(event.data.action);
            }
        });
    }

    /**
     * Generate a robust selector for an element
     */
    generateSelector(element) {
        // Try ID first
        if (element.id) {
            return `#${element.id}`;
        }

        // Try name attribute
        if (element.name) {
            return `[name="${element.name}"]`;
        }

        // Try unique class combination
        if (element.className) {
            const classes = element.className.split(' ').filter(c => c && !c.includes('hover') && !c.includes('active'));
            if (classes.length > 0) {
                const selector = element.tagName.toLowerCase() + '.' + classes.slice(0, 2).join('.');
                return selector;
            }
        }

        // Try data attributes
        const dataAttrs = Array.from(element.attributes || []).filter(a => a.name.startsWith('data-'));
        if (dataAttrs.length > 0) {
            return `[${dataAttrs[0].name}="${dataAttrs[0].value}"]`;
        }

        // Fallback to tag + nth-of-type
        return element.tagName.toLowerCase();
    }

    /**
     * Inject recording script into webview
     */
    injectRecordingScript(webview) {
        const script = `
        (function() {
            if (window.__evosRecorderInjected) return;
            window.__evosRecorderInjected = true;
            
            const sendAction = (action) => {
                window.parent.postMessage({ type: 'macro-action', action }, '*');
            };
            
            const getSelector = (el) => {
                if (el.id) return '#' + el.id;
                if (el.name) return '[name="' + el.name + '"]';
                if (el.className) {
                    const classes = el.className.split(' ').filter(c => c).slice(0, 2).join('.');
                    if (classes) return el.tagName.toLowerCase() + '.' + classes;
                }
                return el.tagName.toLowerCase();
            };
            
            // Click events
            document.addEventListener('click', (e) => {
                const el = e.target;
                sendAction({
                    type: 'click',
                    timestamp: Date.now(),
                    selector: getSelector(el),
                    url: window.location.href,
                    metadata: {
                        tagName: el.tagName,
                        id: el.id,
                        className: el.className,
                        innerText: (el.innerText || '').substring(0, 50)
                    }
                });
            }, true);
            
            // Input events (debounced)
            let inputTimeout = {};
            document.addEventListener('input', (e) => {
                const el = e.target;
                const selector = getSelector(el);
                
                clearTimeout(inputTimeout[selector]);
                inputTimeout[selector] = setTimeout(() => {
                    sendAction({
                        type: 'type',
                        timestamp: Date.now(),
                        selector: selector,
                        value: el.value,
                        url: window.location.href,
                        metadata: {
                            tagName: el.tagName,
                            type: el.type,
                            id: el.id
                        }
                    });
                }, 500);
            }, true);
            
            // Select change
            document.addEventListener('change', (e) => {
                const el = e.target;
                if (el.tagName === 'SELECT') {
                    sendAction({
                        type: 'select',
                        timestamp: Date.now(),
                        selector: getSelector(el),
                        value: el.value,
                        text: el.options[el.selectedIndex]?.text,
                        url: window.location.href
                    });
                }
            }, true);
            
            // Form submit
            document.addEventListener('submit', (e) => {
                sendAction({
                    type: 'submit',
                    timestamp: Date.now(),
                    selector: getSelector(e.target),
                    url: window.location.href
                });
            }, true);
            
            console.log('[EVOS] Macro recording active');
        })();
        `;

        try {
            webview.executeJavaScript(script);
        } catch (e) {
            console.error('[MacroAgent] Failed to inject recording script:', e);
        }
    }

    /**
     * Start recording actions
     */
    startRecording() {
        const webview = document.querySelector('webview.active');
        if (!webview) {
            window.agentManager?.showToast('No Page', 'Open a page to start recording.', { type: 'error' });
            return;
        }

        this.isRecording = true;
        this.recordedActions = [];
        this.recordingWebview = webview;

        // Inject recording script
        this.injectRecordingScript(webview);

        // Re-inject on navigation
        webview.addEventListener('did-finish-load', () => {
            if (this.isRecording) {
                this.injectRecordingScript(webview);
                // Record navigation
                this.recordAction({
                    type: 'navigation',
                    timestamp: Date.now(),
                    url: webview.getURL()
                });
            }
        });

        // Show recording indicator
        window.agentManager?.startRecording?.();

        // Add visual indicator to webview container
        if (webview.parentElement) {
            webview.parentElement.style.position = 'relative';
            const overlay = document.createElement('div');
            overlay.id = 'macro-recording-overlay';
            overlay.style.cssText = `
                position: absolute;
                inset: 0;
                border: 2px solid #ef4444;
                pointer-events: none;
                z-index: 9999;
                box-shadow: inset 0 0 20px rgba(239, 68, 68, 0.2);
                animation: pulse-border 2s infinite;
            `;

            // Add pulse animation if needed
            if (!document.getElementById('macro-styles')) {
                const style = document.createElement('style');
                style.id = 'macro-styles';
                style.textContent = `
                    @keyframes pulse-border {
                        0% { opacity: 0.5; }
                        50% { opacity: 1; }
                        100% { opacity: 0.5; }
                    }
                `;
                document.head.appendChild(style);
            }

            webview.parentElement.appendChild(overlay);
        }

        window.agentManager?.showToast('Recording Started', 'Perform actions, then click Stop to save.', {
            type: 'info',
            duration: 4000
        });

        console.log('[MacroAgent] Recording started');
    }

    /**
     * Record a single action
     */
    recordAction(action) {
        if (!this.isRecording) return;

        // Add relative timing
        if (this.recordedActions.length > 0) {
            const lastAction = this.recordedActions[this.recordedActions.length - 1];
            action.delay = action.timestamp - lastAction.timestamp;
        } else {
            action.delay = 0;
        }

        this.recordedActions.push(action);
        console.log('[MacroAgent] Recorded:', action.type, action.selector || action.url);
    }

    /**
     * Stop recording and prompt to save
     */
    stopRecording() {
        if (!this.isRecording) return;

        this.isRecording = false;
        window.agentManager?.stopRecording?.();

        // Remove overlay
        const overlay = document.getElementById('macro-recording-overlay');
        if (overlay) overlay.remove();

        if (this.recordedActions.length === 0) {
            window.agentManager?.showToast('No Actions', 'No actions were recorded.', { type: 'warning' });
            return;
        }

        // Show save dialog
        this.showSaveDialog();
    }

    /**
     * Show save macro dialog
     */
    showSaveDialog() {
        const actionCount = this.recordedActions.length;
        const body = `
            <div style="margin-bottom: 16px; color: rgba(255,255,255,0.7);">
                Recorded ${actionCount} action${actionCount > 1 ? 's' : ''}
            </div>
            <input type="text" id="macro-name-input" placeholder="Macro name (e.g., Login to GitHub)" 
                   style="width: 100%; padding: 12px; border-radius: 8px; background: rgba(0,0,0,0.3); 
                          border: 1px solid rgba(255,255,255,0.2); color: #fff; font-size: 14px;">
            <div style="margin-top: 12px; font-size: 11px; color: rgba(255,255,255,0.5);">
                Actions: ${this.recordedActions.map(a => a.type).join(' → ')}
            </div>
        `;

        window.agentManager.showModal('Save Macro', body, [
            {
                id: 'save',
                label: 'Save',
                primary: true,
                onClick: () => {
                    const name = document.getElementById('macro-name-input')?.value || 'Untitled Macro';
                    this.saveMacro(name, this.recordedActions);
                }
            },
            {
                id: 'discard',
                label: 'Discard',
                onClick: () => {
                    this.recordedActions = [];
                }
            }
        ], { icon: '🎬' });

        setTimeout(() => document.getElementById('macro-name-input')?.focus(), 100);
    }

    /**
     * Save a macro
     */
    saveMacro(name, actions) {
        const macro = {
            id: Date.now(),
            name: name,
            createdAt: Date.now(),
            actions: actions,
            runCount: 0
        };

        this.macros.push(macro);
        this.saveMacros();

        window.agentManager?.showToast('Macro Saved!', `"${name}" is ready to use.`, {
            type: 'success',
            duration: 4000
        });

        this.recordedActions = [];
        return macro;
    }

    /**
     * Delete a macro
     */
    deleteMacro(macroId) {
        this.macros = this.macros.filter(m => m.id !== macroId);
        this.saveMacros();
    }

    /**
     * Play a macro
     */
    async playMacro(macroId) {
        const macro = this.macros.find(m => m.id === macroId);
        if (!macro) {
            window.agentManager?.showToast('Error', 'Macro not found.', { type: 'error' });
            return;
        }

        const webview = document.querySelector('webview.active');
        if (!webview) {
            window.agentManager?.showToast('No Page', 'Open a page to run the macro.', { type: 'error' });
            return;
        }

        this.currentPlayback = { macro, index: 0, cancelled: false };

        window.agentManager?.showStatus('Playing Macro', `${macro.name}`, {
            icon: '▶️',
            progress: 0,
            actions: [
                { id: 'stop', label: 'Stop', onClick: () => this.stopPlayback() }
            ]
        });

        try {
            for (let i = 0; i < macro.actions.length; i++) {
                if (this.currentPlayback?.cancelled) break;

                const action = macro.actions[i];
                const progress = Math.round((i / macro.actions.length) * 100);

                window.agentManager?.updateProgress(progress, `Step ${i + 1}/${macro.actions.length}: ${action.type}`);

                // Wait for delay (with minimum)
                const delay = Math.min(action.delay || 500, 3000);
                await new Promise(r => setTimeout(r, delay));

                // Execute action
                await this.executeAction(webview, action);
            }

            // Success
            macro.runCount++;
            this.saveMacros();

            window.agentManager?.showStatus('Macro Complete!', `Executed ${macro.actions.length} actions`, {
                icon: '✅',
                type: 'success'
            });

            setTimeout(() => window.agentManager?.hideStatus(), 3000);

        } catch (error) {
            window.agentManager?.showStatus('Macro Failed', error.message, {
                icon: '❌',
                type: 'error'
            });
            setTimeout(() => window.agentManager?.hideStatus(), 5000);
        }

        this.currentPlayback = null;
    }

    /**
     * Stop macro playback
     */
    stopPlayback() {
        if (this.currentPlayback) {
            this.currentPlayback.cancelled = true;
            window.agentManager?.hideStatus();
            window.agentManager?.showToast('Playback Stopped', 'Macro was cancelled.', { type: 'warning' });
        }
    }

    /**
     * Execute a single action
     */
    async executeAction(webview, action) {
        let script = '';

        switch (action.type) {
            case 'click':
                script = `
                    (function() {
                        const el = document.querySelector('${action.selector.replace(/'/g, "\\'")}');
                        if (!el) throw new Error('Element not found: ${action.selector}');
                        el.click();
                        return true;
                    })()
                `;
                break;

            case 'type':
                script = `
                    (function() {
                        const el = document.querySelector('${action.selector.replace(/'/g, "\\'")}');
                        if (!el) throw new Error('Element not found: ${action.selector}');
                        el.focus();
                        el.value = '${(action.value || '').replace(/'/g, "\\'")}';
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                        return true;
                    })()
                `;
                break;

            case 'select':
                script = `
                    (function() {
                        const el = document.querySelector('${action.selector.replace(/'/g, "\\'")}');
                        if (!el) throw new Error('Element not found: ${action.selector}');
                        el.value = '${(action.value || '').replace(/'/g, "\\'")}';
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                        return true;
                    })()
                `;
                break;

            case 'navigation':
                // Navigate to URL
                webview.loadURL(action.url);
                // Wait for page load
                await new Promise(resolve => {
                    const handler = () => {
                        webview.removeEventListener('did-finish-load', handler);
                        resolve();
                    };
                    webview.addEventListener('did-finish-load', handler);
                    setTimeout(resolve, 10000); // Timeout after 10s
                });
                return;

            case 'submit':
                script = `
                    (function() {
                        const form = document.querySelector('${action.selector.replace(/'/g, "\\'")}');
                        if (form && form.submit) form.submit();
                        return true;
                    })()
                `;
                break;

            default:
                console.log('[MacroAgent] Unknown action type:', action.type);
                return;
        }

        try {
            await webview.executeJavaScript(script);
        } catch (error) {
            console.error('[MacroAgent] Action failed:', error);
            throw error;
        }
    }

    /**
     * Show macros list
     */
    showMacrosList() {
        if (this.macros.length === 0) {
            window.agentManager?.showToast('No Macros', 'Record some actions first!', { type: 'info' });
            return;
        }

        const macrosHtml = this.macros.map(m => `
            <div class="macro-item" data-id="${m.id}" style="
                display: flex; justify-content: space-between; align-items: center;
                padding: 12px; margin: 8px 0; background: rgba(255,255,255,0.05);
                border-radius: 8px; cursor: pointer;
            ">
                <div>
                    <div style="font-weight: 600;">${m.name}</div>
                    <div style="font-size: 11px; color: rgba(255,255,255,0.5);">
                        ${m.actions.length} actions • Run ${m.runCount} times
                    </div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="macro-play" data-id="${m.id}" style="
                        padding: 6px 12px; border-radius: 6px; border: none;
                        background: rgba(34, 197, 94, 0.3); color: #22c55e; cursor: pointer;
                    ">▶️ Play</button>
                    <button class="macro-delete" data-id="${m.id}" style="
                        padding: 6px 8px; border-radius: 6px; border: none;
                        background: rgba(239, 68, 68, 0.2); color: #ef4444; cursor: pointer;
                    ">🗑️</button>
                </div>
            </div>
        `).join('');

        window.agentManager.showModal('Saved Macros', `
            <div style="max-height: 400px; overflow-y: auto;">${macrosHtml}</div>
        `, [
            { id: 'close', label: 'Close', primary: true }
        ], { icon: '🎬' });

        // Add click handlers after modal renders
        setTimeout(() => {
            document.querySelectorAll('.macro-play').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = parseInt(btn.dataset.id);
                    window.agentManager.hideModal();
                    this.playMacro(id);
                });
            });

            document.querySelectorAll('.macro-delete').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = parseInt(btn.dataset.id);
                    this.deleteMacro(id);
                    btn.closest('.macro-item')?.remove();
                    window.agentManager.showToast('Deleted', 'Macro removed.', { type: 'info', duration: 2000 });
                });
            });
        }, 100);
    }

    /**
     * Toggle recording (for button)
     */
    toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    }
}

// Initialize global macro agent
window.macroAgent = new MacroAgent();
