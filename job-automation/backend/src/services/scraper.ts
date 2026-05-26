// backend/src/services/scraper.ts
// YC job board scraper — Phase 0 foundation
// Uses Playwright for JS-rendered pages + Cheerio for static parsing

import { chromium } from 'playwright';
import { prisma } from '../lib/prisma';
import { scoreJobRelevance } from './ai';
import { randomInt } from 'node:crypto';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SCRAPER_CONFIG = {
  delayMs: { min: 2000, max: 6000 },
  maxJobs: 200,
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

function delay(min: number, max: number) {
  return new Promise((r) => setTimeout(r, randomInt(min, max)));
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface ScrapedJob {
  source: string;
  externalId: string;
  title: string;
  company: string;
  description: string;
  applyUrl: string;
  applyMethod: string;
  location?: string;
  isRemote: boolean;
  ycBatch?: string;
  tags: string[];
  postedAt?: Date;
}

// ---------------------------------------------------------------------------
// Lever API (many YC companies — no scraping needed!)
// ---------------------------------------------------------------------------
export async function fetchLeverJobs(companySlug: string): Promise<ScrapedJob[]> {
  try {
    const res = await fetch(
      `https://api.lever.co/v0/postings/${companySlug}?mode=json`,
      { headers: { 'User-Agent': SCRAPER_CONFIG.userAgent } }
    );
    if (!res.ok) return [];
    const postings = (await res.json()) as Array<Record<string, unknown>>;
    return postings.map((p) => ({
      source: 'lever',
      externalId: p.id as string,
      title: p.text as string,
      company: companySlug,
      description: (p.descriptionPlain as string) ?? '',
      applyUrl: p.applyUrl as string,
      applyMethod: 'form',
      location: (p.categories as Record<string, string>)?.location ?? '',
      isRemote: String(p.workplaceType ?? '').toLowerCase().includes('remote'),
      tags: ((p.categories as Record<string, string[]>)?.tags ?? []) as string[],
    }));
  } catch {
    console.error(`[Lever] Failed to fetch ${companySlug}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Greenhouse API (another common YC ATS — also public)
// ---------------------------------------------------------------------------
export async function fetchGreenhouseJobs(companySlug: string): Promise<ScrapedJob[]> {
  try {
    const res = await fetch(
      `https://boards-api.greenhouse.io/v1/boards/${companySlug}/jobs?content=true`,
      { headers: { 'User-Agent': SCRAPER_CONFIG.userAgent } }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { jobs: Array<Record<string, unknown>> };
    return (data.jobs ?? []).map((j) => ({
      source: 'greenhouse',
      externalId: String(j.id),
      title: j.title as string,
      company: companySlug,
      description: (j.content as string) ?? '',
      applyUrl: j.absolute_url as string,
      applyMethod: 'form',
      location: (j.location as Record<string, string>)?.name ?? '',
      isRemote: String(j.location).toLowerCase().includes('remote'),
      tags: [],
    }));
  } catch {
    console.error(`[Greenhouse] Failed to fetch ${companySlug}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Save scraped jobs to DB (with deduplication)
// ---------------------------------------------------------------------------
export async function saveJobs(jobs: ScrapedJob[], resumeText?: string) {
  let saved = 0;
  let skipped = 0;

  for (const job of jobs) {
    const existing = await prisma.job.findUnique({
      where: { source_externalId: { source: job.source, externalId: job.externalId } },
    });

    if (existing) { skipped++; continue; }

    // Score relevance if resume provided
    let relevanceScore: number | undefined;
    if (resumeText && job.description) {
      try {
        relevanceScore = await scoreJobRelevance(job.title, job.description, resumeText);
        await delay(500, 1000); // don't hammer Gemini
      } catch { /* skip scoring on error */ }
    }

    await prisma.job.create({
      data: {
        source: job.source,
        externalId: job.externalId,
        title: job.title,
        company: job.company,
        description: job.description,
        applyUrl: job.applyUrl,
        applyMethod: job.applyMethod,
        location: job.location ?? '',
        isRemote: job.isRemote,
        ycBatch: job.ycBatch ?? null,
        tags: job.tags,
        relevanceScore: relevanceScore ?? null,
        postedAt: job.postedAt ?? null,
      },
    });
    saved++;
  }

  console.log(`[Scraper] Saved: ${saved}, Skipped (duplicate): ${skipped}`);
  return { saved, skipped };
}

// ---------------------------------------------------------------------------
// YC Work at a Startup scraper (Playwright)
//   - Public jobs page is React-rendered, requires headless browser
//   - Login-walled details: we only capture what's visible on the listing page
// ---------------------------------------------------------------------------
export async function scrapeYCJobs(maxJobs = 50): Promise<ScrapedJob[]> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: SCRAPER_CONFIG.userAgent,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  try {
    await page.goto('https://www.workatastartup.com/companies', {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });

    // Wait for job/company cards to render (selector intentionally loose
    // since YC tweaks markup; we fall back to scraping any visible job link)
    await page.waitForSelector('a[href*="/jobs/"]', { timeout: 15_000 }).catch(() => null);
    await delay(1500, 2500);

    const jobs = await page.evaluate((limit) => {
      const seen = new Set<string>();
      const out: Array<Record<string, string>> = [];

      document.querySelectorAll('a[href*="/jobs/"]').forEach((a) => {
        if (out.length >= limit) return;
        const href = (a as HTMLAnchorElement).href;
        const match = href.match(/\/jobs\/(\d+)/);
        if (!match || seen.has(match[1])) return;
        seen.add(match[1]);

        // Climb up to the parent card for context (title, company, location)
        const card = (a as HTMLElement).closest('[class*="company"], [class*="job"], li, div') as HTMLElement | null;
        const text = (card?.innerText ?? a.textContent ?? '').trim();
        const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

        out.push({
          externalId: match[1],
          applyUrl: href,
          title: lines[0] ?? '',
          company: lines[1] ?? '',
          rawText: text.slice(0, 500),
        });
      });

      return out;
    }, maxJobs);

    return jobs
      .filter((j) => j.title && j.applyUrl)
      .map((j) => {
        const isRemote = /remote/i.test(j.rawText);
        const ycBatch = j.rawText.match(/\b([WS]\d{2})\b/)?.[1];
        return {
          source: 'yc',
          externalId: j.externalId,
          title: j.title,
          company: j.company || 'Unknown',
          description: j.rawText,
          applyUrl: j.applyUrl,
          applyMethod: 'external',
          location: isRemote ? 'Remote' : '',
          isRemote,
          ycBatch,
          tags: [],
        };
      });
  } catch (err) {
    console.error('[YC Scraper] Failed:', (err as Error).message);
    return [];
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// YC company list (popular companies using Lever or Greenhouse)
// Extend this list as you discover more
// ---------------------------------------------------------------------------
export const YC_LEVER_COMPANIES = [
  'notion',
  'brex',
  'scale',
  'segment',
  'retool',
];

export const YC_GREENHOUSE_COMPANIES = [
  'stripe',
  'airbnb',
  'dropbox',
];
