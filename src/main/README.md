# Main Process

The main process is the heart of the Electron application, managing the application lifecycle, window creation, and system-level operations.

## Files

### `main.js`
The main entry point for the Electron application.

**Responsibilities:**
- Application lifecycle management (startup, shutdown)
- Window creation and management
- Menu bar and tray icon setup
- IPC (Inter-Process Communication) handlers
- System integration (file downloads, native dialogs)
- WebView management and tab handling
- AI backend server integration

**Key Features:**
- Creates and manages the main browser window
- Handles deep linking and URL schemes
- Manages app settings and user data
- Integrates with the AI Python backend
- Handles system-level browser events

### `preload.js`
Secure bridge between the main and renderer processes.

**Responsibilities:**
- Exposes safe APIs to the renderer process via `contextBridge`
- Defines the `window.electronAPI` interface
- Handles IPC communication securely
- Provides access to system features without exposing full Node.js access

**Exposed APIs:**
- Window controls (minimize, maximize, close)
- Browser operations (new tab, navigation)
- Settings management
- Download management
- AI features and integrations

### `context-bus.js`
Context management and state synchronization system.

**Responsibilities:**
- Manages shared context across the application
- Synchronizes state between main and renderer processes
- Provides event-based communication
- Handles context updates and subscriptions

**Features:**
- Centralized state management
- Event emitters for real-time updates
- Context providers for components
- Subscription management

## Development

The main process runs in Node.js and has full access to system APIs. Always use the preload script to expose functionality to the renderer process - never expose Node.js modules directly.

### Security Considerations
- All renderer-facing APIs must go through `preload.js`
- Use `contextBridge.exposeInMainWorld()` for API exposure
- Validate all IPC messages from the renderer
- Sanitize user input before system operations
