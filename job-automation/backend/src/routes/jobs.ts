// backend/src/routes/jobs.ts
import { Elysia, t } from 'elysia';
import { prisma } from '../lib/prisma';
import {
  scrapeWAASJobs,
  saveJobs,
  type WAASFilters,
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
          companySlug: true,
          ycBatch: true,
          location: true,
          isRemote: true,
          tags: true,
          status: true,
          relevanceScore: true,
          source: true,
          salary: true,
          equity: true,
          role: true,
          yearsExp: true,
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

  // DELETE /api/jobs — wipe ALL jobs (cascades to applications)
  // Usage: DELETE http://localhost:3001/api/jobs
  // Optional body: { confirm: true }  (safety guard)
  .delete('/', async ({ body }) => {
    const { confirm = false } = (body ?? {}) as { confirm?: boolean };
    if (!confirm) {
      throw new Error(
        'Safety check: send { "confirm": true } in the request body to delete all jobs.'
      );
    }
    const { count } = await prisma.job.deleteMany({});
    console.log(`[Jobs] Deleted ${count} jobs (+ cascaded applications)`);
    return {
      deleted: count,
      message: `${count} jobs deleted. All linked applications were also removed.`,
    };
  })

  // DELETE /api/jobs/:id — delete a single job
  .delete('/:id', async ({ params }) => {
    const job = await prisma.job.findUnique({ where: { id: params.id } });
    if (!job) throw new Error('Job not found');
    await prisma.job.delete({ where: { id: params.id } });
    return { deleted: true, id: params.id, title: job.title, company: job.company };
  })

  // POST /api/jobs/scrape — trigger scrape
  .post('/scrape', async ({ body }) => {
    const {
      maxJobs = 100,
      fetchDetail = true,
      useResumeScoring = true,
      filters = {},
    } = (body ?? {}) as {
      maxJobs?: number;
      fetchDetail?: boolean;
      useResumeScoring?: boolean;
      filters?: WAASFilters;
    };

    // Load default resume for AI relevance scoring
    let resumeText: string | undefined;
    if (useResumeScoring) {
      const defaultResume = await prisma.resume.findFirst({ where: { isDefault: true } });
      resumeText = defaultResume?.textContent;
      if (resumeText) console.log('[Scraper] Resume loaded for relevance scoring');
    }

    console.log(`[Scraper] Fetching WAAS jobs (max: ${maxJobs})`);
    const jobs = await scrapeWAASJobs(maxJobs, filters, fetchDetail);
    const { saved, skipped } = await saveJobs(jobs, resumeText);

    return {
      status: 'completed',
      saved,
      skipped,
      message: `Scrape done. ${saved} new jobs saved, ${skipped} duplicates skipped.`,
    };
  });
