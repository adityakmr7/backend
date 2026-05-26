// backend/src/routes/tracker.ts
import { Elysia } from 'elysia';
import { prisma } from '../lib/prisma';

const STAGES = ['applied', 'phone_screen', 'technical', 'offer', 'rejected', 'ghosted'] as const;

export const trackerRoutes = new Elysia({ prefix: '/api/applications' })

  // GET /api/applications — kanban-grouped
  .get('/', async () => {
    const applications = await prisma.application.findMany({
      include: {
        job: {
          select: { title: true, company: true, ycBatch: true, applyUrl: true },
        },
        resume: { select: { name: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });

    // Group by stage
    const grouped = Object.fromEntries(STAGES.map((s) => [s, [] as typeof applications]));
    for (const app of applications) {
      grouped[app.stage]?.push(app);
    }
    return grouped;
  })

  // GET /api/applications/:id
  .get('/:id', async ({ params }) => {
    return prisma.application.findUniqueOrThrow({
      where: { id: params.id },
      include: {
        job: true,
        resume: { select: { id: true, name: true } },
      },
    });
  })

  // PATCH /api/applications/:id — update stage, notes, interview date
  .patch('/:id', async ({ params, body }) => {
    return prisma.application.update({
      where: { id: params.id },
      data: body as {
        stage?: string;
        notes?: string;
        interviewDate?: string;
      },
    });
  });
