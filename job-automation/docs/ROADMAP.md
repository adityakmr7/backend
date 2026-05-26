# 🗺 Development Roadmap

## Overview

Build in 3 focused phases, shipping something useful as early as possible.

---

## Phase 0: Foundation (Week 1) 
> **Goal**: Working scraper + basic job browser. No AI yet.

### Tasks
- [ ] Set up monorepo structure (`/frontend`, `/backend`)
- [ ] Initialize Next.js 14 with TypeScript + TailwindCSS
- [ ] Initialize Bun + Elysia.js server
- [ ] Set up SQLite database with Drizzle ORM
- [ ] Build YC job board scraper (Playwright)
- [ ] Build basic Jobs REST API (`GET /api/jobs`)
- [ ] Build simple jobs list UI in Next.js
- [ ] Cron job: auto-scrape every 6 hours
- [ ] Deploy locally and run first scrape

**Milestone**: You can see a list of fresh YC jobs every morning.

---

## Phase 1: MVP (Week 2–3)
> **Goal**: Apply to jobs with AI-generated cover letters. Manual trigger.

### Tasks
- [ ] Integrate Gemini API for cover letter generation
- [ ] Build cover letter preview UI
- [ ] Build user profile/resume upload page
- [ ] Implement Lever.co + Greenhouse API scrapers (zero-config)
- [ ] Build application tracker (simple table, not kanban yet)
- [ ] `POST /api/apply/:jobId` endpoint (email method first)
- [ ] Email sender (Nodemailer + Gmail SMTP)
- [ ] Company AI summary panel in job detail view
- [ ] Job relevance scoring (filter noise)

**Milestone**: Apply to 10 YC companies per day with 1 click, personalized cover letters.

---

## Phase 2: Automation (Week 4–5)
> **Goal**: Fully automated pipeline. Apply overnight.

### Tasks
- [ ] BullMQ setup for async job queue
- [ ] Auto-apply form filler (Playwright, Lever forms)
- [ ] Kanban application tracker with drag-and-drop
- [ ] Resume variants manager + AI resume picker
- [ ] Automated follow-up email scheduler (3-day delay)
- [ ] Email parsing: detect interview invites (Gmail API)
- [ ] Real-time dashboard via SSE
- [ ] Settings page with all preferences

**Milestone**: Wake up to applied jobs + follow-up emails sent. Zero manual work.

---

## Phase 3: Intelligence (Week 6+)
> **Goal**: Smarter targeting + analytics.

### Tasks
- [ ] Analytics dashboard (response rate, top companies)
- [ ] A/B testing for cover letter tones
- [ ] Company intelligence panel (recent news, founders)
- [ ] Interview prep module (AI question generator)
- [ ] Browser extension for external sites
- [ ] Mobile-friendly PWA
- [ ] Export data to CSV/JSON

**Milestone**: Data-driven job search with measurable improvements over time.

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| v0.1.0 | Week 1 | YC scraper + job browser |
| v0.2.0 | Week 2 | AI cover letters + email apply |
| v0.3.0 | Week 3 | Lever/Greenhouse scrapers |
| v1.0.0 | Week 4 | Full auto-apply pipeline |
| v1.1.0 | Week 5 | Kanban + follow-ups |
| v1.2.0 | Week 6 | Analytics + A/B testing |
| v2.0.0 | Month 2 | Browser extension + mobile |

---

## Non-Goals (for now)
- Multi-user support (just you)
- Payment processing
- Mobile app (PWA is enough)
- LinkedIn integration (too aggressive bot detection, high risk)
- Job board posting (you're the applicant, not recruiter)
