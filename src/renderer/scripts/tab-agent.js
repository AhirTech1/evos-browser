/**
 * EVOS Tab Organization Agent
 * Automatically groups and organizes tabs by semantic similarity
 */

class TabAgent {
    constructor() {
        this.tabGroups = [];
    }

    /**
     * Extract content summary from a webview
     */
    async extractTabContent(webview) {
        const script = `
      (function() {
        // Get main content
        const body = document.body.cloneNode(true);
        body.querySelectorAll('script, style, noscript, iframe, nav, footer, header, aside').forEach(el => el.remove());
        
        const text = (body.innerText || '').substring(0, 2000);
        const title = document.title || '';
        const url = window.location.href;
        
        // Extract meta info
        const description = document.querySelector('meta[name="description"]')?.content || '';
        const keywords = document.querySelector('meta[name="keywords"]')?.content || '';
        
        // Detect page type
        let pageType = 'general';
        if (url.includes('github.com')) pageType = 'code';
        else if (url.includes('stackoverflow.com')) pageType = 'qa';
        else if (url.includes('amazon.com') || url.includes('ebay.com')) pageType = 'shopping';
        else if (url.includes('youtube.com') || url.includes('vimeo.com')) pageType = 'video';
        else if (url.includes('linkedin.com') || url.includes('indeed.com')) pageType = 'jobs';
        else if (url.includes('docs.') || url.includes('documentation')) pageType = 'docs';
        
        return {
          title,
          url,
          description,
          keywords,
          pageType,
          textExcerpt: text.substring(0, 500)
        };
      })()
    `;

        try {
            return await webview.executeJavaScript(script);
        } catch (error) {
            console.error('[TabAgent] Failed to extract content:', error);
            return null;
        }
    }

    /**
     * Get all open tabs and their content
     */
    async getAllTabsContent() {
        const webviews = document.querySelectorAll('webview');
        const tabs = [];

        for (let i = 0; i < webviews.length; i++) {
            const webview = webviews[i];
            const tabData = {
                index: i,
                isActive: webview.classList.contains('active'),
                content: null
            };

            try {
                tabData.content = await this.extractTabContent(webview);
            } catch (e) {
                // Skip tabs that can't be read
            }

            if (tabData.content) {
                tabs.push(tabData);
            }
        }

        return tabs;
    }

    /**
     * Group tabs using AI
     */
    async groupTabsWithAI(tabs) {
        if (!window.aiAPI || tabs.length < 2) return [];

        const tabDescriptions = tabs.map((t, i) =>
            `Tab ${i}: "${t.content.title}" - ${t.content.url.substring(0, 60)} (${t.content.pageType})`
        ).join('\n');

        const prompt = `You are a tab organization assistant. Group these browser tabs into logical categories.

TABS:
${tabDescriptions}

Create 2-5 groups based on topic/purpose similarity. For each group:
1. Give it a short, descriptive name (2-4 words)
2. List which tab indices belong to it
3. Write a 1-sentence summary of the group

Respond with JSON:
{
  "groups": [
    {
      "name": "Group Name",
      "tabIndices": [0, 2, 5],
      "summary": "Brief description of what these tabs are about"
    }
  ]
}

Respond ONLY with JSON.`;

        try {
            const result = await window.aiAPI.chat(prompt, {});
            const responseText = result.response || '';

            // Parse JSON from response
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const data = JSON.parse(jsonMatch[0]);
                return data.groups || [];
            }
        } catch (error) {
            console.error('[TabAgent] AI grouping failed:', error);
        }

