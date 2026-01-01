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
