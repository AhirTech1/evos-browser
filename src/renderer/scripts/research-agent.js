/**
 * EVOS Research Agent
 * Cross-tab research synthesis and comparison
 * Features: Concise output, proper table rendering, saved history
 */

class ResearchAgent {
    constructor() {
        this.lastResearch = null;
        this.history = []; // Saved research history
        this.loadHistory();
    }

    /**
     * Load history from storage
     */
    async loadHistory() {
        try {
            if (window.aiAPI && window.aiAPI.getResearchHistory) {
                this.history = await window.aiAPI.getResearchHistory() || [];
            } else {
                // Use localStorage fallback
                const saved = localStorage.getItem('evos-research-history');
                this.history = saved ? JSON.parse(saved) : [];
            }
        } catch (e) {
            this.history = [];
        }
    }

    /**
     * Save research to history
     */
    async saveToHistory(research) {
        this.history.unshift({
            id: Date.now(),
            timestamp: research.timestamp,
            title: `Research: ${research.sources.length} pages`,
            sources: research.sources.map(s => ({ title: s.title, url: s.url })),
            comparison: research.comparison
        });

        // Keep only last 20 entries
        if (this.history.length > 20) {
            this.history = this.history.slice(0, 20);
        }

        // Save
        try {
            if (window.aiAPI && window.aiAPI.saveResearchHistory) {
                await window.aiAPI.saveResearchHistory(this.history);
            } else {
                localStorage.setItem('evos-research-history', JSON.stringify(this.history));
            }
        } catch (e) {
            console.error('[ResearchAgent] Failed to save history:', e);
        }
    }

    /**
     * Extract detailed content from a tab
     */
    async extractResearchContent(webview) {
        const script = `
      (function() {
        const data = {
          title: document.title,
          url: window.location.href,
          content: '',
          structured: {}
        };

        const main = document.querySelector('main, article, [role="main"], .main-content, #content');
        const contentEl = main || document.body;
        
        const clone = contentEl.cloneNode(true);
        clone.querySelectorAll('script, style, noscript, iframe, nav, footer, aside, .ad').forEach(el => el.remove());
        data.content = (clone.innerText || '').substring(0, 4000);

        // Extract structured data
        const price = document.querySelector('[class*="price"], [data-price], .price')?.textContent;
        const rating = document.querySelector('[class*="rating"], [class*="stars"]')?.textContent;
        
        if (price) data.structured.price = price.trim().substring(0, 50);
        if (rating) data.structured.rating = rating.trim().substring(0, 30);

        // GitHub
        if (window.location.hostname === 'github.com') {
          data.structured.stars = document.querySelector('[href*="stargazers"]')?.textContent?.trim();
          data.structured.language = document.querySelector('[itemprop="programmingLanguage"]')?.textContent?.trim();
        }

        return data;
      })()
    `;

        try {
            return await webview.executeJavaScript(script);
        } catch (error) {
            return null;
        }
    }

    /**
     * Main analyze method
     */
    async analyze(data = {}) {
        window.agentManager.showStatus('Research Agent', 'Gathering content...', {
            icon: '🔬',
            progress: 5
        });

        const webviews = document.querySelectorAll('webview');
        const targetIndices = data.tabIndices || Array.from({ length: webviews.length }, (_, i) => i);
        const contents = [];

        for (let i = 0; i < targetIndices.length; i++) {
            const webview = webviews[targetIndices[i]];
            if (!webview) continue;

            window.agentManager.updateProgress(5 + (i / targetIndices.length) * 40, `Tab ${i + 1}/${targetIndices.length}`);

            try {
                const content = await this.extractResearchContent(webview);
                if (content && content.content.length > 100) {
                    contents.push({ index: targetIndices[i], ...content });
                }
            } catch (e) { }
        }

        if (contents.length < 2) {
            window.agentManager.showStatus('Research Agent', 'Need at least 2 tabs', {
                icon: '❌',
                type: 'error'
            });
            setTimeout(() => window.agentManager.hideStatus(), 3000);
            return;
        }

        window.agentManager.updateProgress(50, 'Analyzing...');

        const comparison = await this.generateComparison(contents);

        this.lastResearch = {
            timestamp: Date.now(),
            sources: contents,
            comparison
        };

        // Save to history
        await this.saveToHistory(this.lastResearch);

        window.agentManager.showStatus('Research Complete!', `${contents.length} pages analyzed`, {
            icon: '✅',
            type: 'success',
            progress: 100,
            actions: [
                { id: 'view', label: 'View Report', primary: true, onClick: () => this.showReport() }
            ]
        });

        window.agentManager.showToast('Research Ready', 'Click to view your comparison report.', {
            type: 'success',
            duration: 8000,
            actions: [{ id: 'view', label: 'View', primary: true, onClick: () => this.showReport() }]
        });

        return this.lastResearch;
    }

    /**
     * Generate comparison - CONCISE prompt
     */
    async generateComparison(contents) {
        if (!window.aiAPI) return this.generateBasicComparison(contents);

        const items = contents.map((c, i) => {
            let info = `${i + 1}. ${c.title}\n`;
            if (c.structured.price) info += `   Price: ${c.structured.price}\n`;
            if (c.structured.rating) info += `   Rating: ${c.structured.rating}\n`;
            if (c.structured.stars) info += `   Stars: ${c.structured.stars}\n`;
            info += `   ${c.content.substring(0, 500)}`;
            return info;
        }).join('\n\n');

        const prompt = `Compare these ${contents.length} items CONCISELY:

${items}

Respond in this exact format:
## Summary
[1-2 sentences]

## Comparison
| Item | Key Feature | Price/Rating | Verdict |
|------|-------------|--------------|---------|
[Fill table rows]

## Recommendation
[1 sentence recommendation]`;

        try {
            const result = await window.aiAPI.chat(prompt, {});
            return result.response || this.generateBasicComparison(contents);
        } catch (error) {
            return this.generateBasicComparison(contents);
        }
    }

