/**
 * EVOS Search Agent - Optimized
 * AI-powered search that opens the BEST sources for any query
 */

class SearchAgent {
    constructor() {
        this.maxResults = 5;
        this.defaultResults = 3;

        // Comprehensive source library for different use cases
        this.sources = {
            // General Search
            general: [
                { name: 'Google', url: q => `https://www.google.com/search?q=${encodeURIComponent(q)}`, priority: 1 },
                { name: 'Bing', url: q => `https://www.bing.com/search?q=${encodeURIComponent(q)}`, priority: 2 },
                { name: 'DuckDuckGo', url: q => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`, priority: 3 }
            ],

            // Learning & Education
            learning: [
                { name: 'YouTube', url: q => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}` },
                { name: 'Coursera', url: q => `https://www.coursera.org/search?query=${encodeURIComponent(q)}` },
                { name: 'Udemy', url: q => `https://www.udemy.com/courses/search/?q=${encodeURIComponent(q)}` },
                { name: 'Khan Academy', url: q => `https://www.khanacademy.org/search?page_search_query=${encodeURIComponent(q)}` },
                { name: 'edX', url: q => `https://www.edx.org/search?q=${encodeURIComponent(q)}` },
                { name: 'freeCodeCamp', url: q => `https://www.freecodecamp.org/news/search/?query=${encodeURIComponent(q)}` }
            ],

            // Programming & Development
            programming: [
                { name: 'GitHub', url: q => `https://github.com/search?q=${encodeURIComponent(q)}&type=repositories` },
                { name: 'Stack Overflow', url: q => `https://stackoverflow.com/search?q=${encodeURIComponent(q)}` },
                { name: 'MDN Web Docs', url: q => `https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(q)}` },
                { name: 'Dev.to', url: q => `https://dev.to/search?q=${encodeURIComponent(q)}` },
                { name: 'npm', url: q => `https://www.npmjs.com/search?q=${encodeURIComponent(q)}` },
                { name: 'PyPI', url: q => `https://pypi.org/search/?q=${encodeURIComponent(q)}` }
            ],

            // Shopping & Products
            shopping: [
                { name: 'Amazon', url: q => `https://www.amazon.com/s?k=${encodeURIComponent(q)}` },
                { name: 'eBay', url: q => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}` },
                { name: 'Google Shopping', url: q => `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(q)}` },
                { name: 'Best Buy', url: q => `https://www.bestbuy.com/site/searchpage.jsp?st=${encodeURIComponent(q)}` },
                { name: 'Flipkart', url: q => `https://www.flipkart.com/search?q=${encodeURIComponent(q)}` }
            ],

            // News & Current Events
            news: [
                { name: 'Google News', url: q => `https://news.google.com/search?q=${encodeURIComponent(q)}` },
                { name: 'BBC', url: q => `https://www.bbc.co.uk/search?q=${encodeURIComponent(q)}` },
                { name: 'Reuters', url: q => `https://www.reuters.com/search/news?blob=${encodeURIComponent(q)}` },
                { name: 'Reddit', url: q => `https://www.reddit.com/search/?q=${encodeURIComponent(q)}` }
            ],

            // Academic & Research
            academic: [
                { name: 'Google Scholar', url: q => `https://scholar.google.com/scholar?q=${encodeURIComponent(q)}` },
                { name: 'ResearchGate', url: q => `https://www.researchgate.net/search?q=${encodeURIComponent(q)}` },
                { name: 'Semantic Scholar', url: q => `https://www.semanticscholar.org/search?q=${encodeURIComponent(q)}` },
                { name: 'arXiv', url: q => `https://arxiv.org/search/?query=${encodeURIComponent(q)}&searchtype=all` },
                { name: 'JSTOR', url: q => `https://www.jstor.org/action/doBasicSearch?Query=${encodeURIComponent(q)}` }
            ],

            // Jobs & Career
            jobs: [
                { name: 'LinkedIn Jobs', url: q => `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(q)}` },
                { name: 'Indeed', url: q => `https://www.indeed.com/jobs?q=${encodeURIComponent(q)}` },
                { name: 'Glassdoor', url: q => `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${encodeURIComponent(q)}` },
                { name: 'AngelList', url: q => `https://angel.co/role/l/${encodeURIComponent(q)}` }
            ],

            // Images & Media
            media: [
                { name: 'Google Images', url: q => `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}` },
                { name: 'Unsplash', url: q => `https://unsplash.com/s/photos/${encodeURIComponent(q)}` },
                { name: 'Pexels', url: q => `https://www.pexels.com/search/${encodeURIComponent(q)}/` },
                { name: 'Pinterest', url: q => `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(q)}` }
            ],

            // Documentation & Reference
            documentation: [
                { name: 'W3Schools', url: q => `https://www.w3schools.com/search/search_result.asp?q=${encodeURIComponent(q)}` },
                { name: 'Wikipedia', url: q => `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(q)}` },
                { name: 'GeeksForGeeks', url: q => `https://www.geeksforgeeks.org/search/?cx=009682134359037907028%3Aae3b1wjqw54&cof=FORID%3A10&ie=UTF-8&q=${encodeURIComponent(q)}` }
            ],

            // AI & Tools
            ai: [
                { name: 'Hugging Face', url: q => `https://huggingface.co/models?search=${encodeURIComponent(q)}` },
                { name: 'Papers With Code', url: q => `https://paperswithcode.com/search?q=${encodeURIComponent(q)}` },
                { name: 'Kaggle', url: q => `https://www.kaggle.com/search?q=${encodeURIComponent(q)}` }
            ]
        };

