// backend/src/routes/profile.ts
import { Elysia } from 'elysia';
import { prisma } from '../lib/prisma';

export const profileRoutes = new Elysia({ prefix: '/api/profile' })

  .get('/', async () => {
    const profile = await prisma.profile.findFirst();
    if (!profile) return { message: 'No profile yet. Create one via PUT /api/profile' };
    return profile;
  })

  .put('/', async ({ body }) => {
    const data = body as {
      name: string;
      email: string;
      linkedinUrl?: string;
      githubUrl?: string;
      portfolioUrl?: string;
      targetRoles?: string[];
      targetLocations?: string[];
      preferredSalaryMin?: number;
    };

    const existing = await prisma.profile.findFirst();

    if (existing) {
      return prisma.profile.update({ where: { id: existing.id }, data });
    }
    return prisma.profile.create({ data });
  });
