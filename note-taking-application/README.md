# ✍️ Scribble - Markdown Workspace & Writing Assistant

Scribble is a modern, responsive, single-page note-taking application designed to provide a premium workspace for writers and developers. It enables creating, editing, and managing notes in Markdown, compiles them to clean HTML in real-time, and integrates an automated **Writing Assistant** powered by the **LanguageTool API** to catch spelling, grammar, and style errors.

This project is built from scratch utilizing the high-performance **Bun** runtime.

---

## 🌟 Key Features

*   **Premium UI & Workspace**: Sophisticated slate-and-indigo dark mode layout with fluid glassmorphism, responsive sidebar, custom scrollbar, and polished micro-animations.
*   **Dual-Pane Markdown Editor**: Side-by-side editing pane (monospace editor) and live rendered HTML preview pane with customized typographic styling.
*   **Automated Writing Assistant**: Connects to the LanguageTool API to identify grammar, spelling, and style errors.
*   **One-Click Corrections**: The side assistant displays error cards showing context (with wavy underlines) and clickable suggestion pills to apply fixes instantly.
*   **Drag-and-Drop / File Upload**: Drag or upload `.md`, `.markdown`, or `.txt` files directly into the workspace to create database records automatically.
*   **Debounced Auto-Saving**: Automatically saves title and body drafts after 1.2 seconds of typing inactivity, updating error indicators.
*   **Server-Side Persistence**: Built-in server database storage using `bun:sqlite`.

---

## 🛠️ Technology Stack

*   **Runtime & Server**: [Bun](https://bun.sh/) (routing, file-serving, and package bundler).
*   **Database**: SQLite (`bun:sqlite`) for robust, localized persistence.
*   **Markdown Parsing**: [Marked](https://marked.js.org/) library.
*   **Grammar Audit**: [LanguageTool API](https://languagetool.org/http-api/index.html) (public free endpoint).
*   **Frontend**: Vanilla HTML5, modern CSS3 (flex/grid, variables, blur filters), and ES6 JavaScript.

---

## 🚀 Quick Start

### 1. Prerequisites
Ensure you have [Bun installed](https://bun.sh/docs/installation) on your system.

### 2. Install Dependencies
Clone the repository, navigate to the project directory, and run:
```bash
bun install
```

### 3. Run the Development Server
Start the server in hot-reload mode so it automatically refreshes on backend/frontend code edits:
```bash
bun run --hot index.ts
```

The application will be running at **`http://localhost:8080`**.

---

## 🔌 REST API Endpoints

All data is structured in JSON and exposed through the following REST API endpoints:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/` | Serves the workspace HTML application (`index.html`). |
| **GET** | `/api/notes` | Lists all saved notes including titles, previews, error counts, and timestamps. |
| **GET** | `/api/notes/:id` | Returns complete details of a note (markdown, rendered HTML, grammar issue list). |
| **POST** | `/api/notes` | Creates a new note (accepts `{ title, content }`), parses HTML, checks grammar, and saves. |
| **PUT** | `/api/notes/:id` | Updates an existing note title and content, compiles markdown, re-runs grammar check. |
| **DELETE**| `/api/notes/:id` | Permanently deletes a note from the SQLite database. |
| **POST** | `/api/notes/upload` | Parses multipart form-data to extract uploaded file contents, saves and performs grammar checks. |
| **POST** | `/api/notes/:id/check-grammar` | Manually triggers a grammar audit of the note's current text. |

---

## 📁 File Structure

```text
note-taking-application/
├── index.ts          # Bun server setup, router, database configurations, and API controllers
├── index.html        # Main HTML skeleton for split-pane UI
├── styles.css        # Premium stylesheets & component typography systems
├── app.js            # Frontend logic, event handlers, auto-save timers, and suggestion injector
├── notes.db          # Auto-generated SQLite database file
├── package.json      # Dependencies and scripts definitions
└── tsconfig.json     # TypeScript configurations
```
