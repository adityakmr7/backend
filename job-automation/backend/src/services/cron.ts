import { CronJob } from 'cron';
import { prisma } from '../lib/prisma';
import { scrapeWAASJobs, saveJobs } from './scraper';

async function runFullScrape() {
  const start = Date.now();
  console.log(`[Cron] 🔍 Auto-scrape started at ${new Date().toISOString()}`);

  const defaultResume = await prisma.resume.findFirst({ where: { isDefault: true } });
  const resumeText = defaultResume?.textContent;

  let saved = 0;
  let skipped = 0;

  try {
    const jobs = await scrapeWAASJobs(100, {}, true);
    const r = await saveJobs(jobs, resumeText);
    saved = r.saved; skipped = r.skipped;
  } catch (e) {
    console.error('[Cron] WAAS scrape failed:', (e as Error).message);
  }

  const secs = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[Cron] ✅ Done in ${secs}s — saved: ${saved}, skipped: ${skipped}`);
}

export function startCronJobs() {
  // Every 6 hours, on the 7th minute (avoid the :00 stampede)
  const job = new CronJob('7 */6 * * *', runFullScrape, null, true);
  console.log(`[Cron] Scheduled auto-scrape every 6h. Next run: ${job.nextDate().toISO()}`);
}
