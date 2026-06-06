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
import {
  uploadResumePdf,
  deleteResumePdf,
  isSupabaseConfigured,
} from '../services/storage';

const RESUMES_DIR = join(process.cwd(), 'resumes');

async function pdfToText(buf: Uint8Array): Promise<string> {
  const doc = await getDocumentProxy(buf);
  const { text } = await extractText(doc, { mergePages: true });
  return Array.isArray(text) ? text.join('\n\n') : text;
}

/**
 * Delete all existing resume rows (one-resume-per-account enforcement).
 * Also cleans up the Supabase object if configured.
 */
async function clearExistingResumes(): Promise<void> {
  const existing = await prisma.resume.findMany({ select: { id: true } });
  if (existing.length === 0) return;

  // Remove Supabase object once (not per row — there's always max 1 object)
  if (isSupabaseConfigured()) {
    await deleteResumePdf();
  }

  await prisma.resume.deleteMany();
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

    // One-resume-per-account: remove any existing resume first
    await clearExistingResumes();

    await mkdir(RESUMES_DIR, { recursive: true });
    const fileName = `${Date.now()}-${name.replace(/\s+/g, '-').toLowerCase()}.md`;
    const filePath = join(RESUMES_DIR, fileName);
    await writeFile(filePath, content, 'utf-8');

    const resume = await prisma.resume.create({
      data: {
        name,
        filePath: `resumes/${fileName}`,
        textContent: content,
        tags: tags ?? [],
        isDefault: true, // always default when there's only one
      },
    });

    return { id: resume.id, name: resume.name, isDefault: resume.isDefault };
  })

  // POST /api/resumes/upload-pdf
  // 1. Extract text from PDF
  // 2. Clean to markdown via AI
  // 3. Upload compressed PDF to Supabase (if configured)
  // 4. One-resume-per-account: delete old resume, create new DB row
  // Returns the markdown + storage info for the client to display.
  .post('/upload-pdf', async ({ body }) => {
    const { file } = body as { file?: File };
    if (!file) throw new Error('file (PDF) is required');
    if (file.type && !file.type.includes('pdf')) {
      throw new Error(`Expected a PDF, got ${file.type}`);
    }

    const rawBuffer = await file.arrayBuffer();

    // IMPORTANT: unpdf/PDF.js transfers (detaches) the ArrayBuffer during
    // document loading. We must copy the bytes BEFORE calling pdfToText,
    // otherwise the buffer is zero-length by the time we try to compress it.
    const arrForStorage = new Uint8Array(rawBuffer.slice(0)); // independent copy for Supabase
    const arr           = new Uint8Array(rawBuffer);           // will be detached after pdfToText

    const rawText = await pdfToText(arr);
    if (!rawText.trim()) {
      throw new Error('Could not extract text from PDF — is it a scan/image-only file?');
    }

    // AI cleanup → markdown (happens before Supabase so we bail early on AI errors)
    const markdown = await cleanResumeToMarkdown(rawText);

    // Upload compressed PDF to Supabase (non-fatal if not configured)
    let supabaseUrl: string | null = null;
    if (isSupabaseConfigured()) {
      supabaseUrl = await uploadResumePdf(arrForStorage);
    }

    // One-resume-per-account: wipe old rows, create new one
    await clearExistingResumes();

    const suggestedName = file.name?.replace(/\.pdf$/i, '') ?? 'resume';

    // Save to local disk as well (fallback / download endpoint)
    await mkdir(RESUMES_DIR, { recursive: true });
    const fileName = `${Date.now()}-${suggestedName.replace(/\s+/g, '-').toLowerCase()}.md`;
    const localPath = join(RESUMES_DIR, fileName);
    await writeFile(localPath, markdown, 'utf-8');

    await prisma.resume.create({
      data: {
        name: suggestedName,
        // Prefer Supabase URL as the canonical filePath; fall back to local path
        filePath: supabaseUrl ?? `resumes/${fileName}`,
        textContent: markdown,
        tags: [],
        isDefault: true,
      },
    });

    return {
      suggestedName,
      markdown,
      rawTextLength: rawText.length,
      ...(supabaseUrl ? { supabaseUrl, compressed: true } : {}),
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

    // Best-effort: keep the on-disk .md file in sync (if using local path)
    if (content !== undefined && updated.filePath && !updated.filePath.startsWith('http')) {
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
    const [resume, profile] = await Promise.all([
      prisma.resume.findUniqueOrThrow({ where: { id: params.id } }),
      prisma.profile.findFirst(),
    ]);
    const analysis = await analyzeResume(resume.textContent, profile);
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

    const [resume, profile] = await Promise.all([
      prisma.resume.findUniqueOrThrow({ where: { id: params.id } }),
      prisma.profile.findFirst(),
    ]);

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

    const tailored = await tailorResumeForJob(resume.textContent, jd, title, co, profile);
    return {
      markdown: tailored.markdown,
      changeNotes: tailored.changeNotes,
      basedOn: { resumeId: resume.id, jobId: jobId ?? null, jobTitle: title, company: co },
    };
  })

  // GET /api/resumes/:id/download — serve the raw .md file
  .get('/:id/download', async ({ params, set }) => {
    const resume = await prisma.resume.findUniqueOrThrow({ where: { id: params.id } });

    // filePath is either a Supabase URL (https://...) or a local relative path
    let content: string;
    if (resume.filePath.startsWith('http')) {
      // Stored in Supabase — textContent in DB is always the source of truth for markdown
      content = resume.textContent;
    } else {
      const onDisk = join(process.cwd(), resume.filePath);
      content = await readFile(onDisk, 'utf-8').catch(() => resume.textContent);
    }

    const safeName = resume.name.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
    set.headers['content-type'] = 'text/markdown; charset=utf-8';
    set.headers['content-disposition'] = `attachment; filename="${safeName}.md"`;
    return content;
  })

  // DELETE /api/resumes/:id
  .delete('/:id', async ({ params }) => {
    const resume = await prisma.resume.findUnique({ where: { id: params.id } });
    if (resume?.filePath.startsWith('http') && isSupabaseConfigured()) {
      await deleteResumePdf();
    }
    await prisma.resume.delete({ where: { id: params.id } });
    return { message: 'Resume deleted' };
  });
