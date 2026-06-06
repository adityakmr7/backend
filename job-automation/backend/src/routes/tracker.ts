// backend/src/routes/tracker.ts
import { Elysia } from 'elysia';
import { prisma } from '../lib/prisma';

const STAGES = ['applied', 'phone_screen', 'technical', 'offer', 'rejected', 'ghosted'] as const;
type Stage = (typeof STAGES)[number];
const STAGE_SET = new Set<string>(STAGES);

// Normalize a row so both scraped-job applies and external (extension) applies
// expose a consistent { company, title, url } regardless of source.
function normalize<T extends {
  job: { title: string; company: string; applyUrl: string } | null;
  externalCompany: string | null;
  externalTitle: string | null;
  externalUrl: string | null;
}>(app: T) {
  return {
    ...app,
    company: app.job?.company ?? app.externalCompany ?? 'Unknown',
    title: app.job?.title ?? app.externalTitle ?? 'Untitled role',
    url: app.job?.applyUrl ?? app.externalUrl ?? null,
  };
}

export const trackerRoutes = new Elysia({ prefix: '/api/applications' })

  // GET /api/applications — kanban-grouped, normalized
  .get('/', async () => {
    const applications = await prisma.application.findMany({
      include: {
        job: {
          select: { title: true, company: true, ycBatch: true, applyUrl: true, applyEmail: true },
        },
        resume: { select: { name: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });

    const normalized = applications.map(normalize);
    const grouped = Object.fromEntries(STAGES.map((s) => [s, [] as typeof normalized]));
    for (const app of normalized) {
      grouped[app.stage]?.push(app);
    }
    return grouped;
  })

  // POST /api/applications/ingest — record an external application from the
  // browser extension. Dedups on externalUrl (single-user app).
  .post('/ingest', async ({ body }) => {
    const { url, company, title, portal, fieldsFilled, stage } = (body ?? {}) as {
      url?: string;
      company?: string;
      title?: string;
      portal?: string;
      fieldsFilled?: number;
      stage?: string;
    };

    if (!url?.trim()) {
      return { error: { code: 'MISSING_URL', message: 'url is required' } };
    }

    const noteBits = [
      portal ? `Applied via ${portal}` : null,
      typeof fieldsFilled === 'number' ? `${fieldsFilled} fields autofilled` : null,
    ].filter(Boolean);
    const note = noteBits.length ? noteBits.join(' · ') : null;
    const safeStage = stage && STAGE_SET.has(stage) ? (stage as Stage) : 'applied';

    const existing = await prisma.application.findFirst({ where: { externalUrl: url } });
    if (existing) {
      const updated = await prisma.application.update({
        where: { id: existing.id },
        data: {
          submittedAt: new Date(),
          externalCompany: company ?? existing.externalCompany,
          externalTitle: title ?? existing.externalTitle,
          notes: note ?? existing.notes,
        },
      });
      return { application: normalizeStandalone(updated), deduped: true };
    }

    const created = await prisma.application.create({
      data: {
        source: 'extension',
        externalUrl: url,
        externalCompany: company ?? null,
        externalTitle: title ?? null,
        stage: safeStage,
        notes: note,
      },
    });
    return { application: normalizeStandalone(created), deduped: false };
  })

  // GET /api/applications/:id
  .get('/:id', async ({ params }) => {
    const app = await prisma.application.findUniqueOrThrow({
      where: { id: params.id },
      include: {
        job: true,
        resume: { select: { id: true, name: true } },
      },
    });
    return normalize(app as Parameters<typeof normalize>[0]);
  })

  // PATCH /api/applications/:id — update stage, notes, interview date
  .patch('/:id', async ({ params, body, set }) => {
    const { stage, notes, interviewDate } = (body ?? {}) as {
      stage?: string;
      notes?: string | null;
      interviewDate?: string | null;
    };

    if (stage !== undefined && !STAGE_SET.has(stage)) {
      set.status = 400;
      return {
        error: {
          code: 'INVALID_STAGE',
          message: `'${stage}' is not a valid stage`,
          allowed: STAGES,
        },
      };
    }

    const data: Record<string, unknown> = {};
    if (stage !== undefined) data.stage = stage as Stage;
    if (notes !== undefined) data.notes = notes;
    if (interviewDate !== undefined) {
      data.interviewDate = interviewDate ? new Date(interviewDate) : null;
    }

    return prisma.application.update({
      where: { id: params.id },
      data,
    });
  })

  // DELETE /api/applications/:id — remove a mis-clicked application
  .delete('/:id', async ({ params }) => {
    await prisma.application.delete({ where: { id: params.id } });
    return { ok: true };
  });

// For rows fetched without the job include (ingest create/update).
function normalizeStandalone(app: {
  externalCompany: string | null;
  externalTitle: string | null;
  externalUrl: string | null;
} & Record<string, unknown>) {
  return {
    ...app,
    company: app.externalCompany ?? 'Unknown',
    title: app.externalTitle ?? 'Untitled role',
    url: app.externalUrl ?? null,
  };
}
