// EVOS Browser - Browser Automation Tools
// Tools that the AI agent can use to interact with web pages

class BrowserTools {
  constructor() {
    this.tools = this.defineTools();
  }

  // Define all available tools
  defineTools() {
    return {
      navigate_to: {
        name: 'navigate_to',
        description: 'Navigate the browser to a specific URL',
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The URL to navigate to'
            }
          },
          required: ['url']
        },
        execute: this.navigateTo.bind(this)
      },

      search_web: {
        name: 'search_web',
        description: 'Search the web using the default search engine',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query'
            }
          },
          required: ['query']
        },
        execute: this.searchWeb.bind(this)
      },

      click_element: {
        name: 'click_element',
        description: 'Click on an element on the page using a CSS selector',
        parameters: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'CSS selector for the element to click'
            }
          },
          required: ['selector']
        },
        execute: this.clickElement.bind(this)
      },

      type_text: {
        name: 'type_text',
        description: 'Type text into an input field',
        parameters: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'CSS selector for the input field'
            },
            text: {
              type: 'string',
              description: 'Text to type'
            },
            pressEnter: {
              type: 'boolean',
              description: 'Whether to press Enter after typing'
            }
          },
          required: ['selector', 'text']
        },
        execute: this.typeText.bind(this)
      },

      scroll_page: {
        name: 'scroll_page',
        description: 'Scroll the page up or down',
        parameters: {
          type: 'object',
          properties: {
            direction: {
              type: 'string',
              enum: ['up', 'down', 'top', 'bottom'],
              description: 'Direction to scroll'
            },
            amount: {
              type: 'number',
              description: 'Amount to scroll in pixels (default: 500)'
            }
          },
          required: ['direction']
        },
        execute: this.scrollPage.bind(this)
      },

      extract_text: {
        name: 'extract_text',
        description: 'Extract text content from the page or a specific element',
        parameters: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'CSS selector (optional, extracts from body if not provided)'
            },
            maxLength: {
              type: 'number',
              description: 'Maximum characters to extract (default: 5000)'
            }
          },
          required: []
        },
        execute: this.extractText.bind(this)
      },

      get_page_info: {
        name: 'get_page_info',
        description: 'Get information about the current page (title, URL, meta)',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        },
        execute: this.getPageInfo.bind(this)
      },

      find_elements: {
        name: 'find_elements',
        description: 'Find elements on the page matching a description',
        parameters: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description: 'Description of elements to find (e.g., "login button", "search input")'
            }
          },
          required: ['description']
        },
        execute: this.findElements.bind(this)
      },

      wait_for_element: {
        name: 'wait_for_element',
        description: 'Wait for an element to appear on the page',
        parameters: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'CSS selector for the element'
            },
            timeout: {
              type: 'number',
              description: 'Maximum time to wait in milliseconds (default: 5000)'
            }
          },
          required: ['selector']
        },
        execute: this.waitForElement.bind(this)
      },

      go_back: {
        name: 'go_back',
        description: 'Go back to the previous page',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        },
        execute: this.goBack.bind(this)
      },

      go_forward: {
        name: 'go_forward',
        description: 'Go forward to the next page',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        },
        execute: this.goForward.bind(this)
      },

      refresh_page: {
        name: 'refresh_page',
        description: 'Refresh the current page',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        },
        execute: this.refreshPage.bind(this)
      },

      get_links: {
        name: 'get_links',
        description: 'Get all links on the current page',
        parameters: {
          type: 'object',
          properties: {
            maxLinks: {
              type: 'number',
              description: 'Maximum number of links to return (default: 50)'
            }
          },
          required: []
        },
        execute: this.getLinks.bind(this)
      },

      fill_form: {
        name: 'fill_form',
        description: 'Fill multiple form fields at once',
        parameters: {
          type: 'object',
          properties: {
            fields: {
              type: 'array',
              description: 'Array of {selector, value} objects',
              items: {
                type: 'object',
                properties: {
                  selector: { type: 'string' },
                  value: { type: 'string' }
                }
              }
            },
            submit: {
              type: 'boolean',
              description: 'Whether to submit the form after filling'
            }
          },
          required: ['fields']
        },
        execute: this.fillForm.bind(this)
      },

      take_screenshot: {
        name: 'take_screenshot',
        description: 'Take a screenshot of the current page',
        parameters: {
          type: 'object',
          properties: {
            fullPage: {
              type: 'boolean',
              description: 'Whether to capture the full page (default: false)'
            }
          },
          required: []
        },
        execute: this.takeScreenshot.bind(this)
      },

      answer_user: {
        name: 'answer_user',
        description: 'Provide a final answer or response to the user',
        parameters: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'The message to send to the user'
            }
          },
          required: ['message']
        },
        execute: this.answerUser.bind(this)
      },

      // ==========================================
      // Enhanced Tools
      // ==========================================

      compare_tabs: {
        name: 'compare_tabs',
        description: 'Compare content or data across multiple open browser tabs',
        parameters: {
          type: 'object',
          properties: {
            criteria: {
              type: 'string',
              description: 'What to compare (e.g., "prices", "features", "content")'
            },
            maxTabs: {
              type: 'number',
              description: 'Maximum number of tabs to compare (default: 5)'
            }
          },
          required: ['criteria']
        },
        execute: this.compareTabs.bind(this)
      },

      save_to_clipboard: {
        name: 'save_to_clipboard',
        description: 'Save extracted text or data to the system clipboard',
        parameters: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'The content to save to clipboard'
            }
          },
          required: ['content']
        },
        execute: this.saveToClipboard.bind(this)
      },

      create_note: {
        name: 'create_note',
        description: 'Save information to AI memory as a note for later reference',
        parameters: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Title of the note'
            },
            content: {
              type: 'string',
              description: 'Content to save'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tags for organizing the note'
            }
          },
          required: ['title', 'content']
        },
        execute: this.createNote.bind(this)
      },

      highlight_text: {
        name: 'highlight_text',
        description: 'Highlight specific text on the current page',
        parameters: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Text to highlight'
            },
            color: {
              type: 'string',
              description: 'Highlight color (default: yellow)'
            }
          },
          required: ['text']
        },
        execute: this.highlightText.bind(this)
      },

      get_page_summary: {
        name: 'get_page_summary',
        description: 'Get a structured summary of the current page including headings, main content, and key data',
        parameters: {
          type: 'object',
          properties: {
            includeImages: {
              type: 'boolean',
              description: 'Whether to include image descriptions (default: false)'
            }
          },
          required: []
        },
        execute: this.getPageSummary.bind(this)
      }
    };
  }

  // Set browser context (webContents reference for executing in page)
  setBrowserContext(context) {
    this.browserContext = context;
  }

  // Execute JavaScript in the browser context
  async executeInBrowser(script) {
    if (!this.browserContext) {
      throw new Error('Browser context not set');
    }

    try {
      return await this.browserContext.executeJavaScript(script);
    } catch (error) {
      console.error('[Tools] Execute in browser error:', error);
      throw error;
    }
  }

  // Tool implementations
  async navigateTo({ url }) {
    // Ensure URL has protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    if (this.browserContext) {
      await this.browserContext.loadURL(url);
    }

    return { success: true, message: `Navigated to ${url}` };
  }

  async searchWeb({ query }) {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    return this.navigateTo({ url: searchUrl });
  }

  async clickElement({ selector }) {
    const script = `
      (function() {
        const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
        if (el) {
          el.click();
          return { success: true, message: 'Element clicked' };
        }
        return { success: false, message: 'Element not found' };
      })()
    `;
    return await this.executeInBrowser(script);
  }

  async typeText({ selector, text, pressEnter = false }) {
    const script = `
      (function() {
        const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
        if (el) {
          el.focus();
          el.value = '${text.replace(/'/g, "\\'")}';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          ${pressEnter ? `
          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
          if (el.form) el.form.submit();
          ` : ''}
          return { success: true, message: 'Text typed' };
        }
        return { success: false, message: 'Input field not found' };
      })()
    `;
    return await this.executeInBrowser(script);
  }

  async scrollPage({ direction, amount = 500 }) {
    const script = `
      (function() {
        switch('${direction}') {
          case 'up': window.scrollBy(0, -${amount}); break;
          case 'down': window.scrollBy(0, ${amount}); break;
          case 'top': window.scrollTo(0, 0); break;
          case 'bottom': window.scrollTo(0, document.body.scrollHeight); break;
        }
        return { success: true, message: 'Scrolled ${direction}', scrollY: window.scrollY };
      })()
    `;
    return await this.executeInBrowser(script);
  }

  async extractText({ selector, maxLength = 5000 }) {
    const script = `
      (function() {
        const el = ${selector ? `document.querySelector('${selector.replace(/'/g, "\\'")}')` : 'document.body'};
        if (el) {
          let text = el.innerText || el.textContent || '';
          text = text.replace(/\\s+/g, ' ').trim();
          if (text.length > ${maxLength}) {
            text = text.substring(0, ${maxLength}) + '...';
          }
          return { success: true, text: text };
        }
        return { success: false, message: 'Element not found' };
      })()
    `;
    return await this.executeInBrowser(script);
  }

  async getPageInfo() {
    const script = `
      (function() {
        return {
          success: true,
          title: document.title,
          url: window.location.href,
          domain: window.location.hostname,
          description: document.querySelector('meta[name="description"]')?.content || '',
          h1: document.querySelector('h1')?.innerText || '',
          hasForm: document.forms.length > 0,
          formCount: document.forms.length,
          linkCount: document.links.length,
          imageCount: document.images.length
        };
      })()
    `;
    return await this.executeInBrowser(script);
  }

  async findElements({ description }) {
    // Use common selectors based on description
    const script = `
      (function() {
        const desc = '${description.toLowerCase().replace(/'/g, "\\'")}';
        const results = [];
        
        // Search by text content, aria-label, placeholder, name, id
        const allElements = document.querySelectorAll('button, a, input, select, textarea, [role="button"]');
        
        allElements.forEach((el, index) => {
          const text = (el.innerText || el.value || '').toLowerCase();
          const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
          const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
          const name = (el.getAttribute('name') || '').toLowerCase();
          const id = (el.id || '').toLowerCase();
          const title = (el.getAttribute('title') || '').toLowerCase();
          
          if (text.includes(desc) || ariaLabel.includes(desc) || 
              placeholder.includes(desc) || name.includes(desc) || 
              id.includes(desc) || title.includes(desc)) {
            
            // Generate a selector for this element
            let selector = el.tagName.toLowerCase();
            if (el.id) selector = '#' + el.id;
            else if (el.className) selector += '.' + el.className.split(' ')[0];
            
            results.push({
              tag: el.tagName.toLowerCase(),
              type: el.type || null,
              text: (el.innerText || el.value || '').substring(0, 100),
              selector: selector,
              index: index
            });
          }
        });
        
        return { success: true, elements: results.slice(0, 10) };
      })()
    `;
    return await this.executeInBrowser(script);
  }

  async waitForElement({ selector, timeout = 5000 }) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const script = `!!document.querySelector('${selector.replace(/'/g, "\\'")}')`;
      const found = await this.executeInBrowser(script);

      if (found) {
        return { success: true, message: 'Element found' };
      }

      await new Promise(resolve => setTimeout(resolve, 200));
    }

    return { success: false, message: 'Element not found within timeout' };
  }

  async goBack() {
    if (this.browserContext) {
      await this.browserContext.goBack();
    }
    return { success: true, message: 'Navigated back' };
  }

  async goForward() {
    if (this.browserContext) {
      await this.browserContext.goForward();
    }
    return { success: true, message: 'Navigated forward' };
  }

  async refreshPage() {
    if (this.browserContext) {
      await this.browserContext.reload();
    }
    return { success: true, message: 'Page refreshed' };
  }

  async getLinks({ maxLinks = 50 }) {
    const script = `
      (function() {
        const links = Array.from(document.links).slice(0, ${maxLinks}).map(a => ({
          text: (a.innerText || '').trim().substring(0, 100),
          href: a.href,
          title: a.title || ''
        }));
        return { success: true, links: links };
      })()
    `;
    return await this.executeInBrowser(script);
  }

  async fillForm({ fields, submit = false }) {
    for (const field of fields) {
      await this.typeText({ selector: field.selector, text: field.value });
    }

    if (submit) {
      const script = `
        (function() {
          const form = document.querySelector('form');
          if (form) {
            form.submit();
            return { success: true, message: 'Form submitted' };
          }
          return { success: false, message: 'No form found' };
        })()
      `;
      return await this.executeInBrowser(script);
    }

    return { success: true, message: `Filled ${fields.length} fields` };
  }

  async takeScreenshot({ fullPage = false }) {
    // Screenshots are handled differently - return instruction for main process
    return {
      success: true,
      action: 'screenshot',
      fullPage,
      message: 'Screenshot captured'
    };
  }

  async answerUser({ message }) {
    return {
      success: true,
      type: 'answer',
      message: message,
      final: true
    };
  }

  // ==========================================
  // Enhanced Tool Implementations
  // ==========================================

  async compareTabs({ criteria, maxTabs = 5 }) {
    // This tool signals the main process to compare tabs
    return {
      success: true,
      action: 'compare_tabs',
      criteria: criteria,
      maxTabs: maxTabs,
      message: `Comparing ${criteria} across open tabs`
    };
  }

  async saveToClipboard({ content }) {
    const script = `
      (function() {
        try {
          navigator.clipboard.writeText(\`${content.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`);
          return { success: true, message: 'Content copied to clipboard' };
        } catch (e) {
          // Fallback for older browsers
          const textArea = document.createElement('textarea');
          textArea.value = \`${content.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          return { success: true, message: 'Content copied to clipboard' };
        }
      })()
    `;
    return await this.executeInBrowser(script);
  }

  async createNote({ title, content, tags = [] }) {
    // Signal to save to AI memory
    return {
      success: true,
      action: 'create_note',
      data: {
        title: title,
        content: content,
        tags: tags,
        timestamp: Date.now()
      },
      message: `Note "${title}" saved to memory`
    };
  }

  async highlightText({ text, color = 'yellow' }) {
    const colorMap = {
      yellow: 'rgba(255, 255, 0, 0.4)',
      green: 'rgba(0, 255, 0, 0.3)',
      blue: 'rgba(0, 100, 255, 0.3)',
      pink: 'rgba(255, 105, 180, 0.4)',
      orange: 'rgba(255, 165, 0, 0.4)'
    };
    const bgColor = colorMap[color.toLowerCase()] || colorMap.yellow;

    const script = `
      (function() {
        const searchText = "${text.replace(/"/g, '\\"')}";
        const bgColor = "${bgColor}";
        
        function highlightText(node) {
          if (node.nodeType === 3) { // Text node
            const idx = node.textContent.indexOf(searchText);
            if (idx >= 0) {
              const span = document.createElement('span');
              span.style.backgroundColor = bgColor;
              span.style.borderRadius = '2px';
              span.dataset.evosHighlight = 'true';
              
              const before = node.textContent.substring(0, idx);
              const match = node.textContent.substring(idx, idx + searchText.length);
              const after = node.textContent.substring(idx + searchText.length);
              
              const parent = node.parentNode;
              const beforeNode = document.createTextNode(before);
              span.textContent = match;
              const afterNode = document.createTextNode(after);
              
              parent.insertBefore(beforeNode, node);
              parent.insertBefore(span, node);
              parent.insertBefore(afterNode, node);
              parent.removeChild(node);
              
              return true;
            }
          } else if (node.nodeType === 1 && !['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT'].includes(node.tagName)) {
            for (let i = 0; i < node.childNodes.length; i++) {
              if (highlightText(node.childNodes[i])) {
                // Continue to find more matches
              }
            }
          }
          return false;
        }
        
        let count = 0;
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        const textNodes = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode);
        
        for (const node of textNodes) {
          if (node.textContent.includes(searchText)) {
            highlightText(node);
            count++;
          }
        }
        
        return { success: true, message: 'Highlighted ' + count + ' occurrences', count: count };
      })()
    `;
    return await this.executeInBrowser(script);
  }

  async getPageSummary({ includeImages = false }) {
    const script = `
      (function() {
        const summary = {
          title: document.title,
          url: window.location.href,
          domain: window.location.hostname,
          
          // Meta info
          description: document.querySelector('meta[name="description"]')?.content || '',
          keywords: document.querySelector('meta[name="keywords"]')?.content || '',
          author: document.querySelector('meta[name="author"]')?.content || '',
          
          // Structure
          headings: {
            h1: Array.from(document.querySelectorAll('h1')).map(h => h.innerText.trim()).slice(0, 5),
            h2: Array.from(document.querySelectorAll('h2')).map(h => h.innerText.trim()).slice(0, 10),
            h3: Array.from(document.querySelectorAll('h3')).map(h => h.innerText.trim()).slice(0, 10)
          },
          
          // Content stats
          stats: {
            paragraphs: document.querySelectorAll('p').length,
            links: document.querySelectorAll('a').length,
            images: document.querySelectorAll('img').length,
            forms: document.querySelectorAll('form').length,
            buttons: document.querySelectorAll('button').length,
            inputs: document.querySelectorAll('input').length
          },
          
          // Main content (first few paragraphs)
          mainContent: Array.from(document.querySelectorAll('p'))
            .map(p => p.innerText.trim())
            .filter(t => t.length > 50)
            .slice(0, 3)
            .join(' ')
            .substring(0, 1000),
          
          // Key data (prices, dates, numbers)
          keyData: {
            prices: (document.body.innerText.match(/\\$[\\d,]+\\.?\\d*/g) || []).slice(0, 10),
            emails: (document.body.innerText.match(/[\\w.-]+@[\\w.-]+\\.\\w+/g) || []).slice(0, 5),
            phones: (document.body.innerText.match(/[\\d-+()\\s]{10,}/g) || []).slice(0, 5)
          }
        };
        
        ${includeImages ? `
        summary.images = Array.from(document.querySelectorAll('img'))
          .filter(img => img.src && img.width > 50 && img.height > 50)
          .slice(0, 10)
          .map(img => ({
            src: img.src,
            alt: img.alt || '',
            width: img.width,
            height: img.height
          }));
        ` : ''}
        
        return { success: true, summary: summary };
      })()
    `;
    return await this.executeInBrowser(script);
  }

  // Get tool definitions for the LLM
  getToolDefinitions() {
    return Object.values(this.tools).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }));
  }

  // Get a specific tool
  getTool(name) {
    return this.tools[name];
  }

  // Execute a tool by name
  async executeTool(name, params) {
    const tool = this.tools[name];
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    console.log(`[Tools] Executing ${name} with params:`, params);
    const result = await tool.execute(params);
    console.log(`[Tools] Result:`, result);

    return result;
  }

  // Format tools for LLM prompt
  getToolsPrompt() {
    let prompt = 'Available tools:\n\n';

    for (const tool of Object.values(this.tools)) {
      prompt += `### ${tool.name}\n`;
      prompt += `${tool.description}\n`;
      prompt += `Parameters: ${JSON.stringify(tool.parameters, null, 2)}\n\n`;
    }

    return prompt;
  }
}

// Singleton instance
const browserTools = new BrowserTools();

module.exports = { BrowserTools, browserTools };
