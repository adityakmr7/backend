// backend/src/routes/apply.ts
import { Elysia } from 'elysia';
import { prisma } from '../lib/prisma';

export const applyRoutes = new Elysia({ prefix: '/api/apply' })

  // POST /api/apply/:jobId — submit an application
  .post('/:jobId', async ({ params, body }) => {
    const { resumeId, coverLetter, mode = 'semi-auto' } = body as {
      resumeId?: string;
      coverLetter?: string;
      mode?: 'semi-auto' | 'full-auto';
    };

    const job = await prisma.job.findUniqueOrThrow({ where: { id: params.jobId } });

    // Check not already applied
    const existing = await prisma.application.findFirst({
      where: { jobId: params.jobId },
    });
    if (existing) {
      throw new Error('Already applied to this job');
    }

    // Create application record
    const application = await prisma.application.create({
      data: {
        jobId: params.jobId,
        resumeId: resumeId ?? null,
        coverLetter: coverLetter ?? null,
        stage: 'applied',
      },
    });

    // Update job status
    await prisma.job.update({
      where: { id: params.jobId },
      data: { status: 'applied' },
    });

    // TODO: If mode === 'full-auto' → push to Playwright apply queue

    return {
      applicationId: application.id,
      status: 'submitted',
      submittedAt: application.submittedAt,
      company: job.company,
      title: job.title,
      message: mode === 'semi-auto'
        ? 'Application recorded. Submit manually via the apply URL.'
        : 'Application queued for automated submission.',
    };
  })

  // GET /api/apply/queue — check queue status
  .get('/queue', async () => {
    // TODO: integrate BullMQ queue stats (Phase 2)
    return {
      pending: 0,
      processing: 0,
      completed: await prisma.application.count(),
      failed: 0,
      message: 'Queue integration coming in Phase 2',
    };
  });
