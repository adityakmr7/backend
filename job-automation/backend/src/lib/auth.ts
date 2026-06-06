// backend/src/lib/auth.ts
// Shared JWT plugin + requireAuth derive. Mount the plugin once on the root
// app; pass `requireAuth` into `.guard({ beforeHandle: requireAuth })` to
// protect a group of routes.

import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';

export const SESSION_COOKIE = 'jp_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export interface SessionPayload {
  userId: string;
  email: string;
  [key: string]: any;
}

const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 32) {
  // Don't crash in dev with a placeholder secret — but make it loud.
  console.warn(
    '[auth] JWT_SECRET is missing or under 32 chars. Set a long random value in .env before production.'
  );
}

export const jwtPlugin = new Elysia({ name: 'jwt' }).use(
  jwt({
    name: 'jwt',
    secret: SECRET ?? 'dev-only-insecure-secret-please-change-me-now',
    exp: `${SESSION_MAX_AGE_SECONDS}s`,
  })
);

/**
 * Extract a JWT token from either:
 *   1. Authorization: Bearer <token>  header  (Chrome extension uses this)
 *   2. The jp_session cookie           (web app uses this)
 *
 * Returns the raw token string or null.
 */
export function extractToken(
  headers: Record<string, string | undefined>,
  cookie: any,
): string | null {
  const authHeader = headers['authorization'] ?? '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return cookie[SESSION_COOKIE]?.value ?? null;
}

/**
 * Elysia beforeHandle that validates the session cookie OR Bearer token.
 * Use via:
 *
 *   .guard({ beforeHandle: requireAuth }, app => app.use(jobsRoutes)...)
 *
 * Within guarded routes, `derive({ cookie, jwt }, ...)` can re-decode the
 * cookie if a handler needs the userId (cheap: jose verify is in-process).
 */
export async function requireAuth({
  cookie,
  jwt,
  set,
  headers,
}: {
  cookie: any;
  jwt: any;
  set: any;
  headers: Record<string, string | undefined>;
}) {
  const token = extractToken(headers, cookie);
  if (!token) {
    set.status = 401;
    return { error: { code: 'NO_SESSION', message: 'Authentication required' } };
  }
  const payload = await jwt.verify(token);
  if (!payload || !payload.userId) {
    set.status = 401;
    return { error: { code: 'INVALID_SESSION', message: 'Session expired or invalid' } };
  }
  // Falsy return = pass — Elysia continues to the handler.
  return undefined;
}
