# 🚀 EVOS Browser: Hackathon Team Guide

Welcome to **EVOS**, the AI-Native Browser project! This guide is designed to help you hit the ground running for the hackathon.

## 🏗️ Architecture Overview

The project is built on **Electron** (Chromium + Node.js) with a dedicated **Python AI Backend**.

1.  **Renderer Process (UI):** What the user sees. Pure HTML/CSS/Vanilla JS.
    *   *Path:* `src/renderer/`
2.  **Main Process (Backend):** The "Browser" logic (Window management, System access).
    *   *Path:* `src/main/`
3.  **AI Engine:** A local Python server handling LLM inference and Memory.
    *   *Path:* `src/ai/`

---

## 🎨 Role 1: The Designer ("Vibe Coder")
**Goal:** Make it feel "Premium" and "Alive".
**Workspace:** `src/renderer/styles/` & `src/renderer/index.html`

### Current State
- **Theme:** Glassmorphism (Translucent blur), Dark/Purple aesthetic.
- **Components:** Custom Titlebar (Chrome-style), Side Panel (AI Chat), Floating Tabs.
- **Key Files:**
    - `main.css`: Global variables (Colors, Shadows). **Start here.**
    - `tabs.css`: The glassy tab styling.
    - `ai-panel.css`: The chat interface and memory cards.
    - `animations.css`: (Create this!) We need smooth entry/exit animations.

### Tasks for Hackathon
1.  **Micro-Interactions:** Add hover effects to buttons. Make the tabs "glow" when active (already started).
2.  **AI Animations:** When the AI is "Thinking", create a cool pulsing animation in the chat panel.
3.  **Welcome Page:** Design a stunning `newtab.html` page that isn't just a blank screen.

> **Tip:** Use `var(--bg-tertiary-rgb)` with `rgba()` for transparency to keep the glass effect consistent.

---

## 🔧 Role 2: The Backend Guy
**Goal:** Performance, Data Handling, and Stability.
**Workspace:** `src/main/` & `src/ai/server.py`

### Current State
- Electron communicates with the UI via **IPC** (Inter-Process Communication).
- Electron communicates with Python via standard IO or local HTTP server.

### Tasks for Hackathon
1.  **Optimize Startup:** Ensure the Python process spawns cleanly when the browser starts (`src/main/main.js`).
2.  **Data Persistence:** When the AI "Remembers" something, where does it go? Check `src/gui/memory.js`. We might need a proper SQLite database if JSON gets too slow.
3.  **Download Manager:** Implement logic to handle file downloads (Electron's `session.on('will-download')`).
4.  **Security:** Fix any "unsafe-inline" CSP warnings in `index.html` headers.

> **Tip:** Watch out for the "Windows Electron Loading" bug. Ensure dependencies are robust.

---

## 🧠 Role 3: The AI Guy
**Goal:** Make the Browser "Smart". RAG (Retrieval Augmented Generation).
**Workspace:** `src/ai/`

### Current State
- **Engine:** Python-based (`llm_engine.py`). Likely using local models (Ollama/Llama) or wrappers.
- **Memory:** `memory.py` uses Vector embeddings to store browsing history context.

### Tasks for Hackathon
1.  **Summarization:** Make the "Summarize Page" feature lightning fast. Currently, it scrapes text and feeds it to LLM. Optimize the scraping prompt.
2.  **Context Aware:** Can the AI read the *current* tab's content automatically? (Check `browser_integration` code).
3.  **Smart History:** Instead of "searching history", allow users to ask "What was that shoe store I saw yesterday?". This requires embedding *all* visited page metadata into the Vector Store (`memory.py`).

> **Tip:** `server.py` is the entry point. Ensure your Python environment version matches the team's.

---

## 🤝 Role 4: The Integrator (You)
**Goal:** Glue it all together. No "it works on my machine".
**Workspace:** `src/renderer/scripts/app.js`, `ai-panel.js`, `package.json`

### Your Responsibilities
1.  **Orchestration:** Ensure the Frontend sends the right data to Backend, and Backend passes it to AI.
2.  **Bug Hunting:** You fixed the "Zombie Panel" bug. Keep an eye out for memory leaks (listeners not being removed).
3.  **Tab Management:** `tabs.js` is critical. If tabs break, the browser breaks.
4.  **Deployment:** Run `npm run build` early and often to ensure the executable actually works.

---

## 🚀 Quick Setup (For Team)
1.  **Node.js:** `npm install`
2.  **Python:** `pip install -r src/ai/requirements.txt`
3.  **Run:** `npm start`
4.  **Dev Mode:** `Ctrl+Shift+I` opens DevTools.

**Good luck with the Hackathon! Use the `task.md` to track your progress.**
