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
import { startCronJobs } from './services/cron';

const app = new Elysia()
  .use(cors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
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
  // Health check
  .get('/health', () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  }))
  // Mount routes
  .use(jobsRoutes)
  .use(aiRoutes)
  .use(applyRoutes)
  .use(trackerRoutes)
  .use(resumeRoutes)
  .use(profileRoutes)
  .listen(process.env.PORT ?? 3001);

console.log(`🚀 JobPilot API running at http://localhost:${app.server?.port}`);
console.log(`📖 API Docs:           http://localhost:${app.server?.port}/docs`);
console.log(`❤️  Health check:       http://localhost:${app.server?.port}/health`);

if (process.env.DISABLE_CRON !== 'true') {
  startCronJobs();
}
