/**
 * EVOS Self-Healing Macro Engine
 * AI-powered automatic repair of macros when selectors break
 */

class HealingEngine {
    constructor() {
        this.healingHistory = new Map(); // Track healing attempts
        this.maxHealingAttempts = 3;
        this.successfulHeals = 0;
        this.failedHeals = 0;

        console.log('[HealingEngine] Initialized');
    }

    /**
     * Try to heal a broken macro step
     * @param {Object} step - The macro step that failed
     * @param {Object} context - Current page context
     * @returns {Object} - Healed step or null if healing failed
     */
    async heal(step, context) {
        const healKey = `${step.selector}-${context.url}`;

        // Check if we've exceeded healing attempts
        const attempts = this.healingHistory.get(healKey) || 0;
        if (attempts >= this.maxHealingAttempts) {
            console.warn(`[HealingEngine] Max healing attempts reached for ${step.selector}`);
            return { success: false, reason: 'Max healing attempts exceeded' };
        }

        this.healingHistory.set(healKey, attempts + 1);

        console.log(`[HealingEngine] Attempting to heal: ${step.selector}`);

        try {
            // Strategy 1: Try alternative selectors
            const alternativeResult = await this.tryAlternativeSelectors(step, context);
            if (alternativeResult.success) {
                this.successfulHeals++;
                return alternativeResult;
            }

            // Strategy 2: Use AI to find element by intent
            const aiResult = await this.findByIntent(step, context);
            if (aiResult.success) {
                this.successfulHeals++;
                return aiResult;
            }

            // Strategy 3: Use visual matching (if available)
            const visualResult = await this.findByVisual(step, context);
            if (visualResult.success) {
                this.successfulHeals++;
                return visualResult;
            }

            this.failedHeals++;
            return { success: false, reason: 'All healing strategies failed' };

        } catch (error) {
            console.error('[HealingEngine] Healing error:', error);
            this.failedHeals++;
            return { success: false, reason: error.message };
        }
    }

    /**
     * Strategy 1: Try alternative selectors based on the original
     */
    async tryAlternativeSelectors(step, context) {
        const originalSelector = step.selector;
        const alternatives = this.generateAlternativeSelectors(step);

        for (const alt of alternatives) {
            const exists = await this.checkSelectorExists(alt, context);
            if (exists) {
                console.log(`[HealingEngine] Found alternative: ${alt}`);
                return {
                    success: true,
                    strategy: 'alternative_selector',
                    originalSelector,
                    newSelector: alt,
                    confidence: 0.7
                };
            }
        }

        return { success: false };
    }

    /**
     * Generate alternative selectors from the original
     */
    generateAlternativeSelectors(step) {
        const alternatives = [];
        const original = step.selector;

        // If it's an ID selector, try class-based
        if (original.startsWith('#')) {
            const id = original.slice(1);
            alternatives.push(`[id*="${id}"]`);
            alternatives.push(`[data-testid*="${id}"]`);
            alternatives.push(`[data-id*="${id}"]`);
        }

        // If it has a specific class, try partial match
        if (original.includes('.')) {
            const parts = original.split('.');
            for (const part of parts) {
                if (part && !part.includes('[')) {
                    alternatives.push(`[class*="${part}"]`);
                }
            }
        }

        // Try by tag and text content if we have text
        if (step.text) {
            const tag = original.match(/^[a-z]+/i)?.[0] || 'button';
            alternatives.push(`${tag}:contains("${step.text}")`);
            alternatives.push(`*[text()*="${step.text}"]`);
        }

        // Try by role and accessible name
        if (step.intent) {
            alternatives.push(`[role="button"][aria-label*="${step.intent}"]`);
            alternatives.push(`button[aria-label*="${step.intent}"]`);
            alternatives.push(`a[aria-label*="${step.intent}"]`);
        }

        // Try common alternative patterns
        if (original.includes('submit')) {
            alternatives.push('[type="submit"]');
            alternatives.push('button[type="submit"]');
            alternatives.push('input[type="submit"]');
        }

        if (original.includes('search')) {
            alternatives.push('[type="search"]');
            alternatives.push('input[type="search"]');
            alternatives.push('[role="search"] input');
        }

        return alternatives;
    }

