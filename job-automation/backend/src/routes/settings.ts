// backend/src/routes/settings.ts
//
// Singleton row in `settings` holding user-managed service credentials.
// Today: just `geminiApiKey`. We never return the key in full — only a
// last-4-char hint, so it can't be exfiltrated by an XSS in /settings.

import { Elysia } from 'elysia';
import { prisma } from '../lib/prisma';

function maskKey(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key.length <= 4) return `…${key}`;
  return `…${key.slice(-4)}`;
}

export const settingsRoutes = new Elysia({ prefix: '/api/settings' })

  .get('/', async () => {
    const row = await prisma.settings.findFirst();
    return {
      hasGeminiKey: Boolean(row?.geminiApiKey),
      geminiKeyHint: maskKey(row?.geminiApiKey),
      updatedAt: row?.updatedAt ?? null,
    };
  })

  .put('/', async ({ body }) => {
    const { geminiApiKey } = (body ?? {}) as { geminiApiKey?: string | null };
    // Empty string / null = clear. Anything truthy = upsert.
    const value = geminiApiKey?.trim() || null;

    const existing = await prisma.settings.findFirst();
    const row = existing
      ? await prisma.settings.update({
          where: { id: existing.id },
          data: { geminiApiKey: value },
        })
      : await prisma.settings.create({
          data: { geminiApiKey: value },
        });

    return {
      hasGeminiKey: Boolean(row.geminiApiKey),
      geminiKeyHint: maskKey(row.geminiApiKey),
      updatedAt: row.updatedAt,
    };
  });
