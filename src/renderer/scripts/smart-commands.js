/**
 * EVOS Smart Commands
 * Natural language task parser that breaks complex requests into actionable steps
 */

class SmartCommands {
    constructor() {
        this.commandPatterns = [
            {
                // Search and compare pattern
                pattern: /^(search|find|look for)\s+(.+?)\s+(and|then)\s+(compare|show|list)\s+(.+)/i,
                handler: 'searchAndCompare'
            },
            {
                // Navigate and do something
                pattern: /^(go to|open|visit|navigate to)\s+(.+?)\s+(and|then)\s+(.+)/i,
                handler: 'navigateAndAction'
            },
            {
                // Book/order pattern
                pattern: /^(book|order|buy|purchase)\s+(.+?)\s+(for|on|at)\s+(.+)/i,
                handler: 'bookingTask'
            },
            {
                // Research pattern
                pattern: /^(research|study|learn about|investigate)\s+(.+)/i,
                handler: 'deepResearch'
            },
            {
                // Compare pattern
                pattern: /^(compare|versus|vs)\s+(.+?)\s+(and|vs|versus|with)\s+(.+)/i,
                handler: 'compareItems'
            },
            {
                // Fill form pattern
                pattern: /^(fill|complete|submit)\s+(the\s+)?(form|application|registration)/i,
                handler: 'fillForm'
            },
            {
                // Download/save pattern
                pattern: /^(download|save|export)\s+(.+)/i,
                handler: 'downloadContent'
            },
            {
                // Summarize pattern
                pattern: /^(summarize|explain|tell me about)\s+(.+)/i,
                handler: 'summarizeContent'
            },
            {
                // Schedule pattern
                pattern: /^(schedule|remind me|set reminder)\s+(.+?)\s+(for|at|on)\s+(.+)/i,
                handler: 'scheduleTask'
            },
            {
                // Extract pattern
                pattern: /^(extract|get|collect|scrape)\s+(.+?)\s+(from|on)\s+(.+)/i,
                handler: 'extractData'
            }
        ];

        this.stepTemplates = {
            search: { icon: '🔍', name: 'Search', desc: 'Search for "{query}"' },
            navigate: { icon: '🌐', name: 'Navigate', desc: 'Go to {url}' },
            extract: { icon: '📋', name: 'Extract', desc: 'Extract {type} from page' },
            compare: { icon: '⚖️', name: 'Compare', desc: 'Compare results' },
            summarize: { icon: '📝', name: 'Summarize', desc: 'Create summary' },
            fill: { icon: '✏️', name: 'Fill Form', desc: 'Auto-fill form fields' },
            click: { icon: '👆', name: 'Click', desc: 'Click on {element}' },
            type: { icon: '⌨️', name: 'Type', desc: 'Enter text' },
            wait: { icon: '⏳', name: 'Wait', desc: 'Wait for page to load' },
            save: { icon: '💾', name: 'Save', desc: 'Save results' }
        };
    }

    // Parse a natural language command
    parseCommand(command) {
        const lowerCommand = command.toLowerCase().trim();

        // Try to match against patterns
        for (const { pattern, handler } of this.commandPatterns) {
            const match = command.match(pattern);
            if (match) {
                return this[handler](match, command);
            }
        }

        // Fall back to AI interpretation
        return this.interpretWithAI(command);
    }

    // Search and compare handler
    searchAndCompare(match, original) {
        const searchQuery = match[2];
        const action = match[4];
        const target = match[5];

        return {
            type: 'multi-step',
            name: `Search & ${action}`,
            description: original,
            steps: [
                { ...this.stepTemplates.search, params: { query: searchQuery } },
                { ...this.stepTemplates.wait, params: { duration: 2000 } },
                { ...this.stepTemplates.extract, params: { type: 'results' } },
                { ...this.stepTemplates.compare, params: { criteria: target } },
                { ...this.stepTemplates.summarize, params: {} }
            ]
        };
    }

