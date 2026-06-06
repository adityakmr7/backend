// backend/src/services/scraper.ts
// WorkAtAStartup (WAAS) + Lever + Greenhouse scrapers
//
// WAAS strategy (no Playwright needed!):
//   1. Fetch /companies listing page with HTML Accept header — page is SSR'd Rails.
//      All job data is embedded as HTML-entity-encoded JSON in a <div data-*> blob.
//   2. Unescape HTML entities, extract the "jobs": [...] array — 30 jobs per page.
//   3. For each job, fetch /jobs/<id> to get the full description + rich fields
//      (equity, salary, skills, visa, experience level).
//   4. Paginate via ?page=N until we hit maxJobs or run out of pages.

import { Prisma } from '@prisma/client';
import type { Profile } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { scoreJobRelevance } from './ai';
import { randomInt } from 'node:crypto';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const WAAS_BASE = 'https://www.workatastartup.com';

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
  companySlug?: string;
  description: string;
  applyUrl: string;
  applyMethod: string;
  location?: string;
  isRemote: boolean;
  ycBatch?: string;
  tags: string[];
  postedAt?: Date;

  // Rich fields from WAAS job detail page
  salary?: string;
  equity?: string;
  yearsExp?: string;
  visa?: string;
  role?: string;      // roleType from listing
  jobType?: string;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// WAAS types (from /companies listing)
// ---------------------------------------------------------------------------
interface WAASListJob {
  id: number;
  title: string;
  jobType: string;           // "Fulltime"
  location: string;
  roleType: string;          // "Full stack", "Backend", "Frontend", etc.
  salary: string | null;
  companyName: string;
  companySlug: string;
  companyBatch: string;      // "W25", "S24", etc.
  companyOneLiner: string;
  companyLogoUrl: string;
  companyLastActiveAt: string;
  applyUrl: string;
}

// From /jobs/<id> detail page
interface WAASJobDetail {
  id: number;
  title: string;
  salaryRange: string | null;
  equityRange: string | null;
  location: string;
  jobType: string;            // "Full-time"
  sponsorsVisa: string | null; // "US citizenship/visa not required"
  minExperience: string | null; // "3+ years", "Any (new grads ok)"
  skills: string[];
  descriptionHtml: string;
  roleType?: string;
  remote?: boolean;
}

// ---------------------------------------------------------------------------
// WAAS HTML parser helpers
// ---------------------------------------------------------------------------

