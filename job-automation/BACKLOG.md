# 📋 JobPilot — Backlog

> Living document tracking all features, tasks, and bugs.
> Updated as work progresses.
>
> **Legend**: `[x]` Done · `[/]` In Progress · `[ ]` Not Started · `[!]` Blocked

---

## 🏗 Phase 0 — Foundation

### Infrastructure
- [x] Root monorepo `package.json` with `concurrently` (runs frontend + backend)
- [x] `.gitignore` for Node, Bun, Prisma, Docker, env files
- [x] `docker-compose.yml` — PostgreSQL 16 + Redis 7 with health checks & volumes
- [x] Docker containers running (`jobpilot-db` on port 5433, `jobpilot-redis` on 6379)

### Backend — Core Setup
- [x] Bun + Elysia.js server (`src/index.ts`) with CORS + Swagger
- [x] `GET /health` endpoint working
- [x] Prisma schema (`Job`, `Application`, `Resume`, `Profile` models)
- [x] First DB migration applied (`20260526_init`)
- [x] Singleton Prisma client (`src/lib/prisma.ts`)
- [x] `bunfig.toml` for Bun configuration
- [x] `backend/.env` + `.env.example` with all required vars

### Frontend — Core Setup
- [x] Next.js 14 scaffolded (App Router + TypeScript + TailwindCSS)
- [x] Basic layout + nav shell (`app/layout.tsx`) — Sidebar + Topbar + main area
- [x] Global design tokens / CSS variables — full dark design system
- [x] Root page redirect to `/dashboard`
- [x] Page stubs: `/dashboard`, `/jobs`, `/applications`, `/resumes`, `/settings`
- [x] `Sidebar.tsx` — active link highlighting, section labels, status indicator
- [x] `Topbar.tsx` — dynamic page titles + action slot

---

## 🛠 Phase 1 — MVP

### Job Scraper Service
- [x] `src/services/scraper.ts` — scraper service file created
- [x] Lever.co public API fetcher (`fetchLeverJobs`)
- [x] Greenhouse.io public API fetcher (`fetchGreenhouseJobs`)
- [x] `saveJobs()` with deduplication (unique on `source + externalId`)
- [x] AI relevance scoring on save (calls `scoreJobRelevance`)
- [x] Starter company lists (`YC_LEVER_COMPANIES`, `YC_GREENHOUSE_COMPANIES`)
- [x] **`scrapeWAASJobs()`** — workatastartup.com scraper (no Playwright, pure fetch + regex)
  - [x] Pagination through all listing pages (30 jobs/page)
  - [x] Rich detail fetch per job: equity, salary, skills, visa, experience level
  - [x] Full WAAS filter support (industry, jobType, hasSalary, hasEquity, usVisa, etc.)
  - [x] HTML → plain text conversion for AI ingestion
- [x] `POST /api/jobs/scrape` wired to WAAS + Lever + Greenhouse
- [x] `GET /api/jobs/stats` — counts by status and source
- [x] Cron job — auto-scrape every 6 hours
- [x] `GET /api/jobs/scrape/status` — check if scrape is running
- [ ] Playwright stealth plugin setup (anti-bot detection)

### Jobs API
- [x] `GET /api/jobs` — list with filters (status, source, role, remote, limit, offset)
- [x] `GET /api/jobs/:id` — full job detail with applications
- [x] `PATCH /api/jobs/:id` — update status/notes
- [x] `POST /api/jobs/scrape` — stub (logs only, not wired to scraper yet)
- [ ] `GET /api/jobs/stats` — counts by status/source

### AI API
- [x] `src/services/ai.ts` — Gemini Pro + Flash clients
- [x] `generateCoverLetter()` — 3-paragraph, tone-aware, quality gated
- [x] `scoreResumeForJob()` — returns score 0-100 + matched/missing skills
- [x] `scoreJobRelevance()` — fast Flash model, used during scrape
- [x] `POST /api/ai/cover-letter` — generate cover letter route
- [x] `POST /api/ai/score-resume` — score all resume variants for a job
- [ ] `POST /api/ai/company-summary` — AI summary of company (bullets + tech stack)

### Resume API
- [x] `POST /api/resumes` — upload `.md` resume (saves to disk + DB)
- [x] `GET /api/resumes` — list all variants
- [x] `GET /api/resumes/:id` — get full resume with text content
- [x] `PATCH /api/resumes/:id/default` — set default resume
- [x] `DELETE /api/resumes/:id` — delete resume
- [ ] Validate `.md` format on upload
- [ ] Resume preview endpoint (return rendered HTML from markdown)

### Apply API
- [x] `POST /api/apply/:jobId` — record application + update job status
- [x] `GET /api/apply/queue` — stub queue status
- [ ] Email sender service (`src/services/mailer.ts` — Nodemailer + Gmail SMTP)
- [ ] Send actual application email (when `applyMethod === 'email'`)
- [ ] Playwright form filler for Lever job application forms
- [ ] BullMQ queue integration for async auto-apply

### Application Tracker API
- [x] `GET /api/applications` — kanban-grouped by stage
- [x] `GET /api/applications/:id` — full application detail
- [x] `PATCH /api/applications/:id` — update stage, notes, interview date
- [ ] `DELETE /api/applications/:id`
- [ ] Auto-move to "ghosted" if no update after 14 days

