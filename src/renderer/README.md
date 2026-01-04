# Renderer Process

The renderer process contains all the browser UI and client-side functionality. This is what users see and interact with.

## Structure

### HTML Pages

#### `index.html`
The main browser window interface.
- Tab bar and navigation controls
- Address bar and search
- WebView containers for web pages
- AI panel and sidebar
- Quick action bar
- Profile manager

#### `settings.html`
The settings and preferences page.
- General settings (homepage, search engine)
- Privacy and security settings
- Appearance settings (theme, zoom)
- Advanced configurations

### 📁 [scripts/](scripts/README.md)
JavaScript modules that power the browser UI.

**Key Modules:**
- `app.js` - Application initialization and coordination
- `tabs.js` - Tab management and operations
- `navigation.js` - URL navigation and history
- `panels.js` - Bookmarks, history, downloads panels
- `ai-panel.js` - AI assistant interface
- `agent-manager.js` - AI agent coordination
- `macro-agent.js` - Macro recording and playback
- `profile-manager.js` - User profile management

[See full scripts documentation →](scripts/README.md)

### 📁 [styles/](styles/README.md)
CSS stylesheets for the browser interface.

**Key Stylesheets:**
- `main.css` - Base styles and layout
- `titlebar.css` - Custom window title bar
- `tabs.css` - Tab bar styling
- `navbar.css` - Navigation bar
- `panels.css` - Sidebar panels
- `ai-panel.css` - AI assistant UI

[See full styles documentation →](styles/README.md)

## Architecture

The renderer process uses vanilla JavaScript (no framework) for maximum performance and control. Key design principles:

### Module Pattern
Each script is a self-contained module that:
- Exports its public API
- Manages its own state
- Communicates via events or direct calls

### Event-Driven
Components communicate through:
- Custom DOM events
- IPC messages to main process
- Direct function calls for tight coupling

### Security
- Content Security Policy (CSP) enabled
- No `eval()` or unsafe dynamic code
- Sanitized user input
- WebViews run in isolated contexts

## Development

### Adding New Features
1. Create a new script in `scripts/` if needed
2. Add corresponding styles in `styles/`
3. Wire up IPC handlers in `preload.js` for main process communication
4. Update `app.js` to initialize your feature

### Best Practices
- Keep scripts modular and focused
- Use semantic HTML
- Follow existing naming conventions
- Add comments for complex logic
- Test across different window sizes