/** Decode HTML entities in a string (no DOM, pure regex for Bun). */
function htmlDecode(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

/** Strip HTML tags, decode entities → plain text for AI. */
function htmlToText(html: string): string {
  return htmlDecode(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  ).replace(/\n{3,}/g, '\n\n').trim();
}

/** Extract the JSON value of a key from HTML-entity-encoded embedded data. */
function extractEmbeddedJSON<T>(html: string, key: string): T | null {
  const decoded = htmlDecode(html);
  const marker = `"${key}":[`;
  const start = decoded.indexOf(marker);
  if (start === -1) return null;

  // Walk forward to find the matching closing bracket
  let depth = 0;
  let i = start + marker.length - 1;
  const chars = decoded.slice(i);
  for (let j = 0; j < chars.length; j++) {
    if (chars[j] === '[') depth++;
    else if (chars[j] === ']') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(decoded.slice(i, i + j + 1)) as T;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/** Extract a single JSON object value (for job detail pages). */
function extractEmbeddedObject<T>(html: string, key: string): T | null {
  const decoded = htmlDecode(html);
  const marker = `"${key}":{`;
  const start = decoded.indexOf(marker);
  if (start === -1) return null;

  let depth = 0;
  let i = start + marker.length - 1;
  const chars = decoded.slice(i);
  for (let j = 0; j < chars.length; j++) {
    if (chars[j] === '{') depth++;
    else if (chars[j] === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(decoded.slice(i, i + j + 1)) as T;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// WAAS scraper — /companies listing (30 jobs per page)
// ---------------------------------------------------------------------------

/** Build WAAS listing URL with all filters. */
function buildWAASUrl(page: number, filters: WAASFilters): string {
  const params = new URLSearchParams({
    demographic: filters.demographic ?? 'any',
    hasEquity: filters.hasEquity ?? 'any',
    hasSalary: filters.hasSalary ?? 'any',
    industry: filters.industry ?? 'any',
    interviewProcess: filters.interviewProcess ?? 'any',
    jobType: filters.jobType ?? 'any',
    layout: 'list-compact',
    sortBy: filters.sortBy ?? 'created_desc',
    tab: filters.tab ?? 'any',
    usVisaNotRequired: filters.usVisaNotRequired ?? 'any',
    page: String(page),
  });
  return `${WAAS_BASE}/companies?${params.toString()}`;
}

export interface WAASFilters {
  demographic?: string;      // 'any' | 'black' | 'hispanic' | 'female' | 'lgbtq' | 'veteran'
  hasEquity?: string;        // 'any' | 'true'
  hasSalary?: string;        // 'any' | 'true'
  industry?: string;         // 'any' | 'B2B' | 'Consumer' | 'Healthcare' | ...
  interviewProcess?: string; // 'any' | 'fast'
  jobType?: string;          // 'any' | 'fulltime' | 'parttime' | 'internship' | 'contract'
  sortBy?: string;           // 'created_desc' | 'company_asc'
  tab?: string;              // 'any' | 'eng' | 'design' | 'pm' | 'ops'
  usVisaNotRequired?: string;// 'any' | 'true'
}

/** Fetch one WAAS listing page, return the embedded job list. */
async function fetchWAASListingPage(page: number, filters: WAASFilters): Promise<WAASListJob[]> {
  const url = buildWAASUrl(page, filters);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });
    if (!res.ok) {
      console.warn(`[WAAS] Listing page ${page} returned ${res.status}`);
      return [];
    }
    const html = await res.text();
    const jobs = extractEmbeddedJSON<WAASListJob[]>(html, 'jobs');
    return jobs ?? [];
  } catch (err) {
    console.error(`[WAAS] Failed to fetch listing page ${page}:`, (err as Error).message);
    return [];
  }
}

/** Fetch rich job detail from /jobs/<id>. */
async function fetchWAASJobDetail(jobId: number): Promise<WAASJobDetail | null> {
  try {
    const res = await fetch(`${WAAS_BASE}/jobs/${jobId}`, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const html = await res.text();
    return extractEmbeddedObject<WAASJobDetail>(html, 'job');
  } catch (err) {
    console.warn(`[WAAS] Detail fetch failed for job ${jobId}:`, (err as Error).message);
    return null;
  }
}

/** Convert a WAAS listing job + optional detail into a ScrapedJob. */
function waasToScrapedJob(listing: WAASListJob, detail: WAASJobDetail | null): ScrapedJob {
  const descRaw = detail?.descriptionHtml ?? '';
  const description = htmlToText(descRaw) || listing.companyOneLiner;
  const locationStr = listing.location ?? detail?.location ?? '';
  const isRemote =
    locationStr.toLowerCase().includes('remote') ||
    Boolean(detail?.remote);

  return {
    source: 'waas',
    externalId: String(listing.id),
    title: listing.title,
    company: listing.companyName,
    companySlug: listing.companySlug,
    description,
    applyUrl: listing.applyUrl,
    applyMethod: 'external',
    location: locationStr,
    isRemote,
    ycBatch: listing.companyBatch || undefined,
    tags: detail?.skills ?? [],
    salary: listing.salary ?? detail?.salaryRange ?? undefined,
    equity: detail?.equityRange ?? undefined,
    yearsExp: detail?.minExperience ?? undefined,
    visa: detail?.sponsorsVisa ?? undefined,
    role: listing.roleType,
    jobType: listing.jobType,
    metadata: {
      companyOneLiner: listing.companyOneLiner,
      companyLogoUrl: listing.companyLogoUrl,
      companyLastActiveAt: listing.companyLastActiveAt,
    },
  };
}

/**
 * Main WAAS scraper entry point.
 * Paginates through the job listing, optionally fetches rich detail per job.
 *
 * @param maxJobs    Max number of jobs to collect
 * @param filters    WAAS filter params (defaults to "any" for all)
 * @param fetchDetail Fetch /jobs/<id> for description+equity+skills (slower but richer)
 */
export async function scrapeWAASJobs(
  maxJobs = 100,
  filters: WAASFilters = {},
  fetchDetail = true
): Promise<ScrapedJob[]> {
  const out: ScrapedJob[] = [];
  let page = 1;
  let emptyPages = 0;

  console.log(`[WAAS] Starting scrape (max: ${maxJobs}, fetchDetail: ${fetchDetail})`);

  while (out.length < maxJobs && emptyPages < 2) {
    console.log(`[WAAS] Fetching listing page ${page}…`);
    const listings = await fetchWAASListingPage(page, filters);

    if (listings.length === 0) {
      emptyPages++;
      console.log(`[WAAS] Empty page ${page}, stopping.`);
      break;
    }

    for (const listing of listings) {
      if (out.length >= maxJobs) break;

      let detail: WAASJobDetail | null = null;
      if (fetchDetail) {
        detail = await fetchWAASJobDetail(listing.id);
        await delay(300, 800); // polite delay between detail fetches
      }

      out.push(waasToScrapedJob(listing, detail));
    }

    console.log(`[WAAS] Page ${page}: got ${listings.length} jobs (total: ${out.length})`);
    page++;

    // Polite delay between pages
    if (out.length < maxJobs) await delay(1000, 2000);
  }

  console.log(`[WAAS] Done. Collected ${out.length} jobs.`);
  return out;
}

// ---------------------------------------------------------------------------
// Save scraped jobs to DB (with deduplication + AI scoring)
// ---------------------------------------------------------------------------
export async function saveJobs(jobs: ScrapedJob[], resumeText?: string, profile?: Profile | null) {
  let saved = 0;
  let skipped = 0;

  for (const job of jobs) {
    const existing = await prisma.job.findUnique({
      where: { source_externalId: { source: job.source, externalId: job.externalId } },
    });
    if (existing) { skipped++; continue; }

    // Score relevance against resume if provided
    let relevanceScore: number | undefined;
    if (resumeText && job.description) {
      try {
        relevanceScore = await scoreJobRelevance(job.title, job.description, resumeText, profile);
        await delay(400, 900);
      } catch { /* skip scoring on error */ }
    }

    await prisma.job.create({
      data: {
        source: job.source,
        externalId: job.externalId,
        title: job.title,
        company: job.company,
        companySlug: job.companySlug ?? null,
        description: job.description,
        applyUrl: job.applyUrl,
        applyMethod: job.applyMethod,
        location: job.location ?? '',
        isRemote: job.isRemote,
        ycBatch: job.ycBatch ?? null,
        tags: job.tags,
        relevanceScore: relevanceScore ?? null,
        postedAt: job.postedAt ?? null,
        salary: job.salary ?? null,
        equity: job.equity ?? null,
        yearsExp: job.yearsExp ?? null,
        visa: job.visa ?? null,
        role: job.role ?? null,
        jobType: job.jobType ?? null,
        metadata: job.metadata
          ? (job.metadata as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });
    saved++;
  }

  console.log(`[Scraper] Saved: ${saved}, Skipped (dup): ${skipped}`);
  return { saved, skipped };
}
