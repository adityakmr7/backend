# ✨ Feature List

## Priority Levels
- 🔴 **P0** — Must have (MVP)
- 🟡 **P1** — Should have (v1.1)
- 🟢 **P2** — Nice to have (v2.0)

---

## 🎯 Core Features

### F1: YC Job Board Scraper 🔴
**What**: Automatically scrape [workatastartup.com](https://www.workatastartup.com/jobs) for all active job listings.

**Details**:
- Filter by: role type, remote/hybrid, company stage (S/W batch), team size
- Run on a schedule (every 6 hours via cron)
- Deduplication: skip already-seen jobs
- Store: company name, role, JD text, apply URL, posted date

---

### F2: Job Dashboard 🔴
**What**: A clean UI to browse all scraped jobs.

**Details**:
- Table/card view with sorting (date, company, YC batch)
- Quick filters: role, remote, applied/not-applied
- Single-click to view full job description
- Status badge: New | Saved | Applied | Rejected | Interview

---

### F3: AI Cover Letter Generator 🔴
**What**: Auto-generate a tailored cover letter for each job using Gemini.

**Details**:
- Input: your base resume + job description
- Output: 3-paragraph cover letter, personalized to the company
- Tone settings: formal / conversational / startup-friendly
- One-click copy or include in application

---

### F4: Application Tracker (Kanban) 🔴
**What**: Drag-and-drop board to track all applications.

**Columns**:
```
Applied → Phone Screen → Technical → Offer → Rejected → Ghosted
```

**Details**:
- Auto-populates when you apply via the app
- Notes field per application
- Interview date reminders

---

### F5: Auto-Apply Engine 🟡
**What**: Playwright-powered form filler that submits applications automatically.

**Modes**:
1. **Semi-auto**: Preview AI-generated content → click "Submit"
2. **Full-auto**: Queue jobs and apply overnight without intervention

**Targets**:
- YC Work at a Startup application forms
- Lever.co job boards (used by many YC companies)
- Greenhouse.io job boards
- Direct email applications (detect email in JD)

---

### F6: Resume Variants Manager 🟡
**What**: Upload multiple resume variants; AI picks the best one per job.

**Details**:
- Tag resumes: "frontend-focused", "full-stack", "startup"
- AI scores each resume variant against the JD
- Auto-selects highest-scoring variant for each application

---

### F7: Email Integration (Follow-Ups) 🟡
**What**: Auto-send follow-up emails after N days of no response.

**Details**:
- Connect your Gmail via OAuth (or SMTP credentials)
- Template: "Following up on my application for [Role] at [Company]"
- Configurable delay: 3, 5, or 7 days
- One-time follow-up per application (don't spam)

---

### F8: Company Intelligence Panel 🟡
**What**: Per-company insights to help you personalize applications.

**Details**:
- YC batch year, investors, team size
- Recent news (Tavily/web search API)
- Glassdoor-style review summary (scraped)
- LinkedIn founder profiles (optional)

---

### F9: Analytics Dashboard 🟢
**What**: Stats on your job search performance.

**Metrics**:
- Applications sent per day/week
- Response rate (%)
- Average time to response
- Top companies by stage reached
- Cover letter A/B test results

---

### F10: Browser Extension (Auto-Fill) 🟢
**What**: Chrome/Firefox extension to auto-fill application forms on any site.

**Details**:
- Reads your profile from the backend
- One-click fill on any job application page
- Works on sites not supported by the Playwright scraper

---

### F11: Interview Prep Module 🟢
**What**: AI-powered interview question generator per company.

**Details**:
- Scrapes company's tech blog, GitHub, product page
- Generates likely interview questions
- STAR-method answer templates

---

## Feature Summary Table

| Feature | Priority | Effort | Status |
|---------|----------|--------|--------|
| YC Scraper | 🔴 P0 | Medium | ⬜ Todo |
| Job Dashboard | 🔴 P0 | Medium | ⬜ Todo |
| AI Cover Letter | 🔴 P0 | Low | ⬜ Todo |
| Application Tracker | 🔴 P0 | Medium | ⬜ Todo |
| Auto-Apply Engine | 🟡 P1 | High | ⬜ Todo |
| Resume Variants | 🟡 P1 | Low | ⬜ Todo |
| Email Follow-Ups | 🟡 P1 | Medium | ⬜ Todo |
| Company Intel | 🟡 P1 | Medium | ⬜ Todo |
| Analytics | 🟢 P2 | Medium | ⬜ Todo |
| Browser Extension | 🟢 P2 | High | ⬜ Todo |
| Interview Prep | 🟢 P2 | Medium | ⬜ Todo |
