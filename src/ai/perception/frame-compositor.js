/**
 * EVOS Frame Compositor
 * Hybrid Vision-DOM Grounding for reliable element finding
 * Combines Accessibility Tree + Visual Screenshots for robust automation
 */

class FrameCompositor {
    constructor() {
        this.lastCapture = null;
        this.elementMap = new Map();
        this.captureInProgress = false;

        console.log('[FrameCompositor] Initialized');
    }

    /**
     * Capture unified frame with both DOM and visual data
     * @param {Object} context - Browser context with webview
     * @returns {Object} - Unified frame data
     */
    async captureFrame(context) {
        if (this.captureInProgress) {
            return this.lastCapture;
        }

        this.captureInProgress = true;

        try {
            const frame = {
                timestamp: Date.now(),
                url: '',
                viewport: { width: 0, height: 0 },
                elements: [],
                accessibilityTree: null,
                screenshot: null
            };

            if (!context.webview) {
                return frame;
            }

            // Get URL and viewport
            frame.url = context.webview.getURL();

            // Step 1: Extract DOM elements with bounding boxes
            const domData = await this.extractDOMElements(context.webview);
            frame.elements = domData.elements;
            frame.viewport = domData.viewport;

            // Step 2: Extract accessibility tree
            frame.accessibilityTree = await this.extractAccessibilityTree(context.webview);

            // Step 3: Capture screenshot (optional, for visual grounding)
            if (context.captureScreenshot !== false) {
                frame.screenshot = await this.captureScreenshot(context.webview);
            }

            // Step 4: Merge and enrich element data
            frame.elements = this.mergeWithAccessibility(frame.elements, frame.accessibilityTree);

            this.lastCapture = frame;
            this.buildElementMap(frame.elements);

            return frame;

        } finally {
            this.captureInProgress = false;
        }
    }

    /**
     * Extract interactive DOM elements with bounding boxes
     */
    async extractDOMElements(webview) {
        const script = `
      (function() {
        const viewport = {
          width: window.innerWidth,
          height: window.innerHeight
        };
        
        const elements = [];
        const interactiveSelectors = 'a, button, input, select, textarea, [role="button"], [role="link"], [role="textbox"], [tabindex], [onclick]';
        
        document.querySelectorAll(interactiveSelectors).forEach((el, index) => {
          if (index >= 200) return; // Limit for performance
          
          const rect = el.getBoundingClientRect();
          
          // Skip invisible elements
          if (rect.width === 0 || rect.height === 0) return;
          if (rect.bottom < 0 || rect.top > viewport.height) return;
          if (rect.right < 0 || rect.left > viewport.width) return;
          
          const style = window.getComputedStyle(el);
          if (style.visibility === 'hidden' || style.display === 'none') return;
          if (parseFloat(style.opacity) < 0.1) return;
          
          const element = {
            index: elements.length,
            tagName: el.tagName.toLowerCase(),
            type: el.type || null,
            id: el.id || null,
            className: el.className || null,
            name: el.name || null,
            
            // Bounding box
            bounds: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              centerX: Math.round(rect.x + rect.width / 2),
              centerY: Math.round(rect.y + rect.height / 2)
            },
            
            // Content
            text: (el.innerText || el.value || el.placeholder || '').substring(0, 100).trim(),
            ariaLabel: el.getAttribute('aria-label') || '',
            title: el.title || '',
            alt: el.alt || '',
            href: el.href || null,
            
            // Interaction hints
            isClickable: el.tagName.toLowerCase() === 'a' || el.tagName.toLowerCase() === 'button' || 
                         el.getAttribute('role') === 'button' || !!el.onclick,
            isEditable: ['input', 'textarea', 'select'].includes(el.tagName.toLowerCase()) ||
                        el.contentEditable === 'true',
            isVisible: true,
            
            // Generate selector
            selector: (() => {
              if (el.id) return '#' + el.id;
              if (el.name) return el.tagName.toLowerCase() + '[name="' + el.name + '"]';
              if (el.className) {
                const classes = el.className.split(' ').filter(c => c).slice(0, 2).join('.');
                if (classes) return el.tagName.toLowerCase() + '.' + classes;
              }
              return el.tagName.toLowerCase() + ':nth-of-type(' + (Array.from(el.parentNode?.children || []).indexOf(el) + 1) + ')';
            })()
          };
          
          elements.push(element);
        });
        
        return { elements, viewport };
      })()
    `;

        try {
            return await webview.executeJavaScript(script);
        } catch (e) {
            console.error('[FrameCompositor] DOM extraction failed:', e);
            return { elements: [], viewport: { width: 0, height: 0 } };
        }
    }