### Profile API
- [x] `GET /api/profile` — get profile
- [x] `PUT /api/profile` — upsert profile
- [ ] Validate required fields (name, email)

---

## 🤖 Phase 2 — Automation

### Job Queue (BullMQ)
- [ ] `src/services/queue.ts` — BullMQ setup with Redis
- [ ] Scrape queue — scheduled job every 6 hours
- [ ] Apply queue — async Playwright form submission
- [ ] Follow-up queue — delayed jobs (3-day follow-up emails)
- [ ] Queue dashboard (Bull Board UI)

### Auto-Apply Engine
- [ ] Playwright form filler for Lever forms
- [ ] Playwright form filler for Greenhouse forms
- [ ] Email application sender via Gmail SMTP
- [ ] Auto-apply mode (full-auto, no confirmation needed)
- [ ] Screenshot on successful submission (proof of apply)

### Follow-Up System
- [ ] Mailer service (`src/services/mailer.ts`)
- [ ] Follow-up email template
- [ ] Schedule follow-up 3 days after application
- [ ] Mark `followUpSentAt` in DB

### Company Intelligence
- [ ] `POST /api/ai/company-summary` route + service
- [ ] Fetch company website text (Playwright)
- [ ] Fetch YC company profile from Bookface/YC directory

---

## 🎨 Phase 1 — Frontend (Next.js)

### Layout & Shell
- [x] App shell (`app/layout.tsx`) — sidebar nav + header
- [x] Sidebar: Dashboard, Jobs, Applications, Resumes, Settings
- [x] Dark mode + CSS variables

### Dashboard Page (`/dashboard`)
- [x] Stats cards: Total scraped, Applied, Interview, Response rate
- [x] Recent applications list
- [x] "Trigger scrape" button

### Job Browser (`/jobs`)
- [x] Jobs table/card list with search + status/remote filters
- [x] Status badge, YC batch badge, Remote badge
- [x] Relevance score bar (visual progress bar)
- [x] Job detail page (`/jobs/[id]`) — full JD + compensation facts + founders
- [x] Scrape options dropdown (maxJobs, fetchDetail toggle)
- [ ] AI cover letter generator UI on job detail page
- [ ] Company AI summary panel

### Application Tracker (`/applications`)
- [x] Kanban board (6 stages: Applied → Offer / Rejected / Ghosted)
- [x] Application cards with drag-and-drop stage transitions
- [x] Notes editor + cover letter preview in detail modal
- [x] Stats bar (count per stage)
- [ ] Interview date picker in modal

### Resume Manager (`/resumes`)
- [x] Upload PDF — Gemini converts to markdown
- [x] "Paste markdown directly" fallback path
- [x] List all resume variants with tags + date
- [x] Set default resume
- [x] Markdown preview pane
- [x] Live edit (split editor + preview)
- [x] AI Analyze pane — score ring, strengths/weaknesses, skill chips
- [x] AI Tailor pane — JD input, change-notes sidebar, tailored preview

### Settings (`/settings`)
- [x] Profile form (name, email, LinkedIn, GitHub, portfolio) — wired to `/api/profile`
- [x] Target roles + locations (comma-separated) — saved to DB
- [x] Preferred salary input
- [x] Scraper config info panel + Trigger Scrape button
- [x] Toast notification on save success/error

---

## 📊 Phase 3 — Intelligence & Analytics

- [ ] Analytics dashboard — response rate, avg time-to-reply, top companies
- [ ] Cover letter A/B testing (track which tone performs best)
- [ ] Interview prep module — AI question generator per company
- [ ] Gmail API integration — detect interview invites automatically
- [ ] Browser extension (Chrome/Firefox) — auto-fill on any job site
- [ ] Export applications to CSV/JSON

---

## 🐛 Known Issues / Bugs

| # | File | Description | Priority |
|---|------|-------------|----------|
| 1 | `routes/jobs.ts` | `POST /api/jobs/scrape` is a stub — not wired to scraper service | **Fixed** ✅ |
| 2 | `routes/apply.ts` | Queue integration is a stub — no actual BullMQ | Medium |
| 3 | `routes/apply.ts` | Email sending not implemented — only records in DB | High |
| 4 | `routes/ai.ts` | `Promise.all` implicit `any` on `resume` param — **Fixed** ✅ | Done |

---

## 🔑 Key Decisions Made

| Decision | Choice | Reason |
|----------|--------|--------|
| ORM | Prisma | Type-safe, great migrations, Prisma Studio |
| Database | PostgreSQL 16 (Docker) | Production-grade, native arrays for tags |
| Runtime | Bun + Elysia.js | Fast, native TS, great for I/O-heavy scraping |
| AI Model | Gemini Pro (covers) + Flash (scoring) | Quality vs speed tradeoff |
| Resume format | Markdown `.md` | No PDF parsing, AI reads directly |
| DB Port | 5433 (not 5432) | Port 5432 was already in use locally |

---

## ⏭ Immediate Next Steps (Priority Order)

1. [ ] **Cover letter UI** on `/jobs/[id]` — tone selector + preview + copy
2. [ ] **Interview date picker** in applications modal
3. [ ] **Mailer service** — Gmail SMTP for email applications (`src/services/mailer.ts`)
4. [ ] **Dashboard stats** — wire stats cards to real API data
5. [ ] **Job detail AI summary** — one-click company intel panel