    /**
     * Strategy 2: Use AI to find element by intent/description
     */
    async findByIntent(step, context) {
        // Build a description of what we're looking for
        const description = this.buildElementDescription(step);

        // Ask AI to find the element
        if (window.aiAPI && typeof window.aiAPI.chat === 'function') {
            const prompt = `I need to find an element on this webpage. The element should be:
${description}

The page URL is: ${context.url}
The visible page content includes: ${context.visibleText?.substring(0, 500)}

Based on common web patterns, what CSS selector would most likely find this element?
Respond with ONLY the CSS selector, nothing else.`;

            try {
                const result = await window.aiAPI.chat(prompt, { mode: 'online' });
                const suggestedSelector = result.response?.trim();

                if (suggestedSelector && !suggestedSelector.includes(' ')) {
                    // Verify the selector works
                    const exists = await this.checkSelectorExists(suggestedSelector, context);
                    if (exists) {
                        return {
                            success: true,
                            strategy: 'ai_intent',
                            originalSelector: step.selector,
                            newSelector: suggestedSelector,
                            confidence: 0.6
                        };
                    }
                }
            } catch (e) {
                console.warn('[HealingEngine] AI intent search failed:', e.message);
            }
        }

        return { success: false };
    }

    /**
     * Build a natural language description of an element
     */
    buildElementDescription(step) {
        const parts = [];

        if (step.tagName) parts.push(`A ${step.tagName} element`);
        if (step.text) parts.push(`with text "${step.text}"`);
        if (step.intent) parts.push(`that ${step.intent}`);
        if (step.type) parts.push(`of type "${step.type}"`);
        if (step.action === 'click') parts.push('that should be clickable');
        if (step.action === 'type') parts.push('that accepts text input');

        return parts.join(' ') || 'an interactive element';
    }

    /**
     * Strategy 3: Use visual matching (screenshot comparison)
     * This is a placeholder for future visual AI integration
     */
    async findByVisual(step, context) {
        // If we have a stored screenshot of the element
        if (step.screenshot) {
            // In a full implementation, this would:
            // 1. Take a screenshot of the current page
            // 2. Use image similarity to find the element
            // 3. Get the bounding box and derive a selector

            console.log('[HealingEngine] Visual matching not yet implemented');
        }

        return { success: false };
    }

    /**
     * Check if a selector exists on the page
     */
    async checkSelectorExists(selector, context) {
        if (!context.webview) return false;

        try {
            const script = `!!document.querySelector('${selector.replace(/'/g, "\\'")}')`;
            return await context.webview.executeJavaScript(script);
        } catch (e) {
            return false;
        }
    }

    /**
     * Get all possible selectors for an element
     */
    async getElementSelectors(element, context) {
        if (!context.webview) return [];

        const script = `
      (function() {
        const el = document.querySelector('${element.replace(/'/g, "\\'")}');
        if (!el) return [];
        
        const selectors = [];
        
        // ID
        if (el.id) selectors.push('#' + el.id);
        
        // Classes
        if (el.className) {
          const classes = el.className.split(' ').filter(c => c);
          if (classes.length > 0) {
            selectors.push('.' + classes.join('.'));
          }
        }
        
        // Tag + attributes
        const tag = el.tagName.toLowerCase();
        if (el.name) selectors.push(tag + '[name="' + el.name + '"]');
        if (el.type) selectors.push(tag + '[type="' + el.type + '"]');
        
        // Data attributes
        for (const attr of el.attributes) {
          if (attr.name.startsWith('data-')) {
            selectors.push('[' + attr.name + '="' + attr.value + '"]');
          }
        }
        
        // Aria
        if (el.getAttribute('aria-label')) {
          selectors.push('[aria-label="' + el.getAttribute('aria-label') + '"]');
        }
        
        return selectors;
      })()
    `;

        try {
            return await context.webview.executeJavaScript(script);
        } catch (e) {
            return [];
        }
    }

    /**
     * Update a macro with healed selectors
     */
    updateMacro(macro, healedSteps) {
        const updatedMacro = { ...macro };
        updatedMacro.steps = macro.steps.map((step, index) => {
            const healed = healedSteps.find(h => h.stepIndex === index);
            if (healed && healed.success) {
                return {
                    ...step,
                    selector: healed.newSelector,
                    originalSelector: step.selector,
                    healedAt: Date.now(),
                    healingStrategy: healed.strategy
                };
            }
            return step;
        });

        updatedMacro.lastHealed = Date.now();
        updatedMacro.healCount = (macro.healCount || 0) + 1;

        return updatedMacro;
    }

    /**
     * Get healing stats
     */
    getStats() {
        return {
            successfulHeals: this.successfulHeals,
            failedHeals: this.failedHeals,
            successRate: this.successfulHeals / (this.successfulHeals + this.failedHeals) || 0,
            activeHealingAttempts: this.healingHistory.size
        };
    }

    /**
     * Reset healing attempts for a selector
     */
    resetAttempts(selector) {
        for (const [key] of this.healingHistory) {
            if (key.startsWith(selector)) {
                this.healingHistory.delete(key);
            }
        }
    }

    /**
     * Clear all healing history
     */
    clearHistory() {
        this.healingHistory.clear();
    }
}

// Singleton
const healingEngine = new HealingEngine();

module.exports = { HealingEngine, healingEngine };
