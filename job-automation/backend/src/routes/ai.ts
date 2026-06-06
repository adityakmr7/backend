// backend/src/routes/ai.ts
import { Elysia } from 'elysia';
import type { Resume } from '@prisma/client';
import { prisma } from '../lib/prisma';
import {
  generateCoverLetter,
  scoreResumeForJob,
  candidateBackground,
} from '../services/ai';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Lazy Flash client for the local company-summary prompt. Same DB-first /
// env-fallback rules as services/ai.ts.
async function flashModel() {
  const row = await prisma.settings.findFirst().catch(() => null);
  const key = (row?.geminiApiKey || process.env.GEMINI_API_KEY || '').trim();
  if (!key) throw new Error('AI_KEY_MISSING: configure a Gemini key in /settings');
  return new GoogleGenerativeAI(key).getGenerativeModel({ model: 'gemini-1.5-flash' });
}

export const aiRoutes = new Elysia({ prefix: '/api/ai' })

  // POST /api/ai/cover-letter — generate tailored cover letter
  .post('/cover-letter', async ({ body }) => {
    const { jobId, resumeId, tone = 'startup-friendly' } = body as {
      jobId: string;
      resumeId?: string;
      tone?: string;
    };

    const [job, resume, profile] = await Promise.all([
      prisma.job.findUniqueOrThrow({ where: { id: jobId } }),
      resumeId
        ? prisma.resume.findUniqueOrThrow({ where: { id: resumeId } })
        : prisma.resume.findFirst({ where: { isDefault: true } }),
      prisma.profile.findFirst(),
    ]);

    if (!resume) throw new Error('No resume found. Upload a resume first.');

    const coverLetter = await generateCoverLetter(
      job.description,
      resume.textContent,
      `${job.company} (YC ${job.ycBatch ?? 'backed'})`,
      tone,
      profile,
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

    const [job, resumes, profile] = await Promise.all([
      prisma.job.findUniqueOrThrow({ where: { id: jobId } }),
      prisma.resume.findMany(),
      prisma.profile.findFirst(),
    ]);

    if (resumes.length === 0) throw new Error('No resumes found.');

    const scores = await Promise.all(
      resumes.map(async (resume: Resume) => {
        const score = await scoreResumeForJob(resume.textContent, job.description, profile);
        return { resumeId: resume.id, resumeName: resume.name, ...score };
      })
    );

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);
    return { scores, bestResumeId: scores[0]?.resumeId };
  })

  // POST /api/ai/company-summary — AI company intelligence panel
  // Reads already-scraped metadata + JD, returns structured intel (fast Flash model)
  .post('/company-summary', async ({ body }) => {
    const { jobId } = body as { jobId: string };

    const [job, profile] = await Promise.all([
      prisma.job.findUniqueOrThrow({ where: { id: jobId } }),
      prisma.profile.findFirst(),
    ]);

    // Build context from scraped data + JD
    const meta = job.metadata as Record<string, unknown> | null;
    const metaStr = meta
      ? JSON.stringify({
          stage:            meta.stage,
          industry:         meta.industry,
          team_size:        meta.team_size,
          year_founded:     meta.year_founded,
          company_location: meta.company_location,
          short_description: meta.short_description,
          long_description: meta.long_description,
          website:          meta.website,
        }, null, 2)
      : 'No additional metadata available.';

    const prompt = `
You are a startup research analyst. Summarise this company for a job applicant in <5 seconds of reading.
${candidateBackground(profile)}
**COMPANY:** ${job.company} (YC ${job.ycBatch ?? 'backed'})
**ROLE BEING HIRED:** ${job.title}

**SCRAPED METADATA:**
${metaStr}

**JOB DESCRIPTION (first 2000 chars):**
${job.description.slice(0, 2000)}

Return ONLY valid JSON with this exact shape (no fence, no commentary):
{
  "oneLiner": "<25-word max company description>",
  "stage": "<seed | series-a | series-b | growth | public | unknown>",
  "teamSize": "<e.g. '10-20' or 'unknown'>",
  "techStack": ["<tech1>", "<tech2>"],
  "whyInteresting": ["<reason 1>", "<reason 2>", "<reason 3 max>"],
  "redFlags": ["<concern if any, omit array if none>"],
  "keyChallenge": "<one sentence: the core engineering/product challenge this role addresses>",
  "competitorLandscape": "<one sentence on who they compete with>",
  "fundingContext": "<one sentence on funding stage and YC batch if available>"
}

Be factual. Only include techStack items actually mentioned in the JD or metadata. If unsure, omit.
If CANDIDATE BACKGROUND is present, slant whyInteresting toward what the candidate would care about (their target roles, stack overlap).
`.trim();

    const flash = await flashModel();
    const result = await flash.generateContent(prompt);
    const text = result.response.text().trim()
      .replace(/^```(?:json)?\n?/, '')
      .replace(/\n?```$/, '');

    const intel = JSON.parse(text) as {
      oneLiner: string;
      stage: string;
      teamSize: string;
      techStack: string[];
      whyInteresting: string[];
      redFlags: string[];
      keyChallenge: string;
      competitorLandscape: string;
      fundingContext: string;
    };

    return {
      company: job.company,
      jobTitle: job.title,
      ycBatch: job.ycBatch,
      intel,
    };
  });