    /**
     * Basic comparison fallback
     */
    generateBasicComparison(contents) {
        let report = `## Summary\nCompared ${contents.length} pages.\n\n## Items\n`;
        contents.forEach((c, i) => {
            report += `${i + 1}. **${c.title}**\n`;
            if (c.structured.price) report += `   - Price: ${c.structured.price}\n`;
            if (c.structured.rating) report += `   - Rating: ${c.structured.rating}\n`;
        });
        return report;
    }

    /**
     * Convert markdown to HTML with proper table support
     */
    markdownToHtml(md) {
        let html = md;

        // Tables (must be done before other replacements)
        html = html.replace(/\|(.+)\|\n\|[-:|]+\|\n((?:\|.+\|\n?)+)/g, (match, header, rows) => {
            const headers = header.split('|').filter(h => h.trim()).map(h => `<th>${h.trim()}</th>`).join('');
            const rowsHtml = rows.trim().split('\n').map(row => {
                const cells = row.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
                return `<tr>${cells}</tr>`;
            }).join('');
            return `<table class="research-table"><thead><tr>${headers}</tr></thead><tbody>${rowsHtml}</tbody></table>`;
        });

        // Headers
        html = html.replace(/^### (.*$)/gm, '<h4>$1</h4>');
        html = html.replace(/^## (.*$)/gm, '<h3>$1</h3>');
        html = html.replace(/^# (.*$)/gm, '<h2>$1</h2>');

        // Bold/Italic
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

        // Lists
        html = html.replace(/^- (.*$)/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

        // Line breaks (but not around block elements)
        html = html.replace(/\n(?!<)/g, '<br>');
        html = html.replace(/<br>(<h|<ul|<table)/g, '$1');
        html = html.replace(/(<\/h\d>|<\/ul>|<\/table>)<br>/g, '$1');

        return html;
    }

    /**
     * Display the research report with proper styling
     */
    showReport() {
        if (!this.lastResearch) {
            window.agentManager.showToast('No Research', 'Run analysis first.', { type: 'info' });
            return;
        }

        const { comparison, sources } = this.lastResearch;
        const html = this.markdownToHtml(comparison);

        const styledHtml = `
            <style>
                .research-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
                .research-table th { background: rgba(139, 92, 246, 0.3); padding: 10px; text-align: left; border: 1px solid rgba(255,255,255,0.1); }
                .research-table td { padding: 10px; border: 1px solid rgba(255,255,255,0.1); }
                .research-table tr:hover { background: rgba(255,255,255,0.05); }
                h2, h3, h4 { color: #a78bfa; margin: 16px 0 8px; }
                ul { padding-left: 20px; margin: 8px 0; }
                li { margin: 4px 0; }
            </style>
            <div style="max-height: 450px; overflow-y: auto; line-height: 1.5; font-size: 14px;">
                ${html}
                <div style="margin-top: 20px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 11px; color: rgba(255,255,255,0.5);">
                    Sources: ${sources.map((s, i) => `<a href="${s.url}" style="color: #60a5fa;">${i + 1}. ${s.title.substring(0, 30)}</a>`).join(' | ')}
                </div>
            </div>
        `;

        window.agentManager.showModal('Research Report', styledHtml, [
            { id: 'copy', label: 'Copy', onClick: () => this.copyReport() },
            { id: 'history', label: 'History', onClick: () => this.showHistory() },
            { id: 'close', label: 'Close', primary: true }
        ], { icon: '📊' });
    }

    /**
     * Show research history
     */
    showHistory() {
        if (this.history.length === 0) {
            window.agentManager.showToast('No History', 'No saved research yet.', { type: 'info' });
            return;
        }

        const items = this.history.map(h => `
            <div style="padding: 12px; margin: 8px 0; background: rgba(255,255,255,0.05); border-radius: 8px; cursor: pointer;" 
                 onclick="window.researchAgent.loadFromHistory(${h.id})">
                <div style="font-weight: 600; font-size: 13px;">${h.title}</div>
                <div style="font-size: 11px; color: rgba(255,255,255,0.5);">${new Date(h.timestamp).toLocaleString()}</div>
            </div>
        `).join('');

        window.agentManager.showModal('Research History', `<div style="max-height: 400px; overflow-y: auto;">${items}</div>`, [
            { id: 'clear', label: 'Clear All', onClick: () => { this.history = []; localStorage.removeItem('evos-research-history'); } },
            { id: 'close', label: 'Close', primary: true }
        ], { icon: '📚' });
    }

    /**
     * Load a research from history
     */
    loadFromHistory(id) {
        const research = this.history.find(h => h.id === id);
        if (research) {
            this.lastResearch = {
                timestamp: research.timestamp,
                sources: research.sources,
                comparison: research.comparison
            };
            this.showReport();
        }
    }

    /**
     * Copy report to clipboard
     */
    copyReport() {
        if (this.lastResearch) {
            navigator.clipboard.writeText(this.lastResearch.comparison);
            window.agentManager.showToast('Copied!', 'Report copied.', { type: 'success', duration: 2000 });
        }
    }
}

// Initialize
window.researchAgent = new ResearchAgent();
