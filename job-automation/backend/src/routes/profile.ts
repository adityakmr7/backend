// backend/src/routes/profile.ts
import { Elysia } from 'elysia';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

interface ProfileBody {
  name?: string;
  email?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  targetRoles?: string[];
  targetLocations?: string[];
  preferredSalaryMin?: number;
  // structured autofill fields
  firstName?: string;
  lastName?: string;
  phone?: string;
  city?: string;
  state?: string;
  country?: string;
  zip?: string;
  experience?: unknown;
  education?: unknown;
}

/** Whitelist body → Prisma data, so unexpected keys can't break the update. */
function toData(body: ProfileBody) {
  const data: Record<string, unknown> = {};
  const scalarKeys: (keyof ProfileBody)[] = [
    'name', 'email', 'linkedinUrl', 'githubUrl', 'portfolioUrl',
    'preferredSalaryMin', 'firstName', 'lastName', 'phone',
    'city', 'state', 'country', 'zip',
  ];
  for (const k of scalarKeys) {
    if (body[k] !== undefined) data[k] = body[k];
  }
  if (body.targetRoles !== undefined) data.targetRoles = body.targetRoles;
  if (body.targetLocations !== undefined) data.targetLocations = body.targetLocations;
  if (body.experience !== undefined) {
    data.experience = body.experience === null ? Prisma.JsonNull : (body.experience as Prisma.InputJsonValue);
  }
  if (body.education !== undefined) {
    data.education = body.education === null ? Prisma.JsonNull : (body.education as Prisma.InputJsonValue);
  }
  return data;
}

export const profileRoutes = new Elysia({ prefix: '/api/profile' })

  .get('/', async () => {
    const profile = await prisma.profile.findFirst();
    if (!profile) return { message: 'No profile yet. Create one via PUT /api/profile' };
    return profile;
  })

  .put('/', async ({ body }) => {
    const data = toData(body as ProfileBody);
    const existing = await prisma.profile.findFirst();

    if (existing) {
      return prisma.profile.update({ where: { id: existing.id }, data });
    }
    // name + email are required on create; default to empty strings if absent
    return prisma.profile.create({
      data: { name: '', email: '', ...data } as Prisma.ProfileCreateInput,
    });
  });
