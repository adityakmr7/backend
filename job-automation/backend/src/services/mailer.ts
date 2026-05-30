// backend/src/services/mailer.ts
// Gmail SMTP mailer via Nodemailer.
// Requires GMAIL_USER + GMAIL_APP_PASSWORD in .env
//
// Setup:
//   1. Enable 2FA on your Google account
//   2. Google Account → Security → App Passwords → "JobPilot" → generate
//   3. Set GMAIL_USER and GMAIL_APP_PASSWORD in backend/.env

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

// ---------------------------------------------------------------------------
// Singleton transporter (lazy-initialized)
// ---------------------------------------------------------------------------
let _transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (_transporter) return _transporter;

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error(
      'GMAIL_USER and GMAIL_APP_PASSWORD must be set in backend/.env to send emails. ' +
      'See https://myaccount.google.com/apppasswords to generate an App Password.'
    );
  }

  _transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  return _transporter;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface ApplicationEmailOptions {
  /** Recipient — the employer's hiring email */
  to: string;
  /** Job title for subject line */
  jobTitle: string;
  /** Company name */
  company: string;
  /** Cover letter body (plain text) */
  coverLetter: string;
  /** Optional: path to a .md or .pdf resume attachment on disk */
  resumePath?: string;
  /** Display name to use in From header */
  fromName?: string;
}

export interface SendResult {
  messageId: string;
  accepted: string[];
  preview?: string;  // only set in test mode
}

// ---------------------------------------------------------------------------
// Send application email
// ---------------------------------------------------------------------------
export async function sendApplicationEmail(opts: ApplicationEmailOptions): Promise<SendResult> {
  const transporter = getTransporter();
  const fromUser    = process.env.GMAIL_USER!;
  const fromName    = opts.fromName ?? fromUser.split('@')[0];

  const subject = `Application: ${opts.jobTitle} at ${opts.company}`;

  // Build plain-text body
  const body = [
    `Dear Hiring Team at ${opts.company},`,
    '',
    opts.coverLetter,
    '',
    `Best regards,`,
    fromName,
    fromUser,
  ].join('\n');

  const message: nodemailer.SendMailOptions = {
    from: `"${fromName}" <${fromUser}>`,
    to:   opts.to,
    subject,
    text: body,
    // Duplicate as HTML with minimal formatting
    html: `<pre style="font-family:sans-serif;white-space:pre-wrap;font-size:14px">${body}</pre>`,
  };

  // Attach resume if a path is provided
  if (opts.resumePath) {
    message.attachments = [
      {
        filename: opts.resumePath.split('/').pop() ?? 'resume.md',
        path:     opts.resumePath,
      },
    ];
  }

  const info = await transporter.sendMail(message);

  return {
    messageId: info.messageId as string,
    accepted:  (info.accepted as string[]) ?? [],
  };
}

// ---------------------------------------------------------------------------
// Verify SMTP credentials (used in health check / settings test)
// ---------------------------------------------------------------------------
export async function verifyMailer(): Promise<{ ok: boolean; error?: string }> {
  try {
    const t = getTransporter();
    await t.verify();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Send follow-up email (3-day nudge)
// ---------------------------------------------------------------------------
export async function sendFollowUpEmail(opts: {
  to: string;
  jobTitle: string;
  company: string;
  fromName?: string;
}): Promise<SendResult> {
  const transporter = getTransporter();
  const fromUser    = process.env.GMAIL_USER!;
  const fromName    = opts.fromName ?? fromUser.split('@')[0];

  const subject = `Following up — ${opts.jobTitle} at ${opts.company}`;

  const body = [
    `Dear Hiring Team at ${opts.company},`,
    '',
    `I wanted to follow up on my application for the ${opts.jobTitle} position submitted a few days ago.`,
    `I remain very excited about the opportunity and would love to learn more about next steps.`,
    `Please let me know if you need any additional information.`,
    '',
    `Best regards,`,
    fromName,
    fromUser,
  ].join('\n');

  const info = await transporter.sendMail({
    from:    `"${fromName}" <${fromUser}>`,
    to:      opts.to,
    subject,
    text:    body,
    html:    `<pre style="font-family:sans-serif;white-space:pre-wrap;font-size:14px">${body}</pre>`,
  });

  return {
    messageId: info.messageId as string,
    accepted:  (info.accepted as string[]) ?? [],
  };
}
