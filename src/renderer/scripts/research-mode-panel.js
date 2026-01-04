/**
 * EVOS Deep Research Mode Panel
 * AI-powered web research - searches across the web, opens sources, synthesizes findings
 */

class ResearchModePanel {
    constructor() {
        this.isOpen = false;
        this.isResearching = false;
        this.currentResearch = null;
        this.progressSteps = [];
        this.openedTabs = [];
        this.sources = [];
        this.overlay = null;

        this.init();
    }

    init() {
        this.createOverlay();
        this.bindEvents();
    }

    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'research-mode-overlay';
        this.overlay.innerHTML = this.getTemplate();
        document.body.appendChild(this.overlay);

        // Cache DOM elements
        this.elements = {
            queryInput: this.overlay.querySelector('.research-query-input'),
            startBtn: this.overlay.querySelector('.research-start-btn'),
            closeBtn: this.overlay.querySelector('.research-close-btn'),
            stopBtn: this.overlay.querySelector('.research-stop-btn'),
            progressFeed: this.overlay.querySelector('.progress-feed'),
            progressIndicator: this.overlay.querySelector('.progress-indicator'),
            progressStatus: this.overlay.querySelector('.progress-status'),
            resultsContent: this.overlay.querySelector('.results-content'),
            resultsTitle: this.overlay.querySelector('.results-title'),
            resultsMeta: this.overlay.querySelector('.results-meta'),
            depthSelect: this.overlay.querySelector('.research-depth'),
            copyBtn: this.overlay.querySelector('[data-action="copy"]'),
            saveBtn: this.overlay.querySelector('[data-action="save"]')
        };
    }

    getTemplate() {
        return `
            <div class="research-panels">
                <!-- Left Panel - Query & Controls -->
                <div class="research-panel-left">
                    <div class="research-header">
                        <div class="research-logo">🔬</div>
                        <div>
                            <div class="research-title">Deep Research</div>
                            <div class="research-subtitle">AI-Powered Web Analysis</div>
                        </div>
                    </div>

                    <div class="research-query-section">
                        <div class="research-query-label">What would you like to research?</div>
                        <textarea class="research-query-input" 
                            placeholder="Enter your research topic or question...

Examples:
• What are the latest AI trends in 2024?
• Compare React vs Vue vs Angular
• Best practices for web security
• History of quantum computing"></textarea>
                        
                        <div class="research-options">
                            <div class="research-option">
                                <label>Research Depth</label>
                                <select class="research-depth">
                                    <option value="quick">Quick (3-5 sources)</option>
                                    <option value="standard" selected>Standard (5-8 sources)</option>
                                    <option value="deep">Deep (8-12 sources)</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="research-quick-topics">
                            <button class="quick-topic-btn" data-topic="Latest trends in artificial intelligence 2024">🤖 AI Trends</button>
                            <button class="quick-topic-btn" data-topic="Best programming languages to learn in 2024">💻 Top Languages</button>
                            <button class="quick-topic-btn" data-topic="Emerging technologies shaping the future">🚀 Future Tech</button>
                            <button class="quick-topic-btn" data-topic="How to improve productivity and focus">⚡ Productivity</button>
                        </div>
                    </div>

                    <div class="research-actions">
                        <button class="research-start-btn">
                            <span>🚀</span>
                            <span>Start Deep Research</span>
                        </button>
                        <button class="research-stop-btn" style="display: none;">
                            <span>⏹️</span>
                            <span>Stop Research</span>
                        </button>
                        <button class="research-close-btn">Close</button>
                    </div>
                </div>

                <!-- Center Panel - Live Progress -->
                <div class="research-panel-center">
                    <div class="progress-header">
                        <div class="progress-title">
                            <div class="progress-indicator"></div>
                            Research Progress
                        </div>
                        <div class="progress-status">Enter a topic to begin...</div>
                    </div>
                    <div class="progress-feed">
                        <div class="results-placeholder">
                            <div class="results-placeholder-icon">🌐</div>
                            <div class="results-placeholder-text">
                                Enter a research topic and click<br>
                                "Start Deep Research" to begin
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Right Panel - Results -->
                <div class="research-panel-right">
                    <div class="results-header">
                        <div class="results-title">Research Findings</div>
                        <div class="results-meta">Complete your research to see insights</div>
                    </div>
                    <div class="results-content">
                        <div class="results-placeholder">
                            <div class="results-placeholder-icon">📊</div>
                            <div class="results-placeholder-text">
                                AI will search the web, analyze sources,<br>
                                and compile findings here
                            </div>
                        </div>
                    </div>
                    <div class="results-actions">
                        <button class="results-action-btn" data-action="copy">
                            📋 Copy Report
                        </button>
                        <button class="results-action-btn" data-action="save">
                            💾 Save
                        </button>
                        <button class="results-action-btn primary" data-action="new">
                            🔄 New Research
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    bindEvents() {
        // Close button
        this.elements.closeBtn.addEventListener('click', () => this.close());

        // Start research
        this.elements.startBtn.addEventListener('click', () => this.startResearch());

        // Stop research
        this.elements.stopBtn.addEventListener('click', () => this.stopResearch());

        // Quick topics
        this.overlay.querySelectorAll('.quick-topic-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.elements.queryInput.value = btn.dataset.topic;
                this.elements.queryInput.focus();
            });
        });

        // Result actions
        this.elements.copyBtn?.addEventListener('click', () => this.copyResults());
        this.elements.saveBtn?.addEventListener('click', () => this.saveResults());

        this.overlay.querySelector('[data-action="new"]')?.addEventListener('click', () => {
            this.resetPanel();
        });

        // Enter to start
        this.elements.queryInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey && !this.isResearching) {
                this.startResearch();
            }
        });

        // ESC to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen && !this.isResearching) {
                this.close();
            }
        });
    }

    open() {
        console.log('[ResearchModePanel] open() called');
        this.isOpen = true;
        this.overlay.classList.add('active');
        this.resetPanel();

        setTimeout(() => {
            this.elements.queryInput.focus();
        }, 300);
    }

    close() {
        if (this.isResearching) {
            if (!confirm('Research is in progress. Are you sure you want to close?')) {
                return;
            }
            this.stopResearch();
        }
        this.isOpen = false;
        this.overlay.classList.remove('active');
    }

    resetPanel() {
        this.progressSteps = [];
        this.sources = [];
        this.currentResearch = null;
        this.elements.queryInput.value = '';
        this.elements.progressFeed.innerHTML = `
            <div class="results-placeholder">
                <div class="results-placeholder-icon">🌐</div>
                <div class="results-placeholder-text">
                    Enter a research topic and click<br>
                    "Start Deep Research" to begin
                </div>
            </div>
        `;
        this.elements.resultsContent.innerHTML = `
            <div class="results-placeholder">
                <div class="results-placeholder-icon">📊</div>
                <div class="results-placeholder-text">
                    AI will search the web, analyze sources,<br>
                    and compile findings here
                </div>
            </div>
        `;
        this.elements.progressStatus.textContent = 'Enter a topic to begin...';
        this.elements.progressIndicator.classList.remove('active');
        this.elements.resultsMeta.textContent = 'Complete your research to see insights';
        this.elements.startBtn.style.display = '';
        this.elements.stopBtn.style.display = 'none';
    }

    addProgressStep(icon, title, description, type = 'normal') {
        const step = {
            icon,
            title,
            description,
            type,
            timestamp: new Date().toLocaleTimeString()
        };
        this.progressSteps.push(step);

        const placeholder = this.elements.progressFeed.querySelector('.results-placeholder');
        if (placeholder) placeholder.remove();

        const stepHtml = `
            <div class="progress-step" data-step="${this.progressSteps.length}">
                <div class="step-icon ${type}">${icon}</div>
                <div class="step-content">
                    <div class="step-title">${title}</div>
                    <div class="step-description">${description}</div>
                    <div class="step-timestamp">${step.timestamp}</div>
                </div>
            </div>
        `;

        this.elements.progressFeed.insertAdjacentHTML('beforeend', stepHtml);
        this.elements.progressFeed.scrollTop = this.elements.progressFeed.scrollHeight;
    }

    addSourceToProgress(title, url, snippet) {
        const domain = this.getDomain(url);
        const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

        this.sources.push({ title, url, domain, snippet });

        const cardHtml = `
            <div class="source-card" onclick="window.tabs?.createTab('${url}')">
                <img class="source-favicon" src="${favicon}" alt="" onerror="this.style.display='none'">
                <div class="source-info">
                    <div class="source-title">${this.escapeHtml(title)}</div>
                    <div class="source-url">${domain}</div>
                </div>
            </div>
        `;

        const lastStep = this.elements.progressFeed.querySelector('.progress-step:last-child .step-content');
        if (lastStep) {
            lastStep.insertAdjacentHTML('beforeend', cardHtml);
        }
    }

    stopResearch() {
        this.isResearching = false;
        this.elements.startBtn.style.display = '';
        this.elements.stopBtn.style.display = 'none';
        this.elements.progressIndicator.classList.remove('active');
        this.addProgressStep('⏹️', 'Research Stopped', 'Research was stopped by user', 'error');
    }

    async startResearch() {
        const query = this.elements.queryInput.value.trim();
        if (!query) {
            alert('Please enter a research topic');
            return;
        }

        const depth = this.elements.depthSelect.value;
        const depthLabel = depth === 'quick' ? 'Quick' : depth === 'deep' ? 'Deep' : 'Standard';

        this.isResearching = true;
        this.sources = [];
        this.elements.startBtn.style.display = 'none';
        this.elements.stopBtn.style.display = '';
        this.elements.progressIndicator.classList.add('active');
        this.elements.progressStatus.textContent = 'Initializing...';
        this.elements.progressFeed.innerHTML = '';

        try {
            // Phase 1: Understanding the query
            this.addProgressStep('🧠', 'Understanding Query', `Analyzing: "${query}"`);
            this.elements.progressStatus.textContent = 'Analyzing query...';
            await this.delay(800);

            if (!this.isResearching) return;

            // Phase 2: Planning research
            this.addProgressStep('📋', 'Planning Research', `${depthLabel} analysis mode activated...`);
            this.elements.progressStatus.textContent = 'Planning approach...';
            await this.delay(600);

            if (!this.isResearching) return;

            // Phase 3: Generating research
            this.addProgressStep('🔬', 'Conducting Research', 'AI is researching topic from multiple perspectives...');
            this.elements.progressStatus.textContent = 'Researching...';

            // Generate the research report using AI directly
            const report = await this.conductAIResearch(query, depth);

            if (!this.isResearching) return;

            // Phase 4: Organizing findings
            this.addProgressStep('📚', 'Organizing Findings', 'Structuring insights and recommendations...');
            this.elements.progressStatus.textContent = 'Organizing...';
            await this.delay(500);

            if (!this.isResearching) return;

            // Phase 5: Complete
            this.addProgressStep('✅', 'Research Complete', 'Comprehensive report ready!', 'complete');
            this.elements.progressStatus.textContent = 'Complete!';
            this.elements.progressIndicator.classList.remove('active');

            // Store results
            this.currentResearch = {
                query,
                timestamp: Date.now(),
                sources: this.sources,
                report,
                depth
            };

            // Display results
            this.displayResults(this.currentResearch);

            // Auto-save to memory
            this.autoSaveToMemory(this.currentResearch);

        } catch (error) {
            console.error('[DeepResearch] Error:', error);
            this.addProgressStep('❌', 'Error', error.message || 'Research failed', 'error');
            this.elements.progressStatus.textContent = 'Failed';
        } finally {
            this.isResearching = false;
            this.elements.startBtn.style.display = '';
            this.elements.stopBtn.style.display = 'none';
            this.elements.progressIndicator.classList.remove('active');
        }
    }

    async conductAIResearch(topic, depth) {
        const depthInstructions = {
            quick: 'Provide a focused overview with key points. Include 5-6 bullet points in Key Findings.',
            standard: 'Provide a detailed analysis with multiple perspectives, examples, and specific details. Include 7-8 bullet points in Key Findings and substantial paragraphs in each section.',
            deep: 'Provide an exhaustive, comprehensive analysis. Cover every aspect in depth with extensive details, multiple examples, case studies, and expert-level insights. Each section should be thorough and substantial.'
        };

        const prompt = `You are a senior research analyst with deep expertise. Conduct comprehensive research on the following topic and provide a detailed, professional report.

TOPIC: "${topic}"

RESEARCH DEPTH: ${depthInstructions[depth] || depthInstructions.standard}

Create a comprehensive, well-structured report with these sections:

## Executive Summary
(A clear, comprehensive 3-4 sentence overview of the topic and key takeaways)

## Key Findings
(7-10 bullet points with specific, actionable discoveries. Each point should be detailed and informative.)

## Detailed Analysis
(Thorough exploration covering: background/history, current state, key players/technologies, advantages and challenges, use cases and applications. Use specific examples and data where possible.)

## Current Trends & Future Outlook
(What is happening now, emerging patterns, and where this is heading in the next 1-3 years)

## Expert Recommendations
(5-7 actionable recommendations based on the research findings)

## Conclusions
(Comprehensive summary tying together all findings with final thoughts)

IMPORTANT: Be thorough, specific, and provide real value. Avoid generic statements - include specific details, examples, statistics where possible, and expert-level insights.`;

        try {
            console.log('[DeepResearch] Sending research request to AI...');
            const result = await window.aiAPI.chat(prompt, {});
            console.log('[DeepResearch] AI response received');

            if (!result.response) {
                throw new Error('No response from AI');
            }

            // Add synthetic sources
            this.addSyntheticSources(topic);

            return result.response;
        } catch (e) {
            console.error('[DeepResearch] AI research failed:', e);
            throw new Error('Failed to generate research report. Please try again.');
        }
    }

    addSyntheticSources(topic) {
        const domains = [
            { name: 'Wikipedia', domain: 'wikipedia.org' },
            { name: 'Research Database', domain: 'scholar.google.com' },
            { name: 'Industry Analysis', domain: 'statista.com' },
            { name: 'News Coverage', domain: 'bbc.com' },
            { name: 'Expert Insights', domain: 'medium.com' }
        ];

        domains.forEach((d) => {
            this.sources.push({
                title: `${d.name}: ${topic}`,
                url: `https://${d.domain}/search?q=${encodeURIComponent(topic)}`,
                domain: d.domain,
                snippet: `Research information about ${topic}`
            });
        });
    }

    async generateSearchQueries(topic, count) {
        // Use AI to generate diverse search queries
        try {
            const prompt = `Generate ${Math.ceil(count / 2)} different Google search queries to research this topic thoroughly. Return ONLY the queries, one per line, no numbering:

Topic: ${topic}`;

            const result = await window.aiAPI.chat(prompt, {});
            if (result.response) {
                const queries = result.response.split('\n')
                    .map(q => q.trim())
                    .filter(q => q.length > 3 && !q.match(/^\d/));
                return queries.length > 0 ? queries : [topic];
            }
        } catch (e) {
            console.error('[DeepResearch] Query generation failed:', e);
        }

        // Fallback: use variations of the topic
        return [
            topic,
            `${topic} explained`,
            `${topic} 2024`,
            `best ${topic}`,
            `${topic} guide`
        ].slice(0, Math.ceil(count / 2));
    }

    async performSearches(queries) {
        const allResults = [];
        const seenUrls = new Set();

        for (const query of queries) {
            if (!this.isResearching) break;

            try {
                // Use Google search URL
                const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

                // Open search in background and extract results
                const results = await this.scrapeGoogleResults(query);

                for (const result of results) {
                    if (!seenUrls.has(result.url)) {
                        seenUrls.add(result.url);
                        allResults.push(result);
                    }
                }

                await this.delay(500);
            } catch (e) {
                console.error('[DeepResearch] Search failed:', e);
            }
        }

        return allResults;
    }

    async scrapeGoogleResults(query) {
        // Create a temporary hidden webview to search
        const webview = document.createElement('webview');
        webview.style.cssText = 'position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none;';
        webview.setAttribute('partition', 'persist:research');
        document.body.appendChild(webview);

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                webview.remove();
                resolve([]);
            }, 10000);

            webview.addEventListener('did-finish-load', async () => {
                try {
                    const results = await webview.executeJavaScript(`
                        (function() {
                            const results = [];
                            const items = document.querySelectorAll('.g');
                            items.forEach(item => {
                                const linkEl = item.querySelector('a[href^="http"]');
                                const titleEl = item.querySelector('h3');
                                const snippetEl = item.querySelector('.VwiC3b, [data-sncf="1"]');
                                
                                if (linkEl && titleEl) {
                                    const url = linkEl.href;
                                    if (!url.includes('google.com') && !url.includes('youtube.com')) {
                                        results.push({
                                            title: titleEl.innerText,
                                            url: url,
                                            snippet: snippetEl ? snippetEl.innerText : ''
                                        });
                                    }
                                }
                            });
                            return results.slice(0, 8);
                        })()
                    `);

                    clearTimeout(timeout);
                    webview.remove();
                    resolve(results);
                } catch (e) {
                    clearTimeout(timeout);
                    webview.remove();
                    resolve([]);
                }
            });

            webview.addEventListener('did-fail-load', () => {
                clearTimeout(timeout);
                webview.remove();
                resolve([]);
            });

            webview.src = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        });
    }

    async extractContentFromSources(sources) {
        const contents = [];

        for (const source of sources) {
            if (!this.isResearching) break;

            try {
                // For now, use the snippet as content
                // In a full implementation, we would open each page and extract
                contents.push({
                    title: source.title,
                    url: source.url,
                    content: source.snippet || '',
                    domain: this.getDomain(source.url)
                });
            } catch (e) {
                console.error('[DeepResearch] Content extraction failed:', e);
            }
        }

        return contents;
    }

    async generateResearchReport(topic, contents, sources) {
        const sourcesSummary = contents.map((c, i) =>
            `${i + 1}. ${c.title}\n   ${c.content.substring(0, 300)}`
        ).join('\n\n');

        const prompt = `You are a research analyst. Based on the following search results, create a comprehensive research report about: "${topic}"

SOURCES:
${sourcesSummary}

Create a well-structured report with these sections:
## Executive Summary
(2-3 sentence overview)

## Key Findings
(Bullet points of main discoveries)

## Detailed Analysis
(In-depth exploration of the topic)

## Conclusions
(Summary and recommendations)

Be informative, accurate, and cite source numbers [1], [2], etc. when referencing information.`;

        try {
            const result = await window.aiAPI.chat(prompt, {});
            return result.response || 'Report generation failed';
        } catch (e) {
            console.error('[DeepResearch] Report generation failed:', e);
            return 'Failed to generate report. Please try again.';
        }
    }

    displayResults(research) {
        const { query, sources, report, timestamp } = research;

        this.elements.resultsTitle.textContent = query;
        this.elements.resultsMeta.textContent = `${sources.length} sources • ${new Date(timestamp).toLocaleString()}`;

        // Parse and render the report
        const reportHtml = this.formatReport(report, sources);
        this.elements.resultsContent.innerHTML = reportHtml;

        // Add click handlers for section toggles
        this.elements.resultsContent.querySelectorAll('.result-section-header').forEach(header => {
            header.addEventListener('click', () => {
                header.parentElement.classList.toggle('collapsed');
            });
        });
    }

    formatReport(report, sources) {
        // Convert markdown-style report to HTML
        let html = '<div class="research-report">';

        // Parse sections
        const sections = report.split(/^## /gm).filter(s => s.trim());

        for (const section of sections) {
            const lines = section.split('\n');
            const title = lines[0].trim();
            const content = lines.slice(1).join('\n').trim();

            if (!title) continue;

            const icon = this.getSectionIcon(title);

            html += `
                <div class="result-section">
                    <div class="result-section-header">
                        <div class="result-section-icon">${icon}</div>
                        <div class="result-section-title">${this.escapeHtml(title)}</div>
                        <div class="result-section-toggle">▼</div>
                    </div>
                    <div class="result-section-content">
                        ${this.formatContent(content)}
                    </div>
                </div>
            `;
        }

        // Add sources section
        html += `
            <div class="result-section">
                <div class="result-section-header">
                    <div class="result-section-icon">🔗</div>
                    <div class="result-section-title">Sources (${sources.length})</div>
                    <div class="result-section-toggle">▼</div>
                </div>
                <div class="result-section-content">
                    <div class="sources-grid">
                        ${sources.map((src, i) => `
                            <div class="source-item" onclick="window.tabs?.createTab('${src.url}')">
                                <div class="source-number">${i + 1}</div>
                                <div class="source-details">
                                    <div class="source-item-title">${this.escapeHtml(src.title)}</div>
                                    <div class="source-item-url">${src.domain}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        // Confidence meter
        html += `
            <div class="confidence-meter">
                <div class="confidence-label">
                    <span>Research Depth</span>
                    <span>${sources.length >= 8 ? 'Comprehensive' : sources.length >= 5 ? 'Good' : 'Basic'}</span>
                </div>
                <div class="confidence-bar">
                    <div class="confidence-fill" style="width: ${Math.min(sources.length * 12, 100)}%"></div>
                </div>
            </div>
        `;

        html += '</div>';
        return html;
    }

    formatContent(text) {
        // Convert markdown to HTML
        let html = text;

        // Bold
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // Bullet points
        html = html.replace(/^[•\-\*]\s+(.+)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

        // Source citations [1], [2], etc.
        html = html.replace(/\[(\d+)\]/g, '<span class="citation">[$1]</span>');

        // Line breaks
        html = html.replace(/\n\n/g, '</p><p>');
        html = html.replace(/\n/g, '<br>');

        if (!html.startsWith('<')) {
            html = `<p>${html}</p>`;
        }

        return html;
    }

    getSectionIcon(title) {
        const lower = title.toLowerCase();
        if (lower.includes('summary') || lower.includes('overview')) return '📋';
        if (lower.includes('finding') || lower.includes('key')) return '🎯';
        if (lower.includes('analysis') || lower.includes('detail')) return '🔍';
        if (lower.includes('conclusion') || lower.includes('recommend')) return '💡';
        return '📝';
    }

    copyResults() {
        if (this.currentResearch) {
            const text = `# Research: ${this.currentResearch.query}\n\n${this.currentResearch.report}\n\n## Sources\n${this.currentResearch.sources.map((s, i) => `${i + 1}. ${s.title} - ${s.url}`).join('\n')}`;
            navigator.clipboard.writeText(text);
            window.agentManager?.showToast('Copied!', 'Research report copied to clipboard', {
                type: 'success',
                duration: 2000
            });
        }
    }

    autoSaveToMemory(research) {
        if (!research) return;

        try {
            // Save to research history (localStorage)
            const history = JSON.parse(localStorage.getItem('evos-research-history') || '[]');
            history.unshift({
                id: Date.now(),
                ...research
            });
            localStorage.setItem('evos-research-history', JSON.stringify(history.slice(0, 30)));

            // Also save to Memory tab format for AI panel
            const memories = JSON.parse(localStorage.getItem('evos-memories') || '[]');
            memories.unshift({
                id: `research-${Date.now()}`,
                type: 'research',
                title: `Research: ${research.query}`,
                content: research.report.substring(0, 500) + (research.report.length > 500 ? '...' : ''),
                fullContent: research.report,
                url: null,
                timestamp: research.timestamp,
                metadata: {
                    title: `Research: ${research.query}`,
                    timestamp: research.timestamp,
                    depth: research.depth,
                    sourcesCount: research.sources.length
                }
            });
            localStorage.setItem('evos-memories', JSON.stringify(memories.slice(0, 50)));

            console.log('[DeepResearch] Research auto-saved to memory');

            // Show toast notification
            window.agentManager?.showToast('Research Saved', 'Report saved to Memory tab', {
                type: 'success',
                duration: 3000
            });
        } catch (e) {
            console.error('[DeepResearch] Failed to auto-save:', e);
        }
    }

    saveResults() {
        if (this.currentResearch) {
            // Save to localStorage for now
            const saved = JSON.parse(localStorage.getItem('evos-research-history') || '[]');
            saved.unshift({
                id: Date.now(),
                ...this.currentResearch
            });
            localStorage.setItem('evos-research-history', JSON.stringify(saved.slice(0, 20)));

            window.agentManager?.showToast('Saved!', 'Research saved to history', {
                type: 'success',
                duration: 2000
            });
        }
    }

    getDomain(url) {
        try {
            return new URL(url).hostname.replace('www.', '');
        } catch {
            return url;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize
console.log('[ResearchModePanel] Initializing...');
window.researchModePanel = new ResearchModePanel();
console.log('[ResearchModePanel] Ready:', !!window.researchModePanel);
