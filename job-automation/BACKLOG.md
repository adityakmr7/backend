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
- [x] **Wire `POST /api/jobs/scrape`** to call `fetchLeverJobs` + `fetchGreenhouseJobs` + `saveJobs`
- [x] `GET /api/jobs/stats` — counts by status and source
- [ ] Playwright stealth plugin setup (anti-bot detection)
- [ ] Cron job — auto-scrape every 6 hours
- [ ] `GET /api/jobs/scrape/status` — check if scrape is running

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
- [ ] App shell (`app/layout.tsx`) — sidebar nav + header
- [ ] Sidebar: Dashboard, Jobs, Applications, Resumes, Settings
- [ ] Dark mode toggle + CSS variables

### Dashboard Page (`/dashboard`)
- [ ] Stats cards: Total scraped, Applied, Interview, Response rate
- [ ] Recent applications list
- [ ] "Trigger scrape" button

### Job Browser (`/jobs`)
- [ ] Jobs table/card list (sortable, filterable)
- [ ] Status badge (New, Applied, Interview, etc.)
- [ ] Relevance score bar
- [ ] Job detail panel / modal (full JD + apply button)
- [ ] AI cover letter generator UI (tone selector + preview)
- [ ] Company AI summary panel

### Application Tracker (`/applications`)
- [ ] Kanban board (drag-and-drop between stages)
- [ ] Application card (company, role, date, stage)
- [ ] Notes editor per application
- [ ] Interview date picker

### Resume Manager (`/resumes`)
- [ ] Upload `.md` resume (paste or file picker)
- [ ] List all resume variants with tags
- [ ] Set default resume
- [ ] Markdown preview

### Settings (`/settings`)
- [ ] Profile form (name, email, LinkedIn, GitHub)
- [ ] Target roles + locations multiselect
- [ ] Preferred salary input
- [ ] Gemini API key input
- [ ] Gmail SMTP credentials

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

1. [ ] **Playwright scraper** for `workatastartup.com`
2. [ ] **Jobs browser UI** — fetch from API, list, filter, apply button
3. [ ] **Mailer service** — Gmail SMTP for email applications
4. [ ] **Cron job** — auto-scrape every 6 hours
5. [ ] **Upload resume UI** — paste markdown, set default
