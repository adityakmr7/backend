// backend/src/routes/jobs.ts
import { Elysia, t } from 'elysia';
import { prisma } from '../lib/prisma';
import {
  fetchLeverJobs,
  fetchGreenhouseJobs,
  scrapeYCJobs,
  saveJobs,
  YC_LEVER_COMPANIES,
  YC_GREENHOUSE_COMPANIES,
} from '../services/scraper';

export const jobsRoutes = new Elysia({ prefix: '/api/jobs' })

  // GET /api/jobs — list with filters
  .get('/', async ({ query }) => {
    const {
      status,
      source,
      role,
      remote,
      limit = '50',
      offset = '0',
    } = query as Record<string, string>;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (source) where.source = source;
    if (remote === 'true') where.isRemote = true;
    if (role) where.title = { contains: role, mode: 'insensitive' };

    const [total, jobs] = await Promise.all([
      prisma.job.count({ where }),
      prisma.job.findMany({
        where,
        orderBy: [{ relevanceScore: 'desc' }, { scrapedAt: 'desc' }],
        take: parseInt(limit),
        skip: parseInt(offset),
        select: {
          id: true,
          title: true,
          company: true,
          ycBatch: true,
          location: true,
          isRemote: true,
          tags: true,
          status: true,
          relevanceScore: true,
          source: true,
          postedAt: true,
          scrapedAt: true,
        },
      }),
    ]);

    return { total, jobs };
  })

  // GET /api/jobs/stats — counts by status and source (must come before /:id)
  .get('/stats', async () => {
    const [byStatus, bySource, total] = await Promise.all([
      prisma.job.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.job.groupBy({ by: ['source'], _count: { id: true } }),
      prisma.job.count(),
    ]);
    return {
      total,
      byStatus: Object.fromEntries(
        byStatus.map((r: { status: string; _count: { id: number } }) => [r.status, r._count.id])
      ),
      bySource: Object.fromEntries(
        bySource.map((r: { source: string; _count: { id: number } }) => [r.source, r._count.id])
      ),
    };
  })

  // GET /api/jobs/:id — full job detail
  .get('/:id', async ({ params }) => {
    const job = await prisma.job.findUnique({
      where: { id: params.id },
      include: { applications: { select: { id: true, stage: true, submittedAt: true } } },
    });
    if (!job) throw new Error('Job not found');
    return job;
  })

  // PATCH /api/jobs/:id — update status or notes
  .patch('/:id', async ({ params, body }) => {
    const updated = await prisma.job.update({
      where: { id: params.id },
      data: body as { status?: string; notes?: string },
    });
    return updated;
  })

  // POST /api/jobs/scrape — trigger scrape across YC + Lever + Greenhouse companies
  .post('/scrape', async ({ body }) => {
    const {
      sources = ['yc', 'lever', 'greenhouse'],
      companies,         // optional override list (Lever/Greenhouse only)
      maxYCJobs = 50,
      useResumeScoring = true,
    } = (body ?? {}) as {
      sources?: string[];
      companies?: string[];
      maxYCJobs?: number;
      useResumeScoring?: boolean;
    };

    // Optionally load default resume for relevance scoring
    let resumeText: string | undefined;
    if (useResumeScoring) {
      const defaultResume = await prisma.resume.findFirst({ where: { isDefault: true } });
      resumeText = defaultResume?.textContent;
    }

    let totalSaved = 0;
    let totalSkipped = 0;

    // --- YC (Playwright) ---
    if (sources.includes('yc')) {
      console.log('[Scraper] Fetching YC workatastartup.com');
      const ycJobs = await scrapeYCJobs(maxYCJobs);
      const result = await saveJobs(ycJobs, resumeText);
      totalSaved += result.saved;
      totalSkipped += result.skipped;
    }

    // --- Lever ---
    if (sources.includes('lever')) {
      const slugs = companies ?? YC_LEVER_COMPANIES;
      for (const slug of slugs) {
        console.log(`[Scraper] Fetching Lever: ${slug}`);
        const jobs = await fetchLeverJobs(slug);
        const result = await saveJobs(jobs, resumeText);
        totalSaved += result.saved;
        totalSkipped += result.skipped;
      }
    }

    // --- Greenhouse ---
    if (sources.includes('greenhouse')) {
      const slugs = companies ?? YC_GREENHOUSE_COMPANIES;
      for (const slug of slugs) {
        console.log(`[Scraper] Fetching Greenhouse: ${slug}`);
        const jobs = await fetchGreenhouseJobs(slug);
        const result = await saveJobs(jobs, resumeText);
        totalSaved += result.saved;
        totalSkipped += result.skipped;
      }
    }

    return {
      status: 'completed',
      saved: totalSaved,
      skipped: totalSkipped,
      message: `Scrape done. ${totalSaved} new jobs saved, ${totalSkipped} duplicates skipped.`,
    };
  });
