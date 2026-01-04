/**
 * EVOS Tab State Collector
 * Extracts and syncs content from webviews to the Context Bus
 * Injected into each tab for real-time state tracking
 */

class TabStateCollector {
    constructor() {
        this.tabId = null;
        this.webContentsId = null;
        this.lastUrl = '';
        this.extractionInterval = null;
        this.isInitialized = false;

        this.init();
    }

    async init() {
        // Wait for electronAPI to be available
        if (typeof window.electronAPI === 'undefined') {
            setTimeout(() => this.init(), 100);
            return;
        }

        this.isInitialized = true;
        console.log('[TabStateCollector] Initialized');
    }

    // Register this tab with the Context Bus
    async register(tabId, webContentsId) {
        this.tabId = tabId;
        this.webContentsId = webContentsId;

        try {
            const result = await window.electronAPI.contextBus.registerTab({
                id: tabId,
                webContentsId: webContentsId,
                url: window.location.href,
                title: document.title
            });

            console.log('[TabStateCollector] Registered:', result);

            // Start periodic extraction
            this.startExtraction();

            return result;
        } catch (e) {
            console.error('[TabStateCollector] Registration failed:', e);
            return null;
        }
    }

    // Start periodic content extraction
    startExtraction() {
        // Initial extraction
        this.extractAndSync();

        // Monitor for URL changes
        this.monitorNavigation();

        // Periodic sync (every 5 seconds)
        this.extractionInterval = setInterval(() => {
            this.extractAndSync();
        }, 5000);
    }

    // Stop extraction
    stopExtraction() {
        if (this.extractionInterval) {
            clearInterval(this.extractionInterval);
            this.extractionInterval = null;
        }
    }

    // Monitor for navigation changes
    monitorNavigation() {
        // Use MutationObserver to detect major DOM changes
        const observer = new MutationObserver(() => {
            if (window.location.href !== this.lastUrl) {
                this.lastUrl = window.location.href;
                this.onNavigated();
            }
        });

        observer.observe(document, { subtree: true, childList: true });

        // Also listen for popstate
        window.addEventListener('popstate', () => this.onNavigated());
    }

    // Handle navigation
    onNavigated() {
        console.log('[TabStateCollector] Navigation detected:', window.location.href);
        // Delay extraction to let page load
        setTimeout(() => this.extractAndSync(), 1000);
    }

    // Main extraction and sync method
    async extractAndSync() {
        if (!this.tabId || !this.isInitialized) return;

        try {
            const state = this.extractPageState();

            await window.electronAPI.contextBus.updateTab(this.tabId, {
                url: window.location.href,
                title: document.title,
                content: state.content,
                structuredData: state.structuredData
            });

        } catch (e) {
            console.error('[TabStateCollector] Sync failed:', e);
        }
    }

    // Extract current page state
    extractPageState() {
        return {
            content: this.extractContent(),
            structuredData: this.extractStructuredData()
        };
    }

    // Extract page content
    extractContent() {
        return {
            text: this.extractText(),
            headings: this.extractHeadings(),
            links: this.extractLinks(),
            images: this.extractImages(),
            forms: this.extractForms(),
            meta: this.extractMeta()
        };
    }

    // Extract main text content
    extractText() {
        // Try to find main content area
        const mainSelectors = [
            'main',
            'article',
            '[role="main"]',
            '#content',
            '.content',
            '#main',
            '.main'
        ];

        let mainElement = null;
        for (const selector of mainSelectors) {
            mainElement = document.querySelector(selector);
            if (mainElement) break;
        }

        // Fallback to body
        if (!mainElement) {
            mainElement = document.body;
        }

        // Extract text, excluding scripts and styles
        const clone = mainElement.cloneNode(true);

        // Remove unwanted elements
        const removeSelectors = ['script', 'style', 'nav', 'header', 'footer', 'aside', '[hidden]'];
        removeSelectors.forEach(sel => {
            clone.querySelectorAll(sel).forEach(el => el.remove());
        });

        let text = clone.innerText || clone.textContent || '';

        // Clean up whitespace
        text = text.replace(/\s+/g, ' ').trim();

        // Limit length
        return text.substring(0, 10000);
    }

    // Extract headings
    extractHeadings() {
        const headings = [];

        document.querySelectorAll('h1, h2, h3, h4').forEach((h, index) => {
            if (index < 20) {
                headings.push({
                    level: parseInt(h.tagName.charAt(1)),
                    text: h.innerText.trim().substring(0, 200)
                });
            }
        });

        return headings;
    }

    // Extract links
    extractLinks() {
        const links = [];
        const seen = new Set();

        document.querySelectorAll('a[href]').forEach((a, index) => {
            if (index < 50 && !seen.has(a.href)) {
                seen.add(a.href);
                links.push({
                    text: (a.innerText || a.title || '').trim().substring(0, 100),
                    href: a.href,
                    isExternal: !a.href.startsWith(window.location.origin)
                });
            }
        });

        return links;
    }

    // Extract images
    extractImages() {
        const images = [];

        document.querySelectorAll('img[src]').forEach((img, index) => {
            if (index < 20 && img.width > 50 && img.height > 50) {
                images.push({
                    src: img.src,
                    alt: img.alt || '',
                    width: img.width,
                    height: img.height
                });
            }
        });

        return images;
    }

    // Extract forms
    extractForms() {
        const forms = [];

        document.querySelectorAll('form').forEach((form, index) => {
            if (index < 10) {
                const fields = [];

                form.querySelectorAll('input, select, textarea').forEach((input, i) => {
                    if (i < 20) {
                        fields.push({
                            type: input.type || input.tagName.toLowerCase(),
                            name: input.name || input.id || '',
                            placeholder: input.placeholder || '',
                            label: this.findLabelForInput(input)
                        });
                    }
                });

                forms.push({
                    id: form.id || `form-${index}`,
                    action: form.action || '',
                    method: form.method || 'get',
                    fields: fields
                });
            }
        });

        return forms;
    }