    // Navigate and action handler
    navigateAndAction(match, original) {
        const destination = match[2];
        const action = match[4];

        const steps = [
            { ...this.stepTemplates.navigate, params: { url: destination } },
            { ...this.stepTemplates.wait, params: { duration: 2000 } }
        ];

        // Parse the follow-up action
        if (/search|find|look/i.test(action)) {
            steps.push({ ...this.stepTemplates.search, params: { query: action } });
        } else if (/fill|complete/i.test(action)) {
            steps.push({ ...this.stepTemplates.fill, params: {} });
        } else if (/click|press/i.test(action)) {
            steps.push({ ...this.stepTemplates.click, params: { element: action } });
        } else if (/summarize|read/i.test(action)) {
            steps.push({ ...this.stepTemplates.summarize, params: {} });
        } else {
            // Generic action - let AI handle
            steps.push({ icon: '🤖', name: 'AI Action', desc: action, params: { action } });
        }

        return {
            type: 'multi-step',
            name: `Navigate & Act`,
            description: original,
            steps
        };
    }

    // Booking task handler
    bookingTask(match, original) {
        const item = match[2];
        const details = match[4];

        return {
            type: 'guided',
            name: `Book ${item}`,
            description: original,
            steps: [
                { ...this.stepTemplates.search, desc: `Search for ${item} booking sites`, params: { query: `book ${item} ${details}` } },
                { ...this.stepTemplates.compare, desc: 'Compare options and prices', params: {} },
                { icon: '✅', name: 'Select Best', desc: 'Choose the best option', params: {} },
                { ...this.stepTemplates.fill, desc: 'Fill booking details', params: {} }
            ],
            requiresConfirmation: true,
            warning: 'This task may involve financial transactions. AI will pause before any payment steps.'
        };
    }

    // Deep research handler
    deepResearch(match, original) {
        const topic = match[2];

        return {
            type: 'multi-step',
            name: `Research: ${topic.substring(0, 30)}`,
            description: original,
            steps: [
                { ...this.stepTemplates.search, desc: `Search for "${topic}"`, params: { query: topic } },
                { icon: '📑', name: 'Open Sources', desc: 'Open top 3-5 sources in tabs', params: { count: 5 } },
                { ...this.stepTemplates.extract, desc: 'Extract key information from each', params: {} },
                { ...this.stepTemplates.compare, desc: 'Cross-reference information', params: {} },
                { ...this.stepTemplates.summarize, desc: 'Create comprehensive summary', params: {} },
                { ...this.stepTemplates.save, desc: 'Save to memory for future reference', params: {} }
            ]
        };
    }

    // Compare items handler
    compareItems(match, original) {
        const item1 = match[2];
        const item2 = match[4];

        return {
            type: 'multi-step',
            name: `Compare: ${item1.substring(0, 15)} vs ${item2.substring(0, 15)}`,
            description: original,
            steps: [
                { ...this.stepTemplates.search, desc: `Search for "${item1}"`, params: { query: item1 } },
                { ...this.stepTemplates.extract, desc: 'Extract details', params: {} },
                { ...this.stepTemplates.search, desc: `Search for "${item2}"`, params: { query: item2 } },
                { ...this.stepTemplates.extract, desc: 'Extract details', params: {} },
                { ...this.stepTemplates.compare, desc: 'Create comparison table', params: { items: [item1, item2] } },
                { ...this.stepTemplates.summarize, desc: 'Summarize differences', params: {} }
            ]
        };
    }

    // Fill form handler
    fillForm(match, original) {
        return {
            type: 'single',
            name: 'Auto-Fill Form',
            description: original,
            action: 'fill-form',
            steps: [
                { icon: '🔍', name: 'Detect', desc: 'Detect form fields', params: {} },
                { icon: '👤', name: 'Match Profile', desc: 'Match with saved profile data', params: {} },
                { ...this.stepTemplates.fill, desc: 'Fill in fields', params: {} }
            ]
        };
    }

