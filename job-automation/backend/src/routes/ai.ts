// backend/src/routes/ai.ts
import { Elysia } from 'elysia';
import type { Resume } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { generateCoverLetter, scoreResumeForJob } from '../services/ai';

export const aiRoutes = new Elysia({ prefix: '/api/ai' })

  // POST /api/ai/cover-letter — generate tailored cover letter
  .post('/cover-letter', async ({ body }) => {
    const { jobId, resumeId, tone = 'startup-friendly' } = body as {
      jobId: string;
      resumeId?: string;
      tone?: string;
    };

    const [job, resume] = await Promise.all([
      prisma.job.findUniqueOrThrow({ where: { id: jobId } }),
      resumeId
        ? prisma.resume.findUniqueOrThrow({ where: { id: resumeId } })
        : prisma.resume.findFirst({ where: { isDefault: true } }),
    ]);

    if (!resume) throw new Error('No resume found. Upload a resume first.');

    const coverLetter = await generateCoverLetter(
      job.description,
      resume.textContent,
      `${job.company} (YC ${job.ycBatch ?? 'backed'})`,
      tone
    );

    return {
      coverLetter,
      wordCount: coverLetter.split(/\s+/).length,
      jobTitle: job.title,
      company: job.company,
    };
  })

  // POST /api/ai/score-resume — score resume variants against a job
  .post('/score-resume', async ({ body }) => {
    const { jobId } = body as { jobId: string };

    const [job, resumes] = await Promise.all([
      prisma.job.findUniqueOrThrow({ where: { id: jobId } }),
      prisma.resume.findMany(),
    ]);

    if (resumes.length === 0) throw new Error('No resumes found.');

    const scores = await Promise.all(
      resumes.map(async (resume: Resume) => {
        const score = await scoreResumeForJob(resume.textContent, job.description);
        return { resumeId: resume.id, resumeName: resume.name, ...score };
      })
    );

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);
    return { scores, bestResumeId: scores[0]?.resumeId };
  });
