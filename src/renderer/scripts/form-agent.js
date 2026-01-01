/**
 * EVOS Form-Filling Agent
 * Automatically fills forms using user profile data from ProfileManager
 */

class FormAgent {
    constructor() {
        this.userProfile = null;
        this.autofillHistory = [];
        this.loadAutofillHistory();
    }

    /**
     * Load autofill history from localStorage
     */
    loadAutofillHistory() {
        try {
            const saved = localStorage.getItem('evos-autofill-history');
            this.autofillHistory = saved ? JSON.parse(saved) : [];
        } catch (e) {
            this.autofillHistory = [];
        }
    }

    /**
     * Save autofill history
     */
    saveAutofillHistory() {
        try {
            // Keep only last 50 entries
            if (this.autofillHistory.length > 50) {
                this.autofillHistory = this.autofillHistory.slice(-50);
            }
            localStorage.setItem('evos-autofill-history', JSON.stringify(this.autofillHistory));
        } catch (e) {
            console.error('[FormAgent] Failed to save history:', e);
        }
    }

    /**
     * Add entry to autofill history
     */
    addToHistory(url, title, filledFields) {
        this.autofillHistory.push({
            id: Date.now(),
            timestamp: Date.now(),
            url: url,
            title: title || url,
            domain: new URL(url).hostname,
            fieldCount: filledFields,
            profileName: window.profileManager?.getActiveProfile()?.name || 'Unknown'
        });
        this.saveAutofillHistory();
    }

    /**
     * Get autofill history (for searching)
     */
    getHistory() {
        return this.autofillHistory;
    }

    /**
     * Search autofill history
     */
    searchHistory(query) {
        const q = query.toLowerCase();
        return this.autofillHistory.filter(h =>
            h.url.toLowerCase().includes(q) ||
            h.title.toLowerCase().includes(q) ||
            h.domain.toLowerCase().includes(q)
        );
    }

    /**
     * Generate username from first+last name (no dots, add digits if needed)
     */
    generateUsername(attempt = 0) {
        const p = this.userProfile?.personal || {};
        const first = (p.firstName || '').toLowerCase().replace(/[^a-z]/g, '');
        const last = (p.lastName || '').toLowerCase().replace(/[^a-z]/g, '');

        if (!first && !last) return '';

        let username = first + last;

        // Add random digits for subsequent attempts
        if (attempt > 0) {
            const digits = Math.floor(Math.random() * 900) + 100; // 3 random digits
            username += digits;
        }

        return username;
    }

    /**
     * Get profile from ProfileManager (called before each fill)
     */
    loadUserProfile() {
        if (window.profileManager) {
            const profile = window.profileManager.getActiveProfile();
            if (profile) {
                // Flatten profile for easier access
                this.userProfile = {
                    personal: profile.personal || {},
                    professional: profile.professional || {},
                    social: {
                        linkedin: profile.professional?.linkedin || '',
                        github: profile.professional?.github || '',
                        website: profile.professional?.website || ''
                    },
                    customFields: profile.customFields || {}
                };
                return;
            }
        }

        // Fallback empty profile
        this.userProfile = {
            personal: {
                firstName: '',
                lastName: '',
                email: '',
                phone: '',
                address: { city: '', country: '' }
            },
            professional: { title: '', company: '' },
            social: {}
        };
    }

    /**
     * Analyze form fields on the current page
     */
    async analyzeForm(webview) {
        const script = `
      (function() {
        const fields = [];
        const inputs = document.querySelectorAll('input, select, textarea, [contenteditable="true"]');
        
        inputs.forEach((el, index) => {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return; // Skip hidden
          
          const field = {
            index,
            tag: el.tagName.toLowerCase(),
            type: el.type || 'text',
            name: el.name || '',
            id: el.id || '',
            placeholder: el.placeholder || '',
            label: '',
            ariaLabel: el.getAttribute('aria-label') || '',
            required: el.required || false,
            value: el.value || '',
            options: []
          };
          
          // Find associated label
          if (el.id) {
            const label = document.querySelector('label[for="' + el.id + '"]');
            if (label) field.label = label.textContent.trim();
          }
          
          // Check parent for label
          if (!field.label) {
            const parent = el.closest('label, .form-group, .field, [class*="input"]');
            if (parent) {
              const labelEl = parent.querySelector('label, .label, [class*="label"]');
              if (labelEl) field.label = labelEl.textContent.trim();
            }
          }
          
          // Get select options
          if (el.tagName === 'SELECT') {
            field.options = Array.from(el.options).map(o => ({
              value: o.value,
              text: o.textContent.trim()
            }));
          }
          
          // Generate unique selector
          if (el.id) {
            field.selector = '#' + el.id;
          } else if (el.name) {
            field.selector = '[name="' + el.name + '"]';
          } else {
            field.selector = el.tagName.toLowerCase() + ':nth-of-type(' + (index + 1) + ')';
          }
          
          fields.push(field);
        });
        
        return fields;
      })()
    `;

        try {
            const fields = await webview.executeJavaScript(script);
            return fields;
        } catch (error) {
            console.error('[FormAgent] Failed to analyze form:', error);
            return [];
        }
    }