    // Find label for an input
    findLabelForInput(input) {
        // Check for associated label
        if (input.id) {
            const label = document.querySelector(`label[for="${input.id}"]`);
            if (label) return label.innerText.trim();
        }

        // Check for parent label
        const parentLabel = input.closest('label');
        if (parentLabel) return parentLabel.innerText.trim();

        // Check for aria-label
        if (input.getAttribute('aria-label')) {
            return input.getAttribute('aria-label');
        }

        return '';
    }

    // Extract meta information
    extractMeta() {
        return {
            description: document.querySelector('meta[name="description"]')?.content || '',
            keywords: document.querySelector('meta[name="keywords"]')?.content || '',
            author: document.querySelector('meta[name="author"]')?.content || '',
            ogTitle: document.querySelector('meta[property="og:title"]')?.content || '',
            ogDescription: document.querySelector('meta[property="og:description"]')?.content || '',
            ogImage: document.querySelector('meta[property="og:image"]')?.content || '',
            canonical: document.querySelector('link[rel="canonical"]')?.href || ''
        };
    }

    // Extract structured data (prices, products, etc.)
    extractStructuredData() {
        return {
            prices: this.extractPrices(),
            dates: this.extractDates(),
            emails: this.extractEmails(),
            phones: this.extractPhones(),
            products: this.extractProducts(),
            entities: this.extractEntities()
        };
    }

    // Extract prices
    extractPrices() {
        const prices = [];
        const text = document.body.innerText;

        // Common price patterns
        const patterns = [
            /\$[\d,]+\.?\d*/g,           // $1,234.56
            /USD\s*[\d,]+\.?\d*/gi,       // USD 1234
            /₹[\d,]+\.?\d*/g,            // ₹1,234
            /INR\s*[\d,]+\.?\d*/gi,       // INR 1234
            /€[\d,]+\.?\d*/g,            // €1,234
            /£[\d,]+\.?\d*/g,            // £1,234
        ];

        const seen = new Set();
        for (const pattern of patterns) {
            const matches = text.match(pattern) || [];
            for (const match of matches) {
                if (!seen.has(match) && prices.length < 20) {
                    seen.add(match);
                    prices.push(match);
                }
            }
        }

        return prices;
    }

    // Extract dates
    extractDates() {
        const dates = [];
        const text = document.body.innerText;

        // Date patterns
        const patterns = [
            /\d{1,2}\/\d{1,2}\/\d{2,4}/g,        // MM/DD/YYYY
            /\d{4}-\d{2}-\d{2}/g,                 // YYYY-MM-DD
            /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}/gi
        ];

        const seen = new Set();
        for (const pattern of patterns) {
            const matches = text.match(pattern) || [];
            for (const match of matches) {
                if (!seen.has(match) && dates.length < 10) {
                    seen.add(match);
                    dates.push(match);
                }
            }
        }

        return dates;
    }

    // Extract emails
    extractEmails() {
        const text = document.body.innerText;
        const pattern = /[\w.-]+@[\w.-]+\.\w+/g;
        const matches = text.match(pattern) || [];
        return [...new Set(matches)].slice(0, 10);
    }

    // Extract phone numbers
    extractPhones() {
        const text = document.body.innerText;
        const pattern = /(?:\+\d{1,3}\s?)?(?:\(\d{2,4}\)|\d{2,4})[-.\s]?\d{3,4}[-.\s]?\d{4}/g;
        const matches = text.match(pattern) || [];
        return [...new Set(matches)].slice(0, 10);
    }

    // Extract product-like structures
    extractProducts() {
        const products = [];

        // Look for common product card patterns
        const productSelectors = [
            '[data-product]',
            '.product',
            '.product-card',
            '[itemtype*="Product"]',
            '.s-result-item', // Amazon
            '.product-item'
        ];

        for (const selector of productSelectors) {
            document.querySelectorAll(selector).forEach((el, index) => {
                if (index < 10) {
                    const name = el.querySelector('h2, h3, .title, .name, [data-product-name]')?.innerText?.trim();
                    const price = el.querySelector('.price, [data-price], .a-price')?.innerText?.trim();
                    const image = el.querySelector('img')?.src;

                    if (name || price) {
                        products.push({
                            name: name?.substring(0, 200) || '',
                            price: price || '',
                            image: image || ''
                        });
                    }
                }
            });

            if (products.length > 0) break;
        }

        return products;
    }

    // Extract named entities (basic)
    extractEntities() {
        const entities = [];

        // Look for schema.org data
        const schemaScripts = document.querySelectorAll('script[type="application/ld+json"]');
        schemaScripts.forEach(script => {
            try {
                const data = JSON.parse(script.textContent);
                if (data['@type']) {
                    entities.push({
                        type: data['@type'],
                        name: data.name || '',
                        description: data.description?.substring(0, 200) || ''
                    });
                }
            } catch (e) {
                // Invalid JSON
            }
        });

        return entities.slice(0, 10);
    }

    // Cleanup
    destroy() {
        this.stopExtraction();

        if (this.tabId) {
            window.electronAPI?.contextBus?.removeTab(this.tabId);
        }
    }
}

// Export for use in webviews
window.TabStateCollector = TabStateCollector;

// Auto-initialize if in webview context
if (typeof window !== 'undefined') {
    window.tabStateCollector = new TabStateCollector();
}
