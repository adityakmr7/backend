// backend/src/routes/resumes.ts
import { Elysia } from 'elysia';
import { prisma } from '../lib/prisma';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { extractText, getDocumentProxy } from 'unpdf';
import {
  cleanResumeToMarkdown,
  analyzeResume,
  tailorResumeForJob,
} from '../services/ai';

const RESUMES_DIR = join(process.cwd(), 'resumes');

async function pdfToText(buf: Uint8Array): Promise<string> {
  const doc = await getDocumentProxy(buf);
  const { text } = await extractText(doc, { mergePages: true });
  return Array.isArray(text) ? text.join('\n\n') : text;
}

export const resumeRoutes = new Elysia({ prefix: '/api/resumes' })

  // GET /api/resumes — list all resume variants
  .get('/', async () => {
    return prisma.resume.findMany({
      orderBy: { uploadedAt: 'desc' },
      select: {
        id: true, name: true, filePath: true, tags: true,
        isDefault: true, uploadedAt: true, updatedAt: true,
      },
    });
  })

  // GET /api/resumes/:id — full resume incl. textContent
  .get('/:id', async ({ params }) => {
    const resume = await prisma.resume.findUnique({ where: { id: params.id } });
    if (!resume) throw new Error('Resume not found');
    return resume;
  })

  // POST /api/resumes — save markdown directly (user pasted / edited it)
  .post('/', async ({ body }) => {
    const { name, content, tags, isDefault } = body as {
      name: string;
      content: string;
      tags?: string[];
      isDefault?: boolean;
    };

    if (!name?.trim() || !content?.trim()) {
      throw new Error('name and content are required');
    }

    await mkdir(RESUMES_DIR, { recursive: true });
    const fileName = `${Date.now()}-${name.replace(/\s+/g, '-').toLowerCase()}.md`;
    const filePath = join(RESUMES_DIR, fileName);
    await writeFile(filePath, content, 'utf-8');

    if (isDefault) {
      await prisma.resume.updateMany({ data: { isDefault: false } });
    }

    const resume = await prisma.resume.create({
      data: {
        name,
        filePath: `resumes/${fileName}`,
        textContent: content,
        tags: tags ?? [],
        isDefault: Boolean(isDefault),
      },
    });

    return { id: resume.id, name: resume.name, isDefault: resume.isDefault };
  })

  // POST /api/resumes/upload-pdf — accept PDF, extract text, clean to markdown
  // Returns the markdown for user confirmation; does NOT persist (use POST / after).
  .post('/upload-pdf', async ({ body }) => {
    const { file } = body as { file?: File };
    if (!file) throw new Error('file (PDF) is required');
    if (file.type && !file.type.includes('pdf')) {
      throw new Error(`Expected a PDF, got ${file.type}`);
    }

    const arr = new Uint8Array(await file.arrayBuffer());
    const rawText = await pdfToText(arr);
    if (!rawText.trim()) {
      throw new Error('Could not extract text from PDF — is it a scan/image-only file?');
    }

    const markdown = await cleanResumeToMarkdown(rawText);
    return {
      suggestedName: file.name?.replace(/\.pdf$/i, '') ?? 'resume',
      markdown,
      rawTextLength: rawText.length,
    };
  })

  // PUT /api/resumes/:id — update name / content / tags
  .put('/:id', async ({ params, body }) => {
    const { name, content, tags } = body as {
      name?: string;
      content?: string;
      tags?: string[];
    };
    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (content !== undefined) data.textContent = content;
    if (tags !== undefined) data.tags = tags;

    const updated = await prisma.resume.update({
      where: { id: params.id },
      data,
    });

    // Best-effort: keep the on-disk .md file in sync
    if (content !== undefined && updated.filePath) {
      const onDisk = join(process.cwd(), updated.filePath);
      await writeFile(onDisk, content, 'utf-8').catch(() => null);
    }
    return updated;
  })

  // PATCH /api/resumes/:id/default — set as default resume
  .patch('/:id/default', async ({ params }) => {
    await prisma.resume.updateMany({ data: { isDefault: false } });
    return prisma.resume.update({
      where: { id: params.id },
      data: { isDefault: true },
    });
  })

  // POST /api/resumes/:id/analyze — Gemini structured analysis
  .post('/:id/analyze', async ({ params }) => {
    const resume = await prisma.resume.findUniqueOrThrow({ where: { id: params.id } });
    const analysis = await analyzeResume(resume.textContent);
    return analysis;
  })

  // POST /api/resumes/:id/tailor — rewrite for a job description
  // Body: { jobId } OR { jobDescription, jobTitle?, company? }
  .post('/:id/tailor', async ({ params, body }) => {
    const { jobId, jobDescription, jobTitle, company } = body as {
      jobId?: string;
      jobDescription?: string;
      jobTitle?: string;
      company?: string;
    };

    const resume = await prisma.resume.findUniqueOrThrow({ where: { id: params.id } });

    let jd = jobDescription;
    let title = jobTitle;
    let co = company;
    if (jobId) {
      const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
      jd = job.description;
      title = job.title;
      co = job.company;
    }
    if (!jd?.trim()) throw new Error('Provide jobId or jobDescription');

    const tailored = await tailorResumeForJob(resume.textContent, jd, title, co);
    return {
      markdown: tailored.markdown,
      changeNotes: tailored.changeNotes,
      basedOn: { resumeId: resume.id, jobId: jobId ?? null, jobTitle: title, company: co },
    };
  })

  // GET /api/resumes/:id/download — serve the raw .md file
  .get('/:id/download', async ({ params, set }) => {
    const resume = await prisma.resume.findUniqueOrThrow({ where: { id: params.id } });
    const onDisk = join(process.cwd(), resume.filePath);
    const content = await readFile(onDisk, 'utf-8').catch(() => resume.textContent);
    const safeName = resume.name.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
    set.headers['content-type'] = 'text/markdown; charset=utf-8';
    set.headers['content-disposition'] = `attachment; filename="${safeName}.md"`;
    return content;
  })

  // DELETE /api/resumes/:id
  .delete('/:id', async ({ params }) => {
    await prisma.resume.delete({ where: { id: params.id } });
    return { message: 'Resume deleted' };
  });
