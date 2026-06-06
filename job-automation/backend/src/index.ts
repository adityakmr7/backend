// backend/src/index.ts
import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { jobsRoutes } from './routes/jobs';
import { aiRoutes } from './routes/ai';
import { applyRoutes } from './routes/apply';
import { trackerRoutes } from './routes/tracker';
import { resumeRoutes } from './routes/resumes';
import { profileRoutes } from './routes/profile';
import { settingsRoutes } from './routes/settings';
import { authRoutes } from './routes/auth';
import { jwtPlugin, requireAuth } from './lib/auth';
import { startCronJobs } from './services/cron';

const app = new Elysia()
  .use(cors({
    origin: (request) => {
      const origin = request.headers.get('origin') ?? '';
      // Allow the website + any chrome extension page (side panel / SW).
      if (origin === (process.env.FRONTEND_URL ?? 'http://localhost:3000')) return true;
      if (origin.startsWith('chrome-extension://')) return true;
      return false;
    },
    credentials: true,
  }))
  .use(swagger({
    path: '/docs',
    documentation: {
      info: {
        title: 'JobPilot API',
        version: '0.1.0',
        description: 'Automated job application engine for YC companies',
      },
    },
  }))
  // Public health check
  .get('/health', () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  }))
  // Public auth routes (signup / login / me / bootstrap)
  .use(authRoutes)
  // Everything below requires a valid session cookie.
  .use(jwtPlugin)
  .guard({ beforeHandle: requireAuth }, (app) =>
    app
      .use(jobsRoutes)
      .use(aiRoutes)
      .use(applyRoutes)
      .use(trackerRoutes)
      .use(resumeRoutes)
      .use(profileRoutes)
      .use(settingsRoutes)
  )
  .listen(process.env.PORT ?? 3001);

console.log(`🚀 JobPilot API running at http://localhost:${app.server?.port}`);
console.log(`📖 API Docs:           http://localhost:${app.server?.port}/docs`);
console.log(`❤️  Health check:       http://localhost:${app.server?.port}/health`);
console.log(`🔐 Auth:               POST /api/auth/signup · /login · /logout · GET /me`);

if (process.env.DISABLE_CRON !== 'true') {
  startCronJobs();
}