    // Download content handler
    downloadContent(match, original) {
        const target = match[2];

        return {
            type: 'single',
            name: `Download ${target.substring(0, 20)}`,
            description: original,
            steps: [
                { ...this.stepTemplates.extract, desc: `Extract ${target}`, params: { type: target } },
                { ...this.stepTemplates.save, desc: 'Save to local', params: {} }
            ]
        };
    }

    // Summarize content handler
    summarizeContent(match, original) {
        const target = match[2];

        return {
            type: 'single',
            name: `Summarize`,
            description: original,
            action: 'summarize',
            steps: [
                { ...this.stepTemplates.extract, desc: 'Extract page content', params: {} },
                { ...this.stepTemplates.summarize, desc: 'Create summary', params: { target } }
            ]
        };
    }

    // Schedule task handler
    scheduleTask(match, original) {
        const task = match[2];
        const time = match[4];

        return {
            type: 'scheduled',
            name: `Scheduled: ${task.substring(0, 25)}`,
            description: original,
            scheduledFor: this.parseTime(time),
            steps: [
                { icon: '⏰', name: 'Schedule', desc: `Set for ${time}`, params: { time } }
            ]
        };
    }

    // Extract data handler
    extractData(match, original) {
        const dataType = match[2];
        const source = match[4];

        return {
            type: 'multi-step',
            name: `Extract ${dataType.substring(0, 20)}`,
            description: original,
            steps: [
                { ...this.stepTemplates.navigate, desc: `Navigate to ${source}`, params: { url: source } },
                { ...this.stepTemplates.extract, desc: `Extract ${dataType}`, params: { type: dataType } },
                { ...this.stepTemplates.save, desc: 'Format and save results', params: {} }
            ]
        };
    }

    // AI interpretation for unrecognized patterns
    async interpretWithAI(command) {
        // Return a simple single-step AI task
        return {
            type: 'ai-interpreted',
            name: command.substring(0, 50),
            description: command,
            steps: [
                { icon: '🤖', name: 'AI Execution', desc: 'AI will interpret and execute this command', params: { command } }
            ]
        };
    }

    // Parse natural time strings
    parseTime(timeStr) {
        const now = new Date();
        const lower = timeStr.toLowerCase();

        // Relative times
        if (/in\s+(\d+)\s+minutes?/i.test(lower)) {
            const mins = parseInt(lower.match(/(\d+)/)[1]);
            return new Date(now.getTime() + mins * 60 * 1000);
        }
        if (/in\s+(\d+)\s+hours?/i.test(lower)) {
            const hours = parseInt(lower.match(/(\d+)/)[1]);
            return new Date(now.getTime() + hours * 60 * 60 * 1000);
        }
        if (/tomorrow/i.test(lower)) {
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            return tomorrow;
        }
        if (/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(lower)) {
            const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const targetDay = days.findIndex(d => lower.includes(d));
            const today = now.getDay();
            const daysUntil = (targetDay + 7 - today) % 7 || 7;
            const target = new Date(now);
            target.setDate(target.getDate() + daysUntil);
            return target;
        }

        // Try to parse as date
        const parsed = new Date(timeStr);
        if (!isNaN(parsed.getTime())) {
            return parsed;
        }

        // Default to 1 hour from now
        return new Date(now.getTime() + 60 * 60 * 1000);
    }

