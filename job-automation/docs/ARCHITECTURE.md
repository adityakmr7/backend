# 🏗 Architecture Overview

## System Design

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js 14)                    │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │  Dashboard  │  │  Job Browser │  │  Application Tracker  │  │
│  │  /dashboard │  │  /jobs       │  │  /applications        │  │
│  └─────────────┘  └──────────────┘  └───────────────────────┘  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Next.js API Routes (/api/*)                 │   │
│  │  (lightweight proxy + SSR data fetching)                 │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTP / WebSocket
┌─────────────────────────▼───────────────────────────────────────┐
│                     BACKEND (Bun + Elysia.js)                   │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Jobs API    │  │  Apply API   │  │  AI/Resume API       │  │
│  │  /api/jobs   │  │  /api/apply  │  │  /api/ai             │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Job Queue (BullMQ)                     │  │
│  │  scrape-queue → apply-queue → followup-queue             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Playwright  │  │  AI Layer    │  │  Email Sender        │  │
│  │  (scraper)   │  │  (Gemini)    │  │  (Nodemailer/SMTP)   │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                     DATABASE LAYER                               │
│                                                                  │
│  PostgreSQL 16 (Docker container)                               │
│  ORM: Prisma (type-safe queries + auto-generated client)        │
│  Migrations: Prisma Migrate                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
job-automation/
├── README.md
├── docs/
│   ├── ARCHITECTURE.md       ← this file
│   ├── FEATURES.md
│   ├── API.md
│   ├── SCRAPING.md
│   ├── AI_STRATEGY.md
│   ├── ROADMAP.md
│   └── SETUP.md
│
├── frontend/                  ← Next.js 14 App
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx           ← Landing / redirect to /dashboard
│   │   ├── dashboard/
│   │   │   └── page.tsx       ← Stats overview
│   │   ├── jobs/
│   │   │   ├── page.tsx       ← Browse scraped jobs
│   │   │   └── [id]/page.tsx  ← Job detail + AI preview
│   │   ├── applications/
│   │   │   └── page.tsx       ← Application tracker (kanban)
│   │   ├── settings/
│   │   │   └── page.tsx       ← Your profile, resume, preferences
│   │   └── api/               ← Next.js API routes (proxy/BFF)
│   ├── components/
│   ├── lib/
│   └── package.json
│
├── backend/                   ← Bun + Elysia.js API
│   ├── src/
│   │   ├── index.ts           ← Elysia server entry
│   │   ├── routes/
│   │   │   ├── jobs.ts
│   │   │   ├── apply.ts
│   │   │   ├── ai.ts
│   │   │   └── tracker.ts
│   │   ├── services/
│   │   │   ├── scraper.ts     ← Playwright scraping service
│   │   │   ├── ai.ts          ← Gemini/OpenAI integration
│   │   │   ├── mailer.ts      ← Email application sender
│   │   │   └── queue.ts       ← BullMQ job queue
│   │   ├── prisma/
│   │   ├── schema.prisma  ← Prisma schema (all models)
│   │   └── migrations/    ← Auto-generated migration files
│   │   └── types/
│   ├── package.json
│   └── bunfig.toml
│
└── package.json               ← Root workspace (runs both)
```

---

## Data Flow

### Job Discovery Flow
```
Cron Trigger (every 6h)
  → Scraper (Playwright) hits workatastartup.com
  → Filters by your preferences (role, location, stage)
  → Deduplicates against DB
  → Saves new jobs to DB
  → Emits event → Frontend updates via SSE (Server-Sent Events)
```

### Auto-Apply Flow
```
User clicks "Auto-Apply" (or it's fully automated)
  → AI reads job description
  → AI tailors cover letter from your base template
  → AI selects best resume variant
  → Playwright fills out application form OR sends email
  → Application logged in DB with status: "applied"
  → 3-day follow-up scheduled in queue
```

### Follow-Up Flow
```
BullMQ delayed job triggers after 3 days
  → Check if interview invite received (email parsing)
  → If no response → send polite follow-up email
  → Update status to "followed_up"
```

---

## Key Design Decisions

### Why Bun over Node.js?
- **Speed**: Bun's SQLite integration is ~10x faster than `better-sqlite3`
- **Native TypeScript**: No ts-node or compilation step
- **Built-in bundler**: No Webpack/Vite needed for backend
- **Smaller footprint**: Single binary deployment

### Why Elysia.js over Express/Fastify?
- Built for Bun — fully optimized
- End-to-end type safety with **Eden Treaty** (like tRPC, zero overhead)
- Excellent performance benchmarks (~2.5M req/s on Bun)

### Why Docker for the database?
- No local PostgreSQL install needed — just `docker compose up`
- Reproducible environment — same config on any machine
- Easy data persistence via Docker volumes
- Can add Redis (for BullMQ queue) to the same `compose.yml`

### Why PostgreSQL + Prisma?
- **PostgreSQL**: Production-grade from day one — full-text search, JSONB columns, better indexing for job/resume queries
- **Prisma**: Best-in-class TypeScript ORM — auto-generated types, visual DB browser (`prisma studio`), painless migrations
- **Docker**: Zero install friction — entire DB spins up with one command (`docker compose up`)
- No SQLite-to-Postgres migration pain later — start right, stay right
- JSONB columns perfect for storing tags, AI scores, and arbitrary job metadata

### Why Playwright over Puppeteer?
- Better anti-bot evasion (uses native browser binaries)
- Works with Chromium, Firefox, WebKit
- Playwright's `stealth` mode bypasses most bot detection

---

## Security Considerations

- All credentials (email, API keys) stored in `.env` — never committed
- Rate limiting on all scraping (2–5 second delays between requests)
- Respect `robots.txt` where applicable
- Single-user auth via NextAuth.js session
- No data leaves your machine (fully local for now)
