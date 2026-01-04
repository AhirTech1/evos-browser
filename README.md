# EVOS Browser

<p align="center">
  <img src="assets/icons/icon.svg" alt="EVOS Browser Logo" width="128" height="128">
</p>

<p align="center">
  <strong>An AI-powered Chromium-based browser built for the future</strong>
</p>

---

## 🚀 Features

EVOS Browser is a modern, feature-rich web browser built on Electron (Chromium). It provides all the essential features you'd expect from a browser, with a clean and intuitive interface.

### Core Features

- **🗂️ Tab Management**
  - Multiple tabs with drag-and-drop reordering
  - Tab audio indicators
  - Keyboard shortcuts (Ctrl+T, Ctrl+W, Ctrl+Tab)
  - Middle-click to close tabs

- **🔍 Navigation**
  - Smart URL bar with search integration
  - Back, forward, reload, and home buttons
  - Security indicators (HTTPS/HTTP)
  - Find in page (Ctrl+F)

- **📚 Bookmarks**
  - One-click bookmarking
  - Bookmark manager panel
  - Search bookmarks

- **📜 History**
  - Full browsing history
  - Grouped by date
  - Search and delete entries
  - Clear browsing data

- **📥 Downloads**
  - Download manager
  - Progress tracking
  - Download history

- **⚙️ Settings**
  - Customizable homepage
  - Multiple search engines (Google, Bing, DuckDuckGo, Yahoo)
  - Dark/Light mode
  - Privacy settings
  - Zoom controls

- **🎨 Modern UI**
  - Clean, Chrome-like interface
  - Custom title bar
  - Dark mode support
  - Responsive design

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+T` | New tab |
| `Ctrl+W` | Close tab |
| `Ctrl+Tab` | Next tab |
| `Ctrl+Shift+Tab` | Previous tab |
| `Ctrl+L` or `F6` | Focus URL bar |
| `Ctrl+R` or `F5` | Reload |
| `Ctrl+Shift+R` | Hard reload |
| `Ctrl+F` | Find in page |
| `Ctrl+D` | Bookmark page |
| `Ctrl+H` | History |
| `Ctrl+Shift+B` | Bookmarks |
| `Ctrl++` | Zoom in |
| `Ctrl+-` | Zoom out |
| `Ctrl+0` | Reset zoom |
| `F11` | Fullscreen |
| `F12` | Developer tools |
| `Alt+Left` | Go back |
| `Alt+Right` | Go forward |

## 🛠️ Installation

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- npm (comes with Node.js)

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/AhirTech1/evos-browser.git
   cd evos-browser
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the browser**
   ```bash
   npm start
   ```

### Building for Production

To create distributable packages:

```bash
# For Windows
npm run build:win

# For macOS
npm run build:mac

# For Linux
npm run build:linux

# For all platforms
npm run build
```

The built packages will be in the `dist` folder.

## 📁 Project Structure

```
evos-browser/
├── assets/
│   └── icons/              # Application icons
├── src/
│   ├── main/               # Main Electron process
│   │   ├── main.js         # Main process entry point
│   │   ├── preload.js      # Preload script for IPC
│   │   └── context-bus.js  # Context management system
│   ├── renderer/           # Browser UI and scripts
│   │   ├── index.html      # Main browser window
│   │   ├── settings.html   # Settings page
│   │   ├── scripts/        # JavaScript modules
│   │   │   ├── app.js      # Main application entry
│   │   │   ├── tabs.js     # Tab management
│   │   │   ├── navigation.js
│   │   │   ├── panels.js   # History, bookmarks, downloads
│   │   │   ├── ai-panel.js # AI assistant interface
│   │   │   ├── agent-manager.js
│   │   │   ├── macro-agent.js
│   │   │   ├── profile-manager.js
│   │   │   └── ...         # Additional UI scripts
│   │   └── styles/         # CSS stylesheets
│   │       ├── main.css
│   │       ├── titlebar.css
│   │       ├── tabs.css
│   │       ├── navbar.css
│   │       ├── panels.css
│   │       ├── ai-panel.css
│   │       └── ...         # Additional styles
│   └── ai/                 # AI and automation system
│       ├── agent.js        # Main AI agent (JavaScript)
│       ├── agent.py        # Main AI agent (Python)
│       ├── server.py       # Python Flask backend for AI
│       ├── llm-engine.js   # LLM integration (JavaScript)
│       ├── llm_engine.py   # LLM integration (Python)
│       ├── tools.js/py     # AI tools and actions
│       ├── memory.js/py    # Memory management
│       ├── config.js/py    # AI configuration
│       ├── macros/         # Macro recording and playback
│       │   ├── index.js
│       │   └── healing-engine.js
│       ├── memory/         # Memory and context systems
│       │   ├── index.js
│       │   ├── knowledge-graph.js
│       │   └── temporal-tracker.js
│       ├── perception/     # Visual perception systems
│       │   ├── index.js
│       │   ├── coordinate-mapper.js
│       │   └── frame-compositor.js
│       └── security/       # Security and safety systems
│           ├── index.js
│           ├── injection-detector.js
│           └── intent-verifier.js
├── tests/                  # Test files
├── scripts/                # Build and utility scripts
├── package.json
└── README.md
```

> **Note:** For detailed information about each directory, see the README.md files in:
> - [src/](src/README.md) - Source code overview
> - [src/main/](src/main/README.md) - Electron main process
> - [src/renderer/](src/renderer/README.md) - Browser UI and renderer
> - [src/ai/](src/ai/README.md) - AI and automation systems

## 🔮 Future Plans: AI Agent Integration

EVOS Browser is designed with AI capabilities in mind. Future updates will include:

- **AI Assistant** - Chat with an AI to help you browse, search, and accomplish tasks
- **Automated Tasks** - Let the AI agent fill forms, extract data, and automate repetitive tasks
- **Smart Search** - AI-enhanced search with contextual understanding
- **Content Summarization** - Get quick summaries of long articles
- **Voice Commands** - Control the browser with natural language
- **Intelligent Bookmarking** - AI-suggested bookmarks and organization
- **Web Scraping** - Extract and organize data from websites
- **Automated Testing** - AI-powered website testing and monitoring

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**AhirTech1**

---

<p align="center">
  Built with ❤️ using Electron
</p>