    /**
     * Extract accessibility tree (simplified)
     */
    async extractAccessibilityTree(webview) {
        const script = `
      (function() {
        const tree = [];
        const roles = ['button', 'link', 'textbox', 'checkbox', 'radio', 'combobox', 'listbox', 
                       'menu', 'menuitem', 'tab', 'dialog', 'alert', 'navigation', 'main', 'form'];
        
        function extractNode(el, depth = 0) {
          if (depth > 5) return null;
          
          const role = el.getAttribute('role') || getImplicitRole(el);
          if (!role) return null;
          
          const node = {
            role: role,
            name: getAccessibleName(el),
            state: getState(el),
            bounds: (() => {
              const rect = el.getBoundingClientRect();
              return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
            })()
          };
          
          return node;
        }
        
        function getImplicitRole(el) {
          const tagRoles = {
            'a': el.href ? 'link' : null,
            'button': 'button',
            'input': el.type === 'checkbox' ? 'checkbox' : el.type === 'radio' ? 'radio' : 'textbox',
            'select': 'combobox',
            'textarea': 'textbox',
            'nav': 'navigation',
            'main': 'main',
            'form': 'form'
          };
          return tagRoles[el.tagName.toLowerCase()] || null;
        }
        
        function getAccessibleName(el) {
          return el.getAttribute('aria-label') || 
                 el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby'))?.innerText ||
                 el.title || 
                 el.innerText?.substring(0, 50) || 
                 el.alt || 
                 '';
        }
        
        function getState(el) {
          return {
            disabled: el.disabled || el.getAttribute('aria-disabled') === 'true',
            checked: el.checked || el.getAttribute('aria-checked') === 'true',
            expanded: el.getAttribute('aria-expanded') === 'true',
            hidden: el.hidden || el.getAttribute('aria-hidden') === 'true'
          };
        }
        
        document.querySelectorAll('[role],' + roles.map(r => r).join(',')).forEach(el => {
          const node = extractNode(el);
          if (node) tree.push(node);
        });
        
        return tree.slice(0, 100); // Limit
      })()
    `;

        try {
            return await webview.executeJavaScript(script);
        } catch (e) {
            console.error('[FrameCompositor] A11y extraction failed:', e);
            return [];
        }
    }

    /**
     * Capture screenshot from webview
     */
    async captureScreenshot(webview) {
        try {
            // Use webview's capturePage method
            const image = await webview.capturePage();
            return image.toDataURL();
        } catch (e) {
            console.warn('[FrameCompositor] Screenshot capture failed:', e.message);
            return null;
        }
    }

    /**
     * Merge DOM elements with accessibility data
     */
    mergeWithAccessibility(elements, a11yTree) {
        if (!a11yTree || a11yTree.length === 0) return elements;

        // Enrich elements with a11y info
        return elements.map(el => {
            // Find matching a11y node by bounds
            const a11yNode = a11yTree.find(node => {
                if (!node.bounds) return false;
                const dx = Math.abs(node.bounds.x - el.bounds.x);
                const dy = Math.abs(node.bounds.y - el.bounds.y);
                return dx < 5 && dy < 5;
            });

            if (a11yNode) {
                return {
                    ...el,
                    role: a11yNode.role,
                    accessibleName: a11yNode.name,
                    state: a11yNode.state
                };
            }

            return el;
        });
    }

    /**
     * Build element map for fast lookup
     */
    buildElementMap(elements) {
        this.elementMap.clear();

        elements.forEach((el, index) => {
            // By index
            this.elementMap.set(`index:${index}`, el);

            // By selector
            if (el.selector) {
                this.elementMap.set(`selector:${el.selector}`, el);
            }

            // By text (lowercase)
            if (el.text) {
                const key = `text:${el.text.toLowerCase()}`;
                if (!this.elementMap.has(key)) {
                    this.elementMap.set(key, el);
                }
            }

            // By accessible name
            if (el.accessibleName) {
                const key = `a11y:${el.accessibleName.toLowerCase()}`;
                if (!this.elementMap.has(key)) {
                    this.elementMap.set(key, el);
                }
            }
        });
    }