        // Fallback: group by page type
        return this.groupByPageType(tabs);
    }

    /**
     * Fallback grouping by page type
     */
    groupByPageType(tabs) {
        const typeGroups = {};

        tabs.forEach(tab => {
            const type = tab.content.pageType || 'general';
            if (!typeGroups[type]) {
                typeGroups[type] = {
                    name: this.getTypeDisplayName(type),
                    tabIndices: [],
                    summary: `Pages of type: ${type}`
                };
            }
            typeGroups[type].tabIndices.push(tab.index);
        });

        return Object.values(typeGroups).filter(g => g.tabIndices.length > 0);
    }

    getTypeDisplayName(type) {
        const names = {
            'code': '💻 Code & Repos',
            'qa': '❓ Q&A',
            'shopping': '🛒 Shopping',
            'video': '🎬 Videos',
            'jobs': '💼 Jobs & Career',
            'docs': '📚 Documentation',
            'general': '📄 General'
        };
        return names[type] || type;
    }

    /**
     * Apply tab groups to the UI
     */
    async applyGroups(groups, tabs) {
        // Store groups for display
        this.tabGroups = groups.map(g => ({
            ...g,
            tabs: g.tabIndices.map(i => tabs.find(t => t.index === i)).filter(Boolean)
        }));

        // Apply to the real TabManager
        if (window.evosBrowser && window.evosBrowser.tabManager) {
            window.evosBrowser.tabManager.applyAIGroups(groups);
        }

        return this.tabGroups;
    }

    /**
     * Generate summary for a group of tabs
     */
    async summarizeGroup(group) {
        if (!window.aiAPI) return 'Summary not available';

        const tabInfo = group.tabs.map(t =>
            `- ${t.content.title}: ${t.content.textExcerpt.substring(0, 200)}`
        ).join('\n');

        const prompt = `Summarize these related browser tabs in 2-3 sentences:

${tabInfo}

Be concise and highlight the common theme.`;

        try {
            const result = await window.aiAPI.chat(prompt, {});
            return result.response || group.summary;
        } catch (error) {
            return group.summary;
        }
    }

    /**
     * Main organize method called by agent manager
     */
    async organize(data = {}) {
        window.agentManager.showStatus('Tab Agent', 'Analyzing your tabs...', {
            icon: '🗂️',
            progress: 10
        });

        // Step 1: Get all tab content
        const tabs = await this.getAllTabsContent();

        if (tabs.length < 2) {
            window.agentManager.showStatus('Tab Agent', 'Need at least 2 tabs to organize', {
                icon: '📋',
                type: 'error'
            });
            setTimeout(() => window.agentManager.hideStatus(), 3000);
            return;
        }

        window.agentManager.updateProgress(40, `Analyzing ${tabs.length} tabs...`);

        // Step 2: Group tabs
        const groups = await this.groupTabsWithAI(tabs);

        window.agentManager.updateProgress(70, 'Creating groups...');

        // Step 3: Apply groups
        await this.applyGroups(groups, tabs);

        window.agentManager.updateProgress(100, 'Done!');

        // Step 4: Show results
        const groupSummary = groups.map(g => `• ${g.name} (${g.tabIndices.length} tabs)`).join('\n');

        window.agentManager.showStatus(
            'Tabs Organized!',
            `Created ${groups.length} groups`,
            {
                icon: '✅',
                type: 'success',
                actions: [
                    {
                        id: 'view',
                        label: 'View Groups',
                        primary: true,
                        onClick: () => this.showGroupsPanel()
                    }
                ]
            }
        );

        window.agentManager.showToast(
            'Tabs Organized',
            `Grouped into ${groups.length} categories:\n${groupSummary}`,
            {
                type: 'success',
                duration: 8000
            }
        );

        return groups;
    }

    /**
     * Show a panel with all groups
     */
    showGroupsPanel() {
        const body = this.tabGroups.map(g => `
      <div style="margin-bottom: 16px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px;">
        <div style="font-weight: 600; margin-bottom: 8px;">${g.name}</div>
        <div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 8px;">${g.summary}</div>
        <div style="font-size: 11px; color: rgba(255,255,255,0.5);">
          ${g.tabs.map(t => t.content.title).join(' • ')}
        </div>
      </div>
    `).join('');

        window.agentManager.showModal(
            'Tab Groups',
            `<div style="max-height: 400px; overflow-y: auto;">${body}</div>`,
            [{ id: 'close', label: 'Close', primary: true }],
            { icon: '🗂️' }
        );
    }

    /**
     * Compare tabs (for research synthesis)
     */
    async compareTabs(tabIndices) {
        const webviews = document.querySelectorAll('webview');
        const contents = [];

        for (const idx of tabIndices) {
            const webview = webviews[idx];
            if (webview) {
                const content = await this.extractTabContent(webview);
                if (content) contents.push(content);
            }
        }

        if (contents.length < 2) {
            throw new Error('Need at least 2 tabs to compare');
        }

        return contents;
    }
}

// Initialize global tab agent
window.tabAgent = new TabAgent();
