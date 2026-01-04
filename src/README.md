# Source Code Directory

This directory contains all the source code for EVOS Browser, organized into three main components:

## Directory Structure

### 📁 [main/](main/README.md)
The Electron main process that manages the application lifecycle, window creation, and system-level operations.

**Key Files:**
- `main.js` - Main process entry point and window management
- `preload.js` - Secure bridge between main and renderer processes
- `context-bus.js` - Context management and state synchronization

### 📁 [renderer/](renderer/README.md)
The browser user interface and all client-side functionality.

**Key Components:**
- HTML pages (index.html, settings.html)
- JavaScript modules in `scripts/` for UI logic
- CSS stylesheets in `styles/` for visual design

### 📁 [ai/](ai/README.md)
The AI and automation system that powers intelligent features.

**Key Components:**
- AI agents (JavaScript and Python implementations)
- LLM engine for natural language processing
- Memory systems (knowledge graph, temporal tracking)
- Perception systems for visual understanding
- Security systems for safe automation
- Macro recording and playback

## Technology Stack

- **Electron** - Cross-platform desktop application framework
- **Node.js** - JavaScript runtime for main and renderer processes
- **Python** - AI backend and advanced processing
- **Flask** - Python web server for AI services
- **Gemini API** - Large language model integration

## Inter-Process Communication

The three components communicate through:
- **IPC (Inter-Process Communication)** - Between main and renderer
- **HTTP/WebSockets** - Between JavaScript and Python AI backend
- **Context Bus** - Shared state management system

## Development

Each subdirectory contains its own README.md with detailed documentation:
- [Main Process Documentation](main/README.md)
- [Renderer Process Documentation](renderer/README.md)
- [AI System Documentation](ai/README.md)