    /**
     * Find element by description (uses multiple strategies)
     */
    findElement(description, frame = null) {
        const targetFrame = frame || this.lastCapture;
        if (!targetFrame || !targetFrame.elements) return null;

        const lowerDesc = description.toLowerCase();

        // Strategy 1: Exact text match
        for (const el of targetFrame.elements) {
            if (el.text && el.text.toLowerCase() === lowerDesc) {
                return { element: el, confidence: 1.0, strategy: 'exact_text' };
            }
        }

        // Strategy 2: Partial text match
        for (const el of targetFrame.elements) {
            if (el.text && el.text.toLowerCase().includes(lowerDesc)) {
                return { element: el, confidence: 0.8, strategy: 'partial_text' };
            }
        }

        // Strategy 3: Accessible name match
        for (const el of targetFrame.elements) {
            if (el.accessibleName && el.accessibleName.toLowerCase().includes(lowerDesc)) {
                return { element: el, confidence: 0.75, strategy: 'accessible_name' };
            }
        }

        // Strategy 4: Aria label match
        for (const el of targetFrame.elements) {
            if (el.ariaLabel && el.ariaLabel.toLowerCase().includes(lowerDesc)) {
                return { element: el, confidence: 0.7, strategy: 'aria_label' };
            }
        }

        // Strategy 5: Fuzzy match on combined text
        const words = lowerDesc.split(/\s+/);
        let bestMatch = null;
        let bestScore = 0;

        for (const el of targetFrame.elements) {
            const elText = [el.text, el.ariaLabel, el.accessibleName, el.title]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            const matchedWords = words.filter(w => elText.includes(w));
            const score = matchedWords.length / words.length;

            if (score > bestScore && score > 0.5) {
                bestScore = score;
                bestMatch = el;
            }
        }

        if (bestMatch) {
            return { element: bestMatch, confidence: bestScore * 0.6, strategy: 'fuzzy' };
        }

        return null;
    }

    /**
     * Find element at coordinates
     */
    findElementAtPoint(x, y, frame = null) {
        const targetFrame = frame || this.lastCapture;
        if (!targetFrame || !targetFrame.elements) return null;

        // Find element whose bounds contain the point
        for (const el of targetFrame.elements) {
            const { bounds } = el;
            if (x >= bounds.x && x <= bounds.x + bounds.width &&
                y >= bounds.y && y <= bounds.y + bounds.height) {
                return el;
            }
        }

        return null;
    }

    /**
     * Get clickable elements
     */
    getClickableElements(frame = null) {
        const targetFrame = frame || this.lastCapture;
        if (!targetFrame) return [];

        return targetFrame.elements.filter(el => el.isClickable);
    }

    /**
     * Get editable elements
     */
    getEditableElements(frame = null) {
        const targetFrame = frame || this.lastCapture;
        if (!targetFrame) return [];

        return targetFrame.elements.filter(el => el.isEditable);
    }

    /**
     * Generate element summary for AI
     */
    generateElementSummary(frame = null) {
        const targetFrame = frame || this.lastCapture;
        if (!targetFrame) return '';

        const clickables = this.getClickableElements(targetFrame);
        const editables = this.getEditableElements(targetFrame);

        let summary = `Page: ${targetFrame.url}\n`;
        summary += `Viewport: ${targetFrame.viewport.width}x${targetFrame.viewport.height}\n\n`;

        if (clickables.length > 0) {
            summary += `Clickable Elements (${clickables.length}):\n`;
            clickables.slice(0, 20).forEach((el, i) => {
                const label = el.text || el.ariaLabel || el.accessibleName || el.selector;
                summary += `  [${i}] ${el.tagName}: "${label.substring(0, 40)}"\n`;
            });
        }

        if (editables.length > 0) {
            summary += `\nEditable Elements (${editables.length}):\n`;
            editables.slice(0, 10).forEach((el, i) => {
                const label = el.ariaLabel || el.name || el.placeholder || el.selector;
                summary += `  [${i}] ${el.tagName} (${el.type || 'text'}): "${label?.substring(0, 40)}"\n`;
            });
        }

        return summary;
    }

    /**
     * Get last capture info
     */
    getLastCapture() {
        return this.lastCapture;
    }
}

// Singleton
const frameCompositor = new FrameCompositor();

module.exports = { FrameCompositor, frameCompositor };
