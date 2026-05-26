// backend/src/routes/resumes.ts
import { Elysia } from 'elysia';
import { prisma } from '../lib/prisma';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const RESUMES_DIR = join(process.cwd(), 'resumes');

export const resumeRoutes = new Elysia({ prefix: '/api/resumes' })

  // GET /api/resumes — list all resume variants
  .get('/', async () => {
    return prisma.resume.findMany({
      orderBy: { uploadedAt: 'desc' },
      select: { id: true, name: true, filePath: true, tags: true, isDefault: true, uploadedAt: true },
    });
  })

  // GET /api/resumes/:id — get full resume text
  .get('/:id', async ({ params }) => {
    const resume = await prisma.resume.findUnique({ where: { id: params.id } });
    if (!resume) throw new Error('Resume not found');
    return resume;
  })

  // POST /api/resumes — upload a .md resume
  .post('/', async ({ body }) => {
    const { name, content, tags } = body as {
      name: string;
      content: string;  // raw markdown content
      tags?: string[];
    };

    // Save .md file to disk
    await mkdir(RESUMES_DIR, { recursive: true });
    const fileName = `${Date.now()}-${name.replace(/\s+/g, '-').toLowerCase()}.md`;
    const filePath = join(RESUMES_DIR, fileName);
    await writeFile(filePath, content, 'utf-8');

    // Save metadata + content to DB
    const resume = await prisma.resume.create({
      data: {
        name,
        filePath: `resumes/${fileName}`,
        textContent: content,
        tags: tags ?? [],
      },
    });

    return { id: resume.id, message: 'Resume uploaded successfully' };
  })

  // PATCH /api/resumes/:id/default — set as default resume
  .patch('/:id/default', async ({ params }) => {
    // Unset all others, then set this one
    await prisma.resume.updateMany({ data: { isDefault: false } });
    return prisma.resume.update({
      where: { id: params.id },
      data: { isDefault: true },
    });
  })

  // DELETE /api/resumes/:id
  .delete('/:id', async ({ params }) => {
    await prisma.resume.delete({ where: { id: params.id } });
    return { message: 'Resume deleted' };
  });