    // Execute a parsed command
    async execute(parsedCommand) {
        const { type, name, steps, action, requiresConfirmation, warning } = parsedCommand;

        // Show confirmation for risky tasks
        if (requiresConfirmation && warning) {
            const confirmed = await this.showConfirmation(name, warning);
            if (!confirmed) return null;
        }

        // Execute based on type
        switch (type) {
            case 'single':
                if (action === 'fill-form' && window.formAgent) {
                    return window.formAgent.analyze();
                }
                if (action === 'summarize' && window.aiPanel) {
                    window.aiPanel.open();
                    return window.aiPanel.handleQuickAction('summarize');
                }
                break;

            case 'multi-step':
                // Add all steps as a queued task
                if (window.taskQueue) {
                    return window.taskQueue.addTask({
                        name: name,
                        command: parsedCommand.description,
                        type: 'ai',
                        priority: 'normal'
                    });
                }
                break;

            case 'guided':
                // Same as multi-step but with confirmation pauses
                if (window.taskQueue) {
                    return window.taskQueue.addTask({
                        name: name,
                        command: parsedCommand.description,
                        type: 'ai',
                        priority: 'normal'
                    });
                }
                break;

            case 'scheduled':
                // Schedule for later
                const delay = parsedCommand.scheduledFor.getTime() - Date.now();
                if (delay > 0) {
                    setTimeout(() => {
                        if (window.taskQueue) {
                            window.taskQueue.addTask({
                                name: name,
                                command: parsedCommand.description,
                                type: 'ai'
                            });
                        }
                    }, delay);
                    return { scheduled: true, for: parsedCommand.scheduledFor };
                }
                break;

            case 'ai-interpreted':
            default:
                // Send directly to AI
                if (window.taskQueue) {
                    return window.taskQueue.addTask({
                        name: name,
                        command: parsedCommand.description,
                        type: 'ai'
                    });
                }
        }
    }

    // Show confirmation dialog
    showConfirmation(title, warning) {
        return new Promise((resolve) => {
            const dialog = document.createElement('div');
            dialog.className = 'smart-command-confirm';
            dialog.innerHTML = `
        <div class="smart-command-confirm-content">
          <div class="smart-command-confirm-icon">⚠️</div>
          <h3>${title}</h3>
          <p>${warning}</p>
          <div class="smart-command-confirm-actions">
            <button class="btn-cancel">Cancel</button>
            <button class="btn-confirm">Continue</button>
          </div>
        </div>
      `;

            document.body.appendChild(dialog);

            dialog.querySelector('.btn-cancel').addEventListener('click', () => {
                dialog.remove();
                resolve(false);
            });

            dialog.querySelector('.btn-confirm').addEventListener('click', () => {
                dialog.remove();
                resolve(true);
            });

            // Auto-show with animation
            setTimeout(() => dialog.classList.add('active'), 10);
        });
    }

    // Show execution plan preview
    showPlanPreview(parsedCommand) {
        const dialog = document.createElement('div');
        dialog.className = 'smart-command-plan';
        dialog.innerHTML = `
      <div class="smart-command-plan-content">
        <div class="smart-command-plan-header">
          <h3>Execution Plan</h3>
          <button class="btn-close">×</button>
        </div>
        <div class="smart-command-plan-title">${parsedCommand.name}</div>
        <p class="smart-command-plan-desc">${parsedCommand.description}</p>
        <div class="smart-command-plan-steps">
          ${parsedCommand.steps.map((step, i) => `
            <div class="smart-command-step">
              <span class="step-number">${i + 1}</span>
              <span class="step-icon">${step.icon}</span>
              <div class="step-info">
                <div class="step-name">${step.name}</div>
                <div class="step-desc">${step.desc}</div>
              </div>
            </div>
          `).join('')}
        </div>
        ${parsedCommand.warning ? `<div class="smart-command-warning">⚠️ ${parsedCommand.warning}</div>` : ''}
        <div class="smart-command-plan-actions">
          <button class="btn-cancel">Cancel</button>
          <button class="btn-execute">Execute Plan</button>
        </div>
      </div>
    `;

        document.body.appendChild(dialog);
        this.injectPlanStyles();

        return new Promise((resolve) => {
            dialog.querySelector('.btn-close').addEventListener('click', () => {
                dialog.remove();
                resolve(null);
            });

            dialog.querySelector('.btn-cancel').addEventListener('click', () => {
                dialog.remove();
                resolve(null);
            });

            dialog.querySelector('.btn-execute').addEventListener('click', () => {
                dialog.remove();
                resolve(parsedCommand);
            });

            setTimeout(() => dialog.classList.add('active'), 10);
        });
    }