    /**
     * Map form fields to user profile data using AI
     */
    async mapFieldsToProfile(fields) {
        if (!window.aiAPI || !this.userProfile) return [];

        // Build a prompt for the LLM
        const fieldDescriptions = fields.map((f, i) =>
            `${i}. ${f.label || f.name || f.placeholder || f.ariaLabel || 'Unknown field'} (type: ${f.type})`
        ).join('\n');

        const profileSummary = JSON.stringify(this.userProfile, null, 2);

        const prompt = `You are a form-filling assistant. Map these form fields to the user's profile data.

FORM FIELDS:
${fieldDescriptions}

USER PROFILE:
${profileSummary}

For each field, respond with a JSON array where each element has:
- fieldIndex: the field number
- value: the value to fill (from profile or best guess)
- confidence: "high", "medium", or "low"
- skip: true if field shouldn't be auto-filled (like passwords, captchas)

Respond ONLY with the JSON array, no explanation.`;

        try {
            const result = await window.aiAPI.chat(prompt, {});

            // Parse the response
            const responseText = result.response || '';
            const jsonMatch = responseText.match(/\[[\s\S]*\]/);

            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (error) {
            console.error('[FormAgent] AI mapping failed:', error);
        }

        // Fallback: simple heuristic mapping
        return this.heuristicMapping(fields);
    }

    /**
     * Simple heuristic field mapping (fallback)
     */
    heuristicMapping(fields) {
        const mappings = [];
        const profile = this.userProfile;

        const keywords = {
            firstName: ['first', 'fname', 'given'],
            lastName: ['last', 'lname', 'surname', 'family'],
            email: ['email', 'e-mail', 'mail'],
            phone: ['phone', 'tel', 'mobile', 'cell'],
            address: ['address', 'street'],
            city: ['city', 'town'],
            state: ['state', 'province', 'region'],
            zip: ['zip', 'postal', 'postcode'],
            country: ['country', 'nation'],
            company: ['company', 'employer', 'organization', 'org'],
            title: ['title', 'position', 'role', 'job'],
            linkedin: ['linkedin'],
            github: ['github'],
            website: ['website', 'portfolio', 'url', 'homepage'],
            username: ['username', 'user', 'userid', 'user_id', 'login', 'nickname', 'handle']
        };

        fields.forEach((field, index) => {
            const fieldText = `${field.label} ${field.name} ${field.placeholder} ${field.ariaLabel}`.toLowerCase();

            let value = '';
            let confidence = 'low';
            let skip = false;

            // Skip certain field types
            if (['password', 'file', 'hidden', 'submit', 'button', 'image'].includes(field.type)) {
                skip = true;
            }

            // Check each keyword set
            for (const [profileKey, keywordList] of Object.entries(keywords)) {
                if (keywordList.some(kw => fieldText.includes(kw))) {
                    // Special handling for username
                    if (profileKey === 'username') {
                        value = this.generateUsername();
                        confidence = value ? 'high' : 'low';
                        break;
                    }

                    // Get value from profile
                    if (profileKey in profile.personal) {
                        value = profile.personal[profileKey];
                    } else if (profile.personal.address && profileKey in profile.personal.address) {
                        value = profile.personal.address[profileKey];
                    } else if (profileKey in profile.professional) {
                        value = profile.professional[profileKey];
                    } else if (profileKey in profile.social) {
                        value = profile.social[profileKey];
                    }

                    if (value) confidence = 'high';
                    break;
                }
            }

            mappings.push({
                fieldIndex: index,
                value: value || '',
                confidence,
                skip
            });
        });

        return mappings;
    }

    /**
     * Fill form fields in the webview
     */
    async fillFields(webview, fields, mappings) {
        const filledCount = { success: 0, skipped: 0, failed: 0 };

        for (const mapping of mappings) {
            if (mapping.skip || !mapping.value) {
                filledCount.skipped++;
                continue;
            }

            const field = fields[mapping.fieldIndex];
            if (!field) continue;

            const script = `
        (function() {
          const el = document.querySelector('${field.selector.replace(/'/g, "\\'")}');
          if (!el) return false;
          
          // Focus the element
          el.focus();
          
          // Clear existing value
          el.value = '';
          
          // Set new value
          el.value = '${(mapping.value + '').replace(/'/g, "\\'")}';
          
          // Trigger events
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          
          // For React/Angular apps
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, 'value'
          )?.set;
          if (nativeInputValueSetter) {
            nativeInputValueSetter.call(el, '${(mapping.value + '').replace(/'/g, "\\'")}');
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }
          
          return true;
        })()
      `;

            try {
                const success = await webview.executeJavaScript(script);
                if (success) {
                    filledCount.success++;
                } else {
                    filledCount.failed++;
                }
            } catch (error) {
                console.error(`[FormAgent] Failed to fill field ${field.selector}:`, error);
                filledCount.failed++;
            }

            // Small delay between fields
            await new Promise(r => setTimeout(r, 100));
        }

        return filledCount;
    }

    /**
     * Main fill method called by agent manager
     */
    async fill(data = {}) {
        const webview = document.querySelector('webview.active');
        if (!webview) {
            throw new Error('No active page to fill');
        }

        // Load current profile data
        this.loadUserProfile();

        // Show status
        window.agentManager.showStatus('Form Agent', 'Analyzing form fields...', {
            icon: '📝',
            progress: 10
        });

        // Step 1: Analyze form
        const fields = await this.analyzeForm(webview);

        if (fields.length === 0) {
            window.agentManager.showStatus('Form Agent', 'No form fields found on this page', {
                icon: '❌',
                type: 'error'
            });
            setTimeout(() => window.agentManager.hideStatus(), 3000);
            return;
        }

        window.agentManager.updateProgress(30, `Found ${fields.length} fields. Mapping...`);

        // Step 2: Map fields to profile
        const mappings = await this.mapFieldsToProfile(fields);

        window.agentManager.updateProgress(60, 'Filling form...');

        // Step 3: Fill fields
        const result = await this.fillFields(webview, fields, mappings);

        // Step 4: Show completion
        window.agentManager.showStatus(
            'Form Filled!',
            `${result.success} fields filled, ${result.skipped} skipped`,
            {
                icon: '✅',
                type: 'success',
                progress: 100,
                actions: [
                    {
                        id: 'review',
                        label: 'Review Form',
                        primary: true,
                        onClick: () => {
                            // Switch to the tab with the form
                            window.agentManager.hideStatus();
                        }
                    }
                ]
            }
        );

        // Also show toast for users on different tabs
        window.agentManager.showToast(
            'Form Filling Complete',
            `Filled ${result.success} fields on the page. Review before submitting.`,
            {
                type: 'success',
                duration: 10000,
                actions: [
                    {
                        id: 'view',
                        label: 'View Form',
                        primary: true,
                        onClick: () => {
                            // Scroll form into view
                        }
                    }
                ]
            }
        );

        // Save to autofill history
        try {
            const pageInfo = await webview.executeJavaScript('({ url: window.location.href, title: document.title })');
            if (result.success > 0) {
                this.addToHistory(pageInfo.url, pageInfo.title, result.success);
            }
        } catch (e) {
            // Ignore history save errors
        }
    }

    /**
     * Update user profile
     */
    async updateProfile(updates) {
        Object.assign(this.userProfile, updates);

        if (window.aiAPI && window.aiAPI.saveUserProfile) {
            await window.aiAPI.saveUserProfile(this.userProfile);
        }
    }
}

// Initialize global form agent
window.formAgent = new FormAgent();