        // Keywords to detect categories
        this.categoryKeywords = {
            learning: ['tutorial', 'learn', 'course', 'how to', 'guide', 'beginner', 'lesson', 'training', 'education', 'study'],
            programming: ['code', 'programming', 'developer', 'software', 'api', 'library', 'framework', 'github', 'npm', 'python', 'javascript', 'react', 'node', 'java', 'bug', 'error', 'debug'],
            shopping: ['buy', 'price', 'product', 'cheap', 'deal', 'discount', 'shop', 'purchase', 'order', 'review', 'best', 'vs', 'comparison', 'under $', 'under ₹'],
            news: ['news', 'latest', 'today', 'current', 'breaking', 'update', 'event', '2024', '2025'],
            academic: ['research', 'paper', 'study', 'journal', 'academic', 'thesis', 'scientific', 'publication', 'citation', 'peer-reviewed'],
            jobs: ['job', 'career', 'hiring', 'position', 'vacancy', 'employment', 'work', 'salary', 'remote job', 'internship'],
            media: ['image', 'photo', 'picture', 'wallpaper', 'icon', 'graphic', 'design', 'art'],
            documentation: ['documentation', 'docs', 'reference', 'manual', 'syntax', 'definition', 'what is', 'meaning'],
            ai: ['machine learning', 'deep learning', 'ai model', 'neural network', 'gpt', 'llm', 'transformer', 'dataset']
        };
    }

    /**
     * Main search entry point
     */
    async search(prompt, numResults = null) {
        if (!prompt?.trim()) {
            window.agentManager?.showToast('Empty Search', 'Please provide a search query.', { type: 'warning' });
            return;
        }

        window.agentManager?.showStatus('Agentic Search', 'Analyzing your request...', {
            icon: '🔎',
            progress: 10
        });

        try {
            // Step 1: Detect categories and get AI optimization
            const searchPlan = await this.generateSearchPlan(prompt, numResults);

            window.agentManager?.updateProgress(40, `Found ${searchPlan.categories.length} relevant categories...`);

            // Step 2: Select best sources based on categories
            const selectedSources = this.selectSources(searchPlan);

            window.agentManager?.updateProgress(60, `Opening ${selectedSources.length} optimized sources...`);

            // Step 3: Open sources in tabs
            const opened = await this.openSources(selectedSources, searchPlan.query);

            // Success message
            const categoryNames = searchPlan.categories.slice(0, 3).join(', ');
            window.agentManager?.showStatus('Search Complete!', `Opened ${opened} pages (${categoryNames})`, {
                icon: '✅',
                type: 'success',
                progress: 100
            });

            setTimeout(() => window.agentManager?.hideStatus(), 4000);
            return { query: searchPlan.query, opened, categories: searchPlan.categories };

        } catch (error) {
            console.error('[SearchAgent] Error:', error);
            window.agentManager?.showStatus('Search Failed', error.message, { icon: '❌', type: 'error' });
            setTimeout(() => window.agentManager?.hideStatus(), 4000);
        }
    }

    /**
     * Detect categories from query and optionally use AI for optimization
     */
    async generateSearchPlan(prompt, requestedResults) {
        const lowerPrompt = prompt.toLowerCase();
        const detectedCategories = [];

        // Detect categories from keywords
        for (const [category, keywords] of Object.entries(this.categoryKeywords)) {
            if (keywords.some(kw => lowerPrompt.includes(kw))) {
                detectedCategories.push(category);
            }
        }

        // Always include general search
        if (!detectedCategories.includes('general')) {
            detectedCategories.unshift('general');
        }

        // Try AI optimization
        let optimizedQuery = this.cleanQuery(prompt);
        let numResults = requestedResults || this.defaultResults;

        if (window.aiAPI?.generateText) {
            try {
                const aiPrompt = `Optimize this search query for best results. User wants: "${prompt}"

Return ONLY JSON (no markdown):
{"query": "optimized search terms", "numResults": ${requestedResults || 3}}

Rules:
- query: Clean, focused search terms (remove filler words)
- numResults: 1-5 based on topic complexity`;

                const response = await window.aiAPI.generateText(aiPrompt);
                const jsonMatch = response.match(/\{[\s\S]*?\}/);

                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    optimizedQuery = parsed.query || optimizedQuery;
                    if (!requestedResults) {
                        numResults = Math.min(Math.max(parsed.numResults || 3, 1), this.maxResults);
                    }
                }
            } catch (e) {
                console.log('[SearchAgent] AI optimization skipped');
            }
        }

        return {
            query: optimizedQuery,
            categories: detectedCategories,
            numResults: Math.min(numResults, this.maxResults)
        };
    }

    /**
     * Clean the query of filler phrases
     */
    cleanQuery(prompt) {
        return prompt
            .replace(/^(search for|find|look for|search|find me|get me|show me|i want|i need|please|can you)\s+/gi, '')
            .replace(/\s+(please|for me|now)$/gi, '')
            .trim();
    }

    /**
     * Select the best sources based on detected categories
     */
    selectSources(searchPlan) {
        const { categories, numResults } = searchPlan;
        const selected = [];
        const usedNames = new Set();

        // Strategy: Pick 1-2 sources from each relevant category, prioritizing diversity
        const sourcesPerCategory = Math.max(1, Math.floor(numResults / categories.length));

        for (const category of categories) {
            const categorySources = this.sources[category] || [];
            let added = 0;

            for (const source of categorySources) {
                if (added >= sourcesPerCategory) break;
                if (usedNames.has(source.name)) continue;

                selected.push(source);
                usedNames.add(source.name);
                added++;
            }
        }

        // If we haven't reached numResults, add more from general
        while (selected.length < numResults) {
            const generalSources = this.sources.general;
            const next = generalSources.find(s => !usedNames.has(s.name));
            if (!next) break;
            selected.push(next);
            usedNames.add(next.name);
        }

        return selected.slice(0, numResults);
    }

    /**
     * Open sources in new tabs
     */
    async openSources(sources, query) {
        const tabManager = window.evosBrowser?.tabManager;
        if (!tabManager) return 0;

        let opened = 0;
        for (const source of sources) {
            try {
                const url = typeof source.url === 'function' ? source.url(query) : source.url;
                tabManager.createTab(url);
                opened++;
                await new Promise(r => setTimeout(r, 150));
            } catch (e) {
                console.error('[SearchAgent] Failed to open:', source.name, e);
            }
        }
        return opened;
    }
}

// Initialize
window.searchAgent = new SearchAgent();
