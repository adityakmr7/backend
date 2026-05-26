# 🕸 Scraping Strategy

## Target: YC Work at a Startup

**URL**: https://www.workatastartup.com/jobs

This is the primary target — the official YC job board listing roles at YC-backed companies.

---

## Approach

### Phase 1: Static Scraping (Cheerio)
For pages that don't require JavaScript rendering:

```typescript
// backend/src/services/scraper.ts
import * as cheerio from 'cheerio';

async function scrapeStaticPage(url: string) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...',
      'Accept': 'text/html,application/xhtml+xml',
    }
  });
  const html = await res.text();
  const $ = cheerio.load(html);
  // parse...
}
```

### Phase 2: Dynamic Scraping (Playwright)
YC's job board is React-rendered — requires Playwright:

```typescript
import { chromium } from 'playwright';

async function scrapeYCJobs(filters: JobFilters): Promise<Job[]> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 ...',
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();
  await page.goto('https://www.workatastartup.com/jobs', {
    waitUntil: 'networkidle',
  });

  // Apply filters via UI or URL params
  await page.selectOption('[data-role="role-filter"]', filters.role);

  // Wait for job cards to load
  await page.waitForSelector('.job-card');

  const jobs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.job-card')).map(card => ({
      title: card.querySelector('.job-title')?.textContent?.trim(),
      company: card.querySelector('.company-name')?.textContent?.trim(),
      url: card.querySelector('a')?.href,
      // ...
    }));
  });

  await browser.close();
  return jobs;
}
```

---

## Anti-Detection Strategy

> ⚠️ Always respect terms of service. This is for personal use only.

### Techniques Used
1. **Random delays**: 2–8 seconds between requests (not uniform)
2. **Realistic User-Agent**: Rotate between real browser UA strings
3. **Viewport randomization**: 1280x800, 1440x900, 1920x1080
4. **Session cookies**: Maintain session across requests
5. **Playwright stealth plugin**: Patches known bot-detection fingerprints

```bash
bun add playwright-extra playwright-extra-plugin-stealth
```

```typescript
import { chromium } from 'playwright-extra';
import StealthPlugin from 'playwright-extra-plugin-stealth';

chromium.use(StealthPlugin());
```

### Rate Limiting Rules
```typescript
// config/scraper.config.ts
export const scraperConfig = {
  delayBetweenRequests: { min: 2000, max: 8000 }, // ms
  maxConcurrentPages: 2,
  maxRequestsPerHour: 120,
  retryAttempts: 3,
  retryDelay: 5000,
};
```

---

## Scraping Schedule

```typescript
// backend/src/services/cron.ts
import { CronJob } from 'cron';

// Scrape every 6 hours
new CronJob('0 */6 * * *', async () => {
  console.log('🔍 Starting YC job scrape...');
  await scrapeYCJobs(userPreferences);
}, null, true, 'Asia/Kolkata');
```

---

## Other Target Job Boards

| Board | Method | Notes |
|-------|--------|-------|
| workatastartup.com | Playwright | Primary target |
| Lever.co | REST API | Many YC companies use this. Has a public API: `GET /v0/{company}/postings` |
| Greenhouse.io | REST API | `GET /v1/boards/{company}/jobs` — no auth needed for public listings |
| Wellfound (AngelList) | Playwright | Requires login for full details |
| LinkedIn | Playwright | Very aggressive bot detection — use sparingly |
| Indeed | Playwright | Rate limit carefully |

### Lever API Example (Zero scraping needed!)
```typescript
// Many YC companies use Lever — just hit their public API
async function fetchLeverJobs(companySlug: string) {
  const res = await fetch(
    `https://api.lever.co/v0/postings/${companySlug}?mode=json`
  );
  return res.json();
}

// Usage:
// fetchLeverJobs('stripe')
// fetchLeverJobs('openai')
// fetchLeverJobs('notion')
```

### Greenhouse API Example
```typescript
async function fetchGreenhouseJobs(companySlug: string) {
  const res = await fetch(
    `https://boards-api.greenhouse.io/v1/boards/${companySlug}/jobs`
  );
  return res.json();
}
```

---

## Data Schema (Scraped Job)

```typescript
interface ScrapedJob {
  id: string;               // UUID
  source: 'yc' | 'lever' | 'greenhouse' | 'email';
  externalId: string;       // Source's job ID
  title: string;
  company: string;
  companySlug: string;
  description: string;      // Full JD text
  applyUrl: string;
  applyMethod: 'form' | 'email' | 'external';
  applyEmail?: string;      // If apply-by-email
  location: string;
  isRemote: boolean;
  salary?: { min: number; max: number; currency: string };
  tags: string[];           // e.g. ['React', 'TypeScript', 'Bun']
  ycBatch?: string;         // e.g. 'W24', 'S23'
  postedAt: Date;
  scrapedAt: Date;
  status: 'new' | 'saved' | 'applied' | 'rejected' | 'interview';
}
```

---

## Deduplication Strategy

```typescript
// Use compound unique key: (source + externalId)
// Before inserting, check:
const existing = db.query(
  'SELECT id FROM jobs WHERE source = ? AND external_id = ?'
).get(job.source, job.externalId);

if (!existing) {
  db.insert(job);
}
```

---

## YC-Specific Filters

When targeting YC companies specifically, filter by:

```typescript
const ycFilters = {
  // Prefer recent batches (last 2 years)
  batches: ['S25', 'W25', 'S24', 'W24', 'S23'],
  
  // Your target roles
  roles: ['Software Engineer', 'Full Stack Engineer', 'Backend Engineer'],
  
  // Prefer these stages (early = less competition, more impact)
  stages: ['seed', 'series-a'],
  
  // Remote or hybrid
  locations: ['remote', 'San Francisco', 'New York'],
  
  // Minimum team size (avoid too-early if you want stability)
  minTeamSize: 5,
};
```