    injectPlanStyles() {
        if (document.getElementById('smart-command-styles')) return;

        const style = document.createElement('style');
        style.id = 'smart-command-styles';
        style.textContent = `
      .smart-command-plan, .smart-command-confirm {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(8px);
        z-index: 10002;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.25s;
      }
      
      .smart-command-plan.active, .smart-command-confirm.active {
        opacity: 1;
      }
      
      .smart-command-plan-content, .smart-command-confirm-content {
        background: rgba(25, 25, 35, 0.98);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 20px;
        width: 500px;
        max-width: 90vw;
        max-height: 80vh;
        overflow-y: auto;
        padding: 24px;
        box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5);
      }
      
      .smart-command-plan-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }
      
      .smart-command-plan-header h3 {
        margin: 0;
        color: white;
        font-size: 18px;
      }
      
      .smart-command-plan-header .btn-close {
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.5);
        font-size: 24px;
        cursor: pointer;
      }
      
      .smart-command-plan-title {
        font-size: 16px;
        font-weight: 600;
        color: #6366f1;
        margin-bottom: 8px;
      }
      
      .smart-command-plan-desc {
        color: rgba(255, 255, 255, 0.6);
        font-size: 13px;
        margin-bottom: 20px;
      }
      
      .smart-command-plan-steps {
        background: rgba(255, 255, 255, 0.03);
        border-radius: 12px;
        padding: 12px;
        margin-bottom: 16px;
      }
      
      .smart-command-step {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px;
        border-radius: 8px;
        transition: background 0.2s;
      }
      
      .smart-command-step:hover {
        background: rgba(255, 255, 255, 0.05);
      }
      
      .step-number {
        width: 24px;
        height: 24px;
        background: rgba(99, 102, 241, 0.2);
        color: #6366f1;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 600;
      }
      
      .step-icon {
        font-size: 18px;
      }
      
      .step-info {
        flex: 1;
      }
      
      .step-name {
        color: white;
        font-size: 13px;
        font-weight: 500;
      }
      
      .step-desc {
        color: rgba(255, 255, 255, 0.5);
        font-size: 11px;
      }
      
      .smart-command-warning {
        background: rgba(251, 191, 36, 0.1);
        border: 1px solid rgba(251, 191, 36, 0.3);
        border-radius: 10px;
        padding: 12px;
        color: #fbbf24;
        font-size: 12px;
        margin-bottom: 16px;
      }
      
      .smart-command-plan-actions, .smart-command-confirm-actions {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
      }
      
      .btn-cancel {
        background: rgba(255, 255, 255, 0.1);
        border: none;
        border-radius: 10px;
        color: white;
        padding: 12px 24px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
      }
      
      .btn-cancel:hover {
        background: rgba(255, 255, 255, 0.2);
      }
      
      .btn-execute, .btn-confirm {
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        border: none;
        border-radius: 10px;
        color: white;
        padding: 12px 24px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s;
      }
      
      .btn-execute:hover, .btn-confirm:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
      }
      
      .smart-command-confirm-content {
        text-align: center;
        padding: 32px;
      }
      
      .smart-command-confirm-icon {
        font-size: 48px;
        margin-bottom: 16px;
      }
      
      .smart-command-confirm-content h3 {
        color: white;
        margin: 0 0 8px 0;
      }
      
      .smart-command-confirm-content p {
        color: rgba(255, 255, 255, 0.6);
        margin: 0 0 24px 0;
      }
      
      .smart-command-confirm-actions {
        justify-content: center;
      }
    `;
        document.head.appendChild(style);
    }
}

// Initialize
window.smartCommands = new SmartCommands();
