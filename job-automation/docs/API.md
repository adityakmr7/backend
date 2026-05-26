# 📡 Backend API Reference

## Base URL
- **Dev**: `http://localhost:3001`
- All endpoints return JSON

---

## Authentication
Single-user app — protected via a simple API key in headers (or session cookie from Next.js frontend).

```
Authorization: Bearer <API_KEY>
```

Set `API_KEY` in `.env`.

---

## Jobs API

### `GET /api/jobs`
List all scraped jobs with optional filters.

**Query Params:**
| Param | Type | Description |
|-------|------|-------------|
| `status` | string | `new`, `saved`, `applied`, `interview`, `rejected` |
| `source` | string | `yc`, `lever`, `greenhouse` |
| `role` | string | Filter by job title keyword |
| `remote` | boolean | Remote only |
| `limit` | number | Default: 50 |
| `offset` | number | Default: 0 |

**Response:**
```json
{
  "total": 142,
  "jobs": [
    {
      "id": "uuid",
      "title": "Senior Full Stack Engineer",
      "company": "LinearAI",
      "ycBatch": "W24",
      "location": "Remote",
      "isRemote": true,
      "tags": ["React", "TypeScript", "Bun"],
      "postedAt": "2026-05-20T10:00:00Z",
      "status": "new",
      "relevanceScore": 87
    }
  ]
}
```

---

### `GET /api/jobs/:id`
Get full details for a single job.

**Response:**
```json
{
  "id": "uuid",
  "title": "Senior Full Stack Engineer",
  "company": "LinearAI",
  "description": "Full job description text...",
  "applyUrl": "https://...",
  "applyMethod": "form",
  "salary": { "min": 120000, "max": 180000, "currency": "USD" },
  "companySummary": {
    "bullets": ["..."],
    "techStack": ["React", "Rust"],
    "teamSize": "15"
  }
}
```

---

### `POST /api/jobs/scrape`
Trigger a manual scrape.

**Body:**
```json
{
  "source": "yc",
  "filters": {
    "roles": ["Software Engineer"],
    "remote": true,
    "batches": ["W25", "S24"]
  }
}
```

**Response:**
```json
{
  "jobId": "queue-job-id",
  "status": "queued",
  "message": "Scrape job queued. Results in ~2 minutes."
}
```

---

### `PATCH /api/jobs/:id`
Update a job's status or notes.

**Body:**
```json
{
  "status": "saved",
  "notes": "Great team, YC W24, they use TypeScript"
}
```

---

## AI API

### `POST /api/ai/cover-letter`
Generate a tailored cover letter.

**Body:**
```json
{
  "jobId": "uuid",
  "resumeVariantId": "uuid",
  "tone": "startup-friendly"
}
```

**Response:**
```json
{
  "coverLetter": "Your personalized cover letter text...",
  "wordCount": 287,
  "validationPassed": true
}
```

---

### `POST /api/ai/score-resume`
Score all your resume variants against a job.

**Body:**
```json
{
  "jobId": "uuid"
}
```

**Response:**
```json
{
  "scores": [
    {
      "resumeId": "uuid",
      "resumeName": "full-stack-resume.pdf",
      "score": 91,
      "matchedSkills": ["TypeScript", "React", "Bun"],
      "missingSkills": ["Rust"],
      "recommendation": "strong_match"
    }
  ]
}
```

---

### `POST /api/ai/company-summary`
Get an AI summary of a company.

**Body:**
```json
{
  "jobId": "uuid"
}
```

**Response:**
```json
{
  "bullets": [
    "Builds AI-powered code review for enterprise teams",
    "Core technical challenge: real-time diff analysis at scale",
    "YC W24, recently announced Series A signals",
    "Remote-first, async culture",
    "Opportunity to own entire frontend architecture"
  ],
  "techStack": ["React", "Python", "PostgreSQL"],
  "teamSize": "12"
}
```

---

## Apply API

### `POST /api/apply/:jobId`
Submit an application for a job.

**Body:**
```json
{
  "resumeVariantId": "uuid",
  "coverLetter": "Your cover letter text...",
  "mode": "semi-auto",
  "additionalAnswers": {
    "yearsOfExperience": "5",
    "preferredStartDate": "Immediately"
  }
}
```

**Response:**
```json
{
  "applicationId": "uuid",
  "status": "submitted",
  "submittedAt": "2026-05-26T10:30:00Z",
  "method": "form",
  "followUpScheduled": "2026-05-29T10:30:00Z"
}
```

---

### `GET /api/apply/queue`
Check the status of queued applications.

**Response:**
```json
{
  "pending": 3,
  "processing": 1,
  "completed": 47,
  "failed": 2,
  "queue": [
    {
      "jobId": "uuid",
      "company": "LinearAI",
      "status": "processing",
      "startedAt": "2026-05-26T10:28:00Z"
    }
  ]
}
```

---

## Tracker API

### `GET /api/applications`
Get all applications with kanban-friendly grouping.

**Response:**
```json
{
  "applied": [...],
  "phoneScreen": [...],
  "technical": [...],
  "offer": [...],
  "rejected": [...],
  "ghosted": [...]
}
```

---

### `PATCH /api/applications/:id`
Update application stage or notes.

**Body:**
```json
{
  "stage": "phone_screen",
  "interviewDate": "2026-06-01T14:00:00Z",
  "notes": "Talk to CTO, focus on system design"
}
```

---

## Profile API

### `GET /api/profile`
Get your profile and preferences.

### `PUT /api/profile`
Update your profile.

**Body:**
```json
{
  "name": "Aditya Kumar",
  "email": "your@email.com",
  "targetRoles": ["Software Engineer", "Full Stack Engineer"],
  "targetLocations": ["Remote", "San Francisco"],
  "preferredSalary": { "min": 100000, "currency": "USD" },
  "linkedinUrl": "https://linkedin.com/in/...",
  "githubUrl": "https://github.com/..."
}
```

---

## Resume API

### `GET /api/resumes`
List all uploaded resume variants.

### `POST /api/resumes`
Upload a new resume variant.

**Body** (multipart/form-data):
```
file: <pdf>
name: "full-stack-resume"
tags: ["frontend", "full-stack"]
```

---

## WebSocket / SSE

### `GET /api/events` (Server-Sent Events)
Real-time updates for:
- New jobs scraped
- Application submitted
- Queue status changes

```typescript
// Frontend usage
const events = new EventSource('/api/events');
events.onmessage = (e) => {
  const data = JSON.parse(e.data);
  // { type: 'new_jobs', count: 5 }
  // { type: 'application_submitted', jobId: '...' }
};
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "JOB_NOT_FOUND",
    "message": "No job found with id: abc123",
    "statusCode": 404
  }
}
```

| Code | HTTP | Description |
|------|------|-------------|
| `JOB_NOT_FOUND` | 404 | Job ID doesn't exist |
| `ALREADY_APPLIED` | 409 | Application already submitted |
| `AI_ERROR` | 500 | Gemini API failure |
| `SCRAPE_FAILED` | 500 | Playwright scrape failed |
| `RATE_LIMITED` | 429 | Too many AI requests |
