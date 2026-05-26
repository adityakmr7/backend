import { Database } from "bun:sqlite";
import { marked } from "marked";

// Initialize SQLite database
const db = new Database("notes.db");
db.run(`
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    html TEXT NOT NULL,
    grammar_errors TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Grammar check function calling the free LanguageTool API
async function checkGrammar(text: string): Promise<any[]> {
  if (!text || text.trim() === "") {
    return [];
  }
  try {
    const response = await fetch("https://api.languagetool.org/v2/check", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        text: text,
        language: "en-US",
      }),
    });

    if (!response.ok) {
      console.error(`LanguageTool API responded with status ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.matches || [];
  } catch (error) {
    console.error("Failed to run grammar check:", error);
    return [];
  }
}

const server = Bun.serve({
  port: 8080,
  routes: {
    // API: List all notes
    "/api/notes": {
      GET(req) {
        try {
          const query = db.query(`
            SELECT id, title, SUBSTR(content, 1, 100) as preview, grammar_errors, created_at, updated_at 
            FROM notes 
            ORDER BY updated_at DESC
          `);
          const notes = query.all().map((note: any) => {
            let errorCount = 0;
            try {
              const errors = note.grammar_errors ? JSON.parse(note.grammar_errors) : [];
              errorCount = Array.isArray(errors) ? errors.length : 0;
            } catch (e) {}
            return {
              id: note.id,
              title: note.title,
              preview: note.preview,
              errorCount,
              created_at: note.created_at,
              updated_at: note.updated_at,
            };
          });

          return new Response(JSON.stringify(notes), {
            headers: { 
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            },
          });
        } catch (error: any) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
      
      // Create a note
      POST: async (req) => {
        try {
          const body = await req.json();
          const title = body.title?.trim() || "Untitled Note";
          const content = body.content || "";
          
          // Render markdown to HTML
          const html = await marked.parse(content);
          
          // Run grammar checker
          const grammarMatches = await checkGrammar(content);
          const grammarErrorsJson = JSON.stringify(grammarMatches);

          const result = db.prepare(`
            INSERT INTO notes (title, content, html, grammar_errors)
            VALUES (?, ?, ?, ?)
          `).run(title, content, html, grammarErrorsJson);

          const newNote = db.query("SELECT * FROM notes WHERE id = ?").get(result.lastInsertRowid) as any;
          if (newNote) {
            newNote.grammar_errors = JSON.parse(newNote.grammar_errors || "[]");
          }

          return new Response(JSON.stringify(newNote), {
            status: 201,
            headers: { 
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            },
          });
        } catch (error: any) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
    },

    // API: Individual note routes
    "/api/notes/:id": {
      GET(req) {
        try {
          const noteId = req.params.id;
          const note = db.query("SELECT * FROM notes WHERE id = ?").get(noteId) as any;
          if (!note) {
            return new Response(JSON.stringify({ error: "Note not found" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }

          note.grammar_errors = JSON.parse(note.grammar_errors || "[]");

          return new Response(JSON.stringify(note), {
            headers: { 
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            },
          });
        } catch (error: any) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },

      PUT: async (req) => {
        try {
          const noteId = req.params.id;
          const body = await req.json();
          const title = body.title?.trim() || "Untitled Note";
          const content = body.content || "";

          // Render markdown to HTML
          const html = await marked.parse(content);
          
          // Run grammar checker
          const grammarMatches = await checkGrammar(content);
          const grammarErrorsJson = JSON.stringify(grammarMatches);

          const result = db.prepare(`
            UPDATE notes
            SET title = ?, content = ?, html = ?, grammar_errors = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(title, content, html, grammarErrorsJson, noteId);

          if (result.changes === 0) {
            return new Response(JSON.stringify({ error: "Note not found" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }

          const updatedNote = db.query("SELECT * FROM notes WHERE id = ?").get(noteId) as any;
          if (updatedNote) {
            updatedNote.grammar_errors = JSON.parse(updatedNote.grammar_errors || "[]");
          }

          return new Response(JSON.stringify(updatedNote), {
            headers: { 
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            },
          });
        } catch (error: any) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },

      DELETE(req) {
        try {
          const noteId = req.params.id;
          const result = db.prepare("DELETE FROM notes WHERE id = ?").run(noteId);
          if (result.changes === 0) {
            return new Response(JSON.stringify({ error: "Note not found" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }

          return new Response(JSON.stringify({ success: true }), {
            headers: { 
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            },
          });
        } catch (error: any) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
    },

    // API: Upload markdown file
    "/api/notes/upload": {
      POST: async (req) => {
        try {
          const formData = await req.formData();
          const file = formData.get("file") as File;
          if (!file) {
            return new Response(JSON.stringify({ error: "No file uploaded" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          let title = file.name || "Uploaded Note";
          // Strip extension
          if (title.endsWith(".md")) {
            title = title.substring(0, title.length - 3);
          } else if (title.endsWith(".markdown")) {
            title = title.substring(0, title.length - 9);
          } else if (title.endsWith(".txt")) {
            title = title.substring(0, title.length - 4);
          }

          const content = await file.text();
          const html = await marked.parse(content);
          const grammarMatches = await checkGrammar(content);
          const grammarErrorsJson = JSON.stringify(grammarMatches);

          const result = db.prepare(`
            INSERT INTO notes (title, content, html, grammar_errors)
            VALUES (?, ?, ?, ?)
          `).run(title, content, html, grammarErrorsJson);

          const newNote = db.query("SELECT * FROM notes WHERE id = ?").get(result.lastInsertRowid) as any;
          if (newNote) {
            newNote.grammar_errors = JSON.parse(newNote.grammar_errors || "[]");
          }

          return new Response(JSON.stringify(newNote), {
            status: 201,
            headers: { 
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            },
          });
        } catch (error: any) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
    },

    // API: Manually trigger grammar checking on an existing note
    "/api/notes/:id/check-grammar": {
      POST: async (req) => {
        try {
          const noteId = req.params.id;
          const note = db.query("SELECT * FROM notes WHERE id = ?").get(noteId) as any;
          if (!note) {
            return new Response(JSON.stringify({ error: "Note not found" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }

          const grammarMatches = await checkGrammar(note.content);
          const grammarErrorsJson = JSON.stringify(grammarMatches);

          db.prepare(`
            UPDATE notes
            SET grammar_errors = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(grammarErrorsJson, noteId);

          return new Response(JSON.stringify({
            id: noteId,
            grammar_errors: grammarMatches
          }), {
            headers: { 
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            },
          });
        } catch (error: any) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
    }
  },

  // Fallback handler for serving static assets (HTML, CSS, JS)
  async fetch(req) {
    const url = new URL(req.url);

    // Serve HTML
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(Bun.file("./index.html"), {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Serve CSS
    if (url.pathname === "/styles.css") {
      return new Response(Bun.file("./styles.css"), {
        headers: { "Content-Type": "text/css" },
      });
    }

    // Serve Javascript
    if (url.pathname === "/app.js") {
      return new Response(Bun.file("./app.js"), {
        headers: { "Content-Type": "application/javascript" },
      });
    }

    return new Response("Not Found", { status: 404 });
  }
});

console.log(`🚀 Server is running on ${server.hostname}:${server.port}`);
