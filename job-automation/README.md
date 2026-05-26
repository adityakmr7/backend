# 🚀 JobPilot — Automated Job Application Engine

> A personal, full-stack job automation system built to intelligently apply to **Y Combinator portfolio companies** and beyond. Built with **Next.js + Bun**.

---

## 📌 Project Goals

- **Primary**: Auto-apply to YC-backed companies at scale
- **Secondary**: Track every application, follow-up status, and interview pipeline
- **Tertiary**: AI-personalized cover letters and resume tailoring per job

---

## 🗂 Documentation Index

| Doc | Description |
|-----|-------------|
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System design, stack decisions, and data flow |
| [FEATURES.md](./docs/FEATURES.md) | Full feature list with priorities |
| [API.md](./docs/API.md) | Bun backend API reference |
| [SCRAPING.md](./docs/SCRAPING.md) | YC job board scraping strategy |
| [AI_STRATEGY.md](./docs/AI_STRATEGY.md) | AI cover letter & resume tailoring approach |
| [ROADMAP.md](./docs/ROADMAP.md) | Phased development roadmap |
| [SETUP.md](./docs/SETUP.md) | Local development setup guide |

---

## 🛠 Tech Stack (TL;DR)

```
Frontend  → Next.js 14 (App Router) + TypeScript + TailwindCSS
Backend   → Bun + Elysia.js (REST API)
Database  → PostgreSQL 16 (Docker) + Prisma ORM
Resume    → Markdown (.md) files, parsed directly by AI
AI        → Google Gemini API / OpenAI GPT-4o
Scraping  → Playwright (headless) + Cheerio
Queue     → BullMQ (Redis via Docker) for async jobs
Auth      → NextAuth.js (personal use, single-user)
```

---

## 🔑 Why This Stack?

- **Bun** is 3–5x faster than Node.js for raw throughput — perfect for parallel job scraping and API calls
- **Next.js App Router** gives you SSR, file-based routing, and API routes in one package
- **Elysia.js** is built specifically for Bun — fully typed end-to-end with Eden Treaty
- **SQLite first** — zero-config for personal use; migrate to Postgres when needed

---

## ⚡ Quick Start

```bash
# Clone and enter the project
git clone <your-repo>
cd job-automation

# Install frontend deps
cd frontend && npm install

# Install backend deps (requires Bun)
cd ../backend && bun install

# Start both
bun run dev  # from root (uses concurrently)
```

> See [SETUP.md](./docs/SETUP.md) for full environment variable setup.

---

## 🎯 YC Application Focus

The system's primary target is the **YC Work at a Startup** board (workatastartup.com) — one of the richest sources of funded startup jobs. The scraper:

1. Pulls all active YC company listings
2. Filters by your role preferences (SWE, Full-stack, etc.)
3. Auto-applies via their form or email
4. Logs every submission with timestamps

See [SCRAPING.md](./docs/SCRAPING.md) for details.
