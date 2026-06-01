// backend/src/routes/auth.ts
import { Elysia, t } from 'elysia';
import { prisma } from '../lib/prisma';
import {
  jwtPlugin,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  type SessionPayload,
} from '../lib/auth';

const isProd = process.env.NODE_ENV === 'production';

const cookieAttrs = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: isProd,
  path: '/',
  maxAge: SESSION_MAX_AGE_SECONDS,
};

function normalizeEmail(raw: unknown): string {
  return String(raw ?? '').trim().toLowerCase();
}

function assertCredentials(email: string, password: string) {
  if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    throw new Error('Invalid email address');
  }
  if (typeof password !== 'string' || password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
}

export const authRoutes = new Elysia({ prefix: '/api/auth' })
  .use(jwtPlugin)

  // GET /api/auth/bootstrap-status — used by the login page to redirect
  // to /signup on first run.
  .get('/bootstrap-status', async () => {
    const count = await prisma.user.count();
    return { hasUsers: count > 0 };
  })

  // GET /api/auth/me — current user info; 401 if not signed in.
  .get('/me', async ({ cookie, jwt, set }) => {
    const token = cookie[SESSION_COOKIE]?.value;
    if (!token) {
      set.status = 401;
      return { user: null };
    }
    const payload = (await jwt.verify(token)) as SessionPayload | false;
    if (!payload) {
      set.status = 401;
      return { user: null };
    }
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, createdAt: true },
    });
    if (!user) {
      set.status = 401;
      return { user: null };
    }
    return { user };
  })

  // POST /api/auth/signup
  .post('/signup', async ({ body, cookie, jwt, set }) => {
    const email = normalizeEmail((body as { email?: string }).email);
    const password = String((body as { password?: string }).password ?? '');
    assertCredentials(email, password);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      set.status = 409;
      return { error: { code: 'EMAIL_TAKEN', message: 'Email already registered' } };
    }

    const passwordHash = await Bun.password.hash(password);
    const user = await prisma.user.create({
      data: { email, passwordHash },
      select: { id: true, email: true, createdAt: true },
    });

    const token = await jwt.sign({ userId: user.id, email: user.email } as SessionPayload);
    cookie[SESSION_COOKIE].set({ value: token, ...cookieAttrs });

    return { user };
  }, {
    body: t.Object({
      email: t.String(),
      password: t.String({ minLength: 8 }),
    }),
  })

  // POST /api/auth/login
  .post('/login', async ({ body, cookie, jwt, set }) => {
    const email = normalizeEmail((body as { email?: string }).email);
    const password = String((body as { password?: string }).password ?? '');

    const user = await prisma.user.findUnique({ where: { email } });
    // Always run a hash compare even on missing user to avoid leaking
    // existence via timing.
    const dummy = '$argon2id$v=19$m=65536,t=2,p=1$dummy$dummy';
    const ok = user
      ? await Bun.password.verify(password, user.passwordHash)
      : await Bun.password.verify(password, dummy).catch(() => false);

    if (!user || !ok) {
      set.status = 401;
      return { error: { code: 'BAD_CREDENTIALS', message: 'Invalid email or password' } };
    }

    const token = await jwt.sign({ userId: user.id, email: user.email } as SessionPayload);
    cookie[SESSION_COOKIE].set({ value: token, ...cookieAttrs });

    return { user: { id: user.id, email: user.email, createdAt: user.createdAt } };
  }, {
    body: t.Object({
      email: t.String(),
      password: t.String(),
    }),
  })

  // POST /api/auth/logout
  .post('/logout', ({ cookie }) => {
    cookie[SESSION_COOKIE].remove();
    return { ok: true };
  });
