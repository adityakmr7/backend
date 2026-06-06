// backend/src/routes/apply.ts
import { Elysia } from 'elysia';
import { join } from 'node:path';
import { prisma } from '../lib/prisma';
import { sendApplicationEmail, sendFollowUpEmail, verifyMailer } from '../services/mailer';

export const applyRoutes = new Elysia({ prefix: '/api/apply' })

  // ──────────────────────────────────────────────────────────────────────────
  // POST /api/apply/:jobId
  // Body: { resumeId?, coverLetter?, mode?, applyEmail? }
  //
  // mode = 'record'    → just saves to DB (default for external/form apply)
  // mode = 'email'     → saves to DB AND sends email via Gmail SMTP
  // mode = 'full-auto' → placeholder for Playwright queue (Phase 2)
  // ──────────────────────────────────────────────────────────────────────────
  .post('/:jobId', async ({ params, body, set }) => {
    const {
      resumeId,
      coverLetter,
      mode        = 'record',
      applyEmail,          // override recipient email (if job.applyMethod === 'email')
    } = body as {
      resumeId?:    string;
      coverLetter?: string;
      mode?:        'record' | 'email' | 'full-auto' | 'external';
      applyEmail?:  string;
    };

    const job = await prisma.job.findUniqueOrThrow({ where: { id: params.jobId } });

    // Idempotency — block duplicate applications with a structured 409
    const existing = await prisma.application.findFirst({
      where: { jobId: params.jobId },
    });
    if (existing) {
      set.status = 409;
      return {
        error: {
          code:    'ALREADY_APPLIED',
          message: `Already applied to ${job.company} — ${job.title}`,
          applicationId: existing.id,
        },
      };
    }

    // Resolve resume (for email attachment path)
    let resume = null;
    if (resumeId) {
      resume = await prisma.resume.findUnique({ where: { id: resumeId } });
    } else {
      resume = await prisma.resume.findFirst({ where: { isDefault: true } });
    }

    // Create DB application record
    const application = await prisma.application.create({
      data: {
        jobId:       params.jobId,
        resumeId:    resume?.id ?? null,
        coverLetter: coverLetter ?? null,
        stage:       'applied',
      },
    });

    // Update job status
    await prisma.job.update({
      where: { id: params.jobId },
      data:  { status: 'applied' },
    });

    let emailResult: { messageId?: string; error?: string } = {};

    // ── Email send mode ────────────────────────────────────────────────────
    if (mode === 'email') {
      const recipient =
        applyEmail ??
        job.applyEmail ??   // stored on job if apply method is email
        null;

      if (!recipient) {
        emailResult = { error: 'No recipient email — provide applyEmail in the request body.' };
      } else if (!coverLetter?.trim()) {
        emailResult = { error: 'Cover letter is required to send an email application.' };
      } else {
        try {
          // Resolve disk path for resume attachment
          const attachPath = resume?.filePath
            ? join(process.cwd(), resume.filePath)
            : undefined;

          // Load profile for sender name
          const profile = await prisma.profile.findFirst();

          const result = await sendApplicationEmail({
            to:          recipient,
            jobTitle:    job.title,
            company:     job.company,
            coverLetter: coverLetter,
            resumePath:  attachPath,
            fromName:    profile?.name,
          });

          emailResult = { messageId: result.messageId };

          // Record that email was sent
          await prisma.application.update({
            where: { id: application.id },
            data:  { followUpSentAt: null }, // followUp clock starts now
          });
        } catch (e) {
          emailResult = { error: (e as Error).message };
        }
      }
    }

    // ── Placeholder for Playwright auto-apply (Phase 2) ───────────────────
    // if (mode === 'full-auto') { await queue.add('apply', { jobId, applicationId }) }

    return {
      applicationId: application.id,
      status:        mode === 'email' && !emailResult.error ? 'submitted_email' : 'recorded',
      company:       job.company,
      title:         job.title,
      submittedAt:   application.submittedAt,
      email:         emailResult,
      message:
        mode === 'email' && !emailResult.error
          ? `✓ Email sent to ${applyEmail ?? job.applyEmail} and application recorded.`
          : mode === 'email' && emailResult.error
          ? `⚠ Application recorded, but email failed: ${emailResult.error}`
          : 'Application recorded. Click Apply URL to submit manually.',
    };
  })

  // ──────────────────────────────────────────────────────────────────────────
  // POST /api/apply/:jobId/follow-up — send 3-day follow-up email
  // (param is named :jobId here only to satisfy Elysia's trie — it's actually
  //  the application id passed by the caller)
  // ──────────────────────────────────────────────────────────────────────────
  .post('/:jobId/follow-up', async ({ params, body }) => {
    const applicationId = params.jobId;
    const { applyEmail } = body as { applyEmail?: string };

    const application = await prisma.application.findUniqueOrThrow({
      where:   { id: applicationId },
      include: { job: true },
    });

    const recipient = applyEmail ?? application.job?.applyEmail;
    if (!recipient) throw new Error('No recipient email for follow-up.');

    const profile = await prisma.profile.findFirst();

    const result = await sendFollowUpEmail({
      to:       recipient,
      jobTitle: application.job?.title ?? application.externalTitle ?? 'Unknown Role',
      company:  application.job?.company ?? application.externalCompany ?? 'Unknown Company',
      fromName: profile?.name,
    });

    await prisma.application.update({
      where: { id: applicationId },
      data:  { followUpSentAt: new Date() },
    });

    return { sent: true, messageId: result.messageId, to: recipient };
  })

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/apply/queue — queue health (stub for Phase 2 BullMQ)
  // ──────────────────────────────────────────────────────────────────────────
  .get('/queue', async () => {
    const [total, applied] = await Promise.all([
      prisma.application.count(),
      prisma.application.count({ where: { stage: 'applied' } }),
    ]);
    return {
      pending:    0,
      processing: 0,
      completed:  applied,
      total,
      failed:     0,
      message:    'BullMQ queue integration planned for Phase 2.',
    };
  })

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/apply/mailer/verify — check Gmail SMTP credentials
  // ──────────────────────────────────────────────────────────────────────────
  .get('/mailer/verify', async () => {
    const result = await verifyMailer();
    return result;
  });
