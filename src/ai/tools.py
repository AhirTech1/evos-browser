"""
EVOS AI - Browser Tools
Tools that the AI agent can use to interact with the browser
"""
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from enum import Enum
import json


class ToolType(str, Enum):
    NAVIGATION = "navigation"
    INTERACTION = "interaction"
    EXTRACTION = "extraction"
    MEMORY = "memory"
    SYSTEM = "system"


@dataclass
class ToolResult:
    success: bool
    data: Any = None
    error: Optional[str] = None
    screenshot: Optional[str] = None  # Base64 encoded


class BrowserTools:
    """
    Collection of tools that the AI agent can use to control the browser.
    These tools generate commands that are sent back to Electron for execution.
    """
    
    # Tool definitions for the LLM
    TOOL_DEFINITIONS = [
        {
            "name": "navigate",
            "description": "Navigate to a URL or perform search",
            "type": ToolType.NAVIGATION,
            "parameters": {
                "url": {"type": "string", "description": "URL to navigate to, or search query"},
                "new_tab": {"type": "boolean", "description": "Open in new tab", "default": False}
            }
        },
        {
            "name": "click",
            "description": "Click on an element on the page",
            "type": ToolType.INTERACTION,
            "parameters": {
                "selector": {"type": "string", "description": "CSS selector or text content to find element"},
                "description": {"type": "string", "description": "Human description of what to click"}
            }
        },
        {
            "name": "type_text",
            "description": "Type text into an input field",
            "type": ToolType.INTERACTION,
            "parameters": {
                "selector": {"type": "string", "description": "CSS selector of the input field"},
                "text": {"type": "string", "description": "Text to type"},
                "clear_first": {"type": "boolean", "description": "Clear field before typing", "default": True}
            }
        },
        {
            "name": "scroll",
            "description": "Scroll the page",
            "type": ToolType.INTERACTION,
            "parameters": {
                "direction": {"type": "string", "enum": ["up", "down", "top", "bottom"]},
                "amount": {"type": "integer", "description": "Pixels to scroll", "default": 500}
            }
        },
        {
            "name": "extract_text",
            "description": "Extract text content from elements",
            "type": ToolType.EXTRACTION,
            "parameters": {
                "selector": {"type": "string", "description": "CSS selector to extract from"},
                "multiple": {"type": "boolean", "description": "Extract from all matching elements", "default": False}
            }
        },
        {
            "name": "extract_links",
            "description": "Extract all links from the page or specific section",
            "type": ToolType.EXTRACTION,
            "parameters": {
                "selector": {"type": "string", "description": "CSS selector to limit scope", "default": "body"},
                "filter": {"type": "string", "description": "Filter links containing this text"}
            }
        },
        {
            "name": "extract_table",
            "description": "Extract data from a table",
            "type": ToolType.EXTRACTION,
            "parameters": {
                "selector": {"type": "string", "description": "CSS selector of the table"}
            }
        },
        {
            "name": "fill_form",
            "description": "Fill out a form with provided data",
            "type": ToolType.INTERACTION,
            "parameters": {
                "form_selector": {"type": "string", "description": "CSS selector of the form"},
                "data": {"type": "object", "description": "Key-value pairs of field names and values"},
                "submit": {"type": "boolean", "description": "Submit form after filling", "default": False}
            }
        },
        {
            "name": "wait",
            "description": "Wait for a condition",
            "type": ToolType.SYSTEM,
            "parameters": {
                "type": {"type": "string", "enum": ["time", "element", "navigation"]},
                "value": {"type": "string", "description": "Milliseconds, selector, or URL pattern"}
            }
        },
        {
            "name": "screenshot",
            "description": "Take a screenshot of the page",
            "type": ToolType.EXTRACTION,
            "parameters": {
                "selector": {"type": "string", "description": "CSS selector to screenshot (optional)"},
                "full_page": {"type": "boolean", "description": "Capture full page", "default": False}
            }
        },
        {
            "name": "get_page_info",
            "description": "Get information about the current page",
            "type": ToolType.EXTRACTION,
            "parameters": {}
        },
        {
            "name": "remember_page",
            "description": "Save the current page to memory for later recall",
            "type": ToolType.MEMORY,
            "parameters": {
                "tags": {"type": "array", "description": "Tags to categorize this page"},
                "note": {"type": "string", "description": "Note about why this page is important"}
            }
        },
        {
            "name": "search_memory",
            "description": "Search through remembered pages and information",
            "type": ToolType.MEMORY,
            "parameters": {
                "query": {"type": "string", "description": "What to search for"}
            }
        },
        {
            "name": "go_back",
            "description": "Go back to the previous page",
            "type": ToolType.NAVIGATION,
            "parameters": {}
        },
        {
            "name": "go_forward",
            "description": "Go forward in browser history",
            "type": ToolType.NAVIGATION,
            "parameters": {}
        },
        {
            "name": "refresh",
            "description": "Refresh the current page",
            "type": ToolType.NAVIGATION,
            "parameters": {}
        },
        {
            "name": "select_option",
            "description": "Select an option from a dropdown",
            "type": ToolType.INTERACTION,
            "parameters": {
                "selector": {"type": "string", "description": "CSS selector of the select element"},
                "value": {"type": "string", "description": "Value or text of option to select"}
            }
        },
        {
            "name": "hover",
            "description": "Hover over an element",
            "type": ToolType.INTERACTION,
            "parameters": {
                "selector": {"type": "string", "description": "CSS selector of element to hover"}
            }
        },
        {
            "name": "press_key",
            "description": "Press a keyboard key",
            "type": ToolType.INTERACTION,
            "parameters": {
                "key": {"type": "string", "description": "Key to press (Enter, Escape, Tab, etc.)"},
                "modifiers": {"type": "array", "description": "Modifier keys (ctrl, shift, alt)"}
            }
        },
        {
            "name": "answer_user",
            "description": "Provide a final answer or response to the user",
            "type": ToolType.SYSTEM,
            "parameters": {
                "message": {"type": "string", "description": "The response to show to the user"},
                "data": {"type": "object", "description": "Optional structured data to include"}
            }
        }
    ]
    
    @classmethod
    def get_tool_definitions(cls) -> List[Dict[str, Any]]:
        """Get all tool definitions for the LLM"""
        return cls.TOOL_DEFINITIONS
    
    @classmethod
    def get_tool_by_name(cls, name: str) -> Optional[Dict[str, Any]]:
        """Get a specific tool definition"""
        for tool in cls.TOOL_DEFINITIONS:
            if tool["name"] == name:
                return tool
        return None
    
    @classmethod
    def format_tools_for_prompt(cls) -> str:
        """Format tool definitions for inclusion in LLM prompt"""
        lines = ["Available tools:"]
        for tool in cls.TOOL_DEFINITIONS:
            params = tool.get("parameters", {})
            param_str = ", ".join([
                f"{k}: {v.get('type', 'any')}" 
                for k, v in params.items()
            ]) if params else "none"
            lines.append(f"- {tool['name']}: {tool['description']} (params: {param_str})")
        return "\n".join(lines)
    
    @classmethod
    def create_command(cls, tool_name: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Create a command to be sent to Electron for execution"""
        return {
            "type": "browser_command",
            "tool": tool_name,
            "parameters": parameters
        }
    
    @classmethod
    def validate_parameters(cls, tool_name: str, parameters: Dict[str, Any]) -> tuple[bool, Optional[str]]:
        """Validate parameters for a tool"""
        tool = cls.get_tool_by_name(tool_name)
        if not tool:
            return False, f"Unknown tool: {tool_name}"
        
        required_params = [
            k for k, v in tool.get("parameters", {}).items()
            if "default" not in v and v.get("type") != "optional"
        ]
        
        for param in required_params:
            if param not in parameters:
                return False, f"Missing required parameter: {param}"
        
        return True, None


# JavaScript code to inject into webview for tool execution
BROWSER_EXECUTOR_JS = '''
(function() {
    window.EVOSTools = {
        click: async function(selector, description) {
            let element = document.querySelector(selector);
            if (!element && description) {
                // Try to find by text content
                const elements = document.querySelectorAll('*');
                for (const el of elements) {
                    if (el.textContent.trim().toLowerCase().includes(description.toLowerCase())) {
                        element = el;
                        break;
                    }
                }
            }
            if (element) {
                element.click();
                return { success: true };
            }
            return { success: false, error: 'Element not found' };
        },
        
        typeText: function(selector, text, clearFirst) {
            const element = document.querySelector(selector);
            if (element) {
                if (clearFirst) element.value = '';
                element.value += text;
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
                return { success: true };
            }
            return { success: false, error: 'Element not found' };
        },
        
        scroll: function(direction, amount) {
            const scrollAmount = amount || 500;
            switch(direction) {
                case 'up': window.scrollBy(0, -scrollAmount); break;
                case 'down': window.scrollBy(0, scrollAmount); break;
                case 'top': window.scrollTo(0, 0); break;
                case 'bottom': window.scrollTo(0, document.body.scrollHeight); break;
            }
            return { success: true };
        },
        
        extractText: function(selector, multiple) {
            if (multiple) {
                const elements = document.querySelectorAll(selector);
                return { success: true, data: Array.from(elements).map(el => el.textContent.trim()) };
            }
            const element = document.querySelector(selector);
            return element 
                ? { success: true, data: element.textContent.trim() }
                : { success: false, error: 'Element not found' };
        },
        
        extractLinks: function(selector, filter) {
            const container = document.querySelector(selector || 'body');
            if (!container) return { success: false, error: 'Container not found' };
            
            const links = container.querySelectorAll('a[href]');
            let results = Array.from(links).map(a => ({
                text: a.textContent.trim(),
                href: a.href
            }));
            
            if (filter) {
                results = results.filter(l => 
                    l.text.toLowerCase().includes(filter.toLowerCase()) ||
                    l.href.toLowerCase().includes(filter.toLowerCase())
                );
            }
            
            return { success: true, data: results };
        },
        
        extractTable: function(selector) {
            const table = document.querySelector(selector);
            if (!table) return { success: false, error: 'Table not found' };
            
            const rows = table.querySelectorAll('tr');
            const data = [];
            let headers = [];
            
            rows.forEach((row, i) => {
                const cells = row.querySelectorAll('td, th');
                const rowData = Array.from(cells).map(c => c.textContent.trim());
                if (i === 0 && row.querySelector('th')) {
                    headers = rowData;
                } else {
                    if (headers.length) {
                        const obj = {};
                        headers.forEach((h, j) => obj[h] = rowData[j]);
                        data.push(obj);
                    } else {
                        data.push(rowData);
                    }
                }
            });
            
            return { success: true, data };
        },
        
        fillForm: function(formSelector, data, submit) {
            const form = document.querySelector(formSelector);
            if (!form) return { success: false, error: 'Form not found' };
            
            for (const [key, value] of Object.entries(data)) {
                const input = form.querySelector(`[name="${key}"], #${key}, .${key}`);
                if (input) {
                    input.value = value;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
            
            if (submit) {
                form.submit();
            }
            
            return { success: true };
        },
        
        getPageInfo: function() {
            return {
                success: true,
                data: {
                    url: window.location.href,
                    title: document.title,
                    description: document.querySelector('meta[name="description"]')?.content || '',
                    text: document.body.innerText.substring(0, 10000),
                    forms: document.querySelectorAll('form').length,
                    links: document.querySelectorAll('a').length,
                    inputs: document.querySelectorAll('input, textarea, select').length
                }
            };
        },
        
        selectOption: function(selector, value) {
            const select = document.querySelector(selector);
            if (!select) return { success: false, error: 'Select not found' };
            
            // Try by value
            let option = select.querySelector(`option[value="${value}"]`);
            // Try by text
            if (!option) {
                option = Array.from(select.options).find(o => 
                    o.textContent.trim().toLowerCase() === value.toLowerCase()
                );
            }
            
            if (option) {
                select.value = option.value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                return { success: true };
            }
            return { success: false, error: 'Option not found' };
        },
        
        hover: function(selector) {
            const element = document.querySelector(selector);
            if (element) {
                element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
                return { success: true };
            }
            return { success: false, error: 'Element not found' };
        },
        
        getInteractiveElements: function() {
            const elements = [];
            const selectors = 'a, button, input, select, textarea, [onclick], [role="button"]';
            document.querySelectorAll(selectors).forEach((el, i) => {
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    elements.push({
                        index: i,
                        tag: el.tagName.toLowerCase(),
                        type: el.type || '',
                        text: el.textContent?.trim().substring(0, 100) || '',
                        placeholder: el.placeholder || '',
                        id: el.id,
                        name: el.name,
                        href: el.href,
                        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
                    });
                }
            });
            return { success: true, data: elements };
        }
    };
})();
'''
