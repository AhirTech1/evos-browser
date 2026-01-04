# EVOS Browser - AI Agent System

A native JavaScript-based AI agent powered by node-llama-cpp that runs completely offline.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    EVOS Browser (Electron)                  │
│  ┌───────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │   Browser UI   │  │   Webview    │  │    AI Panel     │  │
│  └───────────────┘  └──────────────┘  └─────────────────┘  │
│                              │                              │
│                         IPC Bridge                          │
│                              │                              │
│  ┌───────────────────────────┴────────────────────────────┐│
│  │                   AI System (Native)                    ││
│  │                                                         ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ ││
│  │  │ LLM Engine  │  │    Agent    │  │     Memory      │ ││
│  │  │ (llama.cpp) │  │  (ReAct)    │  │  (JSON + Disk)  │ ││
│  │  └─────────────┘  └─────────────┘  └─────────────────┘ ││
│  │         │                │                  │          ││
│  │         └────────────────┼──────────────────┘          ││
│  │                          │                             ││
│  │                   ┌──────┴──────┐                      ││
│  │                   │   Browser   │                      ││
│  │                   │   Tools     │                      ││
│  │                   └─────────────┘                      ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. LLM Engine (`llm-engine.js`)
- Uses `node-llama-cpp` to run GGUF models natively
- Supports Qwen2.5-3B-Instruct (default)
- Features: chat, generate, streaming
- Manages model loading/unloading

### 2. Agent System (`agent.js`)
- ReAct-style agent (Reason + Act)
- Multi-step task execution
- Uses browser tools for web automation
- Maintains conversation history

### 3. Browser Tools (`tools.js`)
Available tools:
- `navigate_to` - Go to URL
- `search_web` - Search Google
- `click_element` - Click by CSS selector
- `type_text` - Type into input fields
- `scroll_page` - Scroll up/down
- `extract_text` - Get page content
- `get_page_info` - Get title, URL, meta
- `find_elements` - Find interactive elements
- `wait_for_element` - Wait for element
- `go_back/forward` - Navigation
- `get_links` - Get all links
- `fill_form` - Fill multiple fields
- `take_screenshot` - Capture page
- `answer_user` - Final response

### 4. Memory System (`memory.js`)
- JSON-based local storage
- Simple text similarity search
- Remembers pages, interactions, facts
- Persisted to `%APPDATA%/evos-browser/memory/`

### 5. Model Downloader (`model-downloader.js`)
- Downloads model on first launch
- Progress tracking with resume support
- Stores models in `%APPDATA%/evos-browser/models/`

## Model

**Default**: Qwen2.5-3B-Instruct Q4_K_M
- Size: ~1.9 GB
- Source: Hugging Face
- Format: GGUF (quantized)

The model is downloaded automatically on first launch.

## Usage

The AI is accessed through the panel (Ctrl+Shift+A or click AI button):

1. **Chat**: Natural conversation with the AI
2. **Quick Actions**: Summarize, Remember, Extract
3. **Memory**: View and search saved memories
4. **Tasks**: Create automation workflows

## File Structure

```
src/ai/
├── index.js                      # Main exports (JavaScript)
├── config.js / config.py         # Configuration
├── llm-engine.js / llm_engine.py # LLM interface
├── gemini_engine.py              # Google Gemini integration
├── agent.js / agent.py           # ReAct agent
├── tools.js / tools.py           # Browser automation tools
├── memory.js / memory.py         # Memory management
├── model-downloader.js           # Model download manager
├── server.py                     # Flask backend for Python AI
├── requirements.txt              # Python dependencies
├── macros/                       # → See macros/README.md
│   ├── index.js
│   └── healing-engine.js
├── memory/                       # → See memory/README.md
│   ├── index.js
│   ├── knowledge-graph.js
│   └── temporal-tracker.js
├── perception/                   # → See perception/README.md
│   ├── index.js
│   ├── coordinate-mapper.js
│   └── frame-compositor.js
└── security/                     # → See security/README.md
    ├── index.js
    ├── injection-detector.js
    └── intent-verifier.js
```

## Subdirectories

- **[macros/](macros/README.md)** - Macro recording and playback with self-healing
- **[memory/](memory/README.md)** - Knowledge graph and temporal memory systems
- **[perception/](perception/README.md)** - Visual perception and coordinate mapping
- **[security/](security/README.md)** - Security scanning and intent verification

## Privacy

- All AI processing is local (no cloud)
- No data is sent to external servers
- Memory is stored locally only
- Model runs completely offline

## Requirements

- Node.js 18+
- Windows/macOS/Linux
- ~4GB RAM minimum (8GB recommended)
- ~2GB disk space for model
