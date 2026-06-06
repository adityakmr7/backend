// frontend/src/lib/api.ts
// Thin browser-side client for the JobPilot backend (Bun + Elysia).
// All Phase 0 pages call into this — keep types loose for now.

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface JobListItem {
  id: string;
  title: string;
  company: string;
  companySlug: string | null;
  ycBatch: string | null;
  location: string | null;
  isRemote: boolean;
  tags: string[];
  status: string;
  relevanceScore: number | null;
  source: string;
  salary: string | null;
  equity: string | null;
  role: string | null;
  yearsExp: string | null;
  postedAt: string | null;
  scrapedAt: string;
}

export interface YCFounder {
  id?: number;
  name: string;
  title?: string;
  bio?: string;
  linkedin?: string;
  x?: string;
}

export interface JobDetail extends JobListItem {
  description: string;
  applyUrl: string;
  applyMethod: string;
  applyEmail: string | null;
  visa: string | null;
  jobType: string | null;
  notes: string | null;
  metadata: {
    short_description?: string;
    long_description?: string;
    industry?: string;
    subindustry?: string;
    stage?: string;
    team_size?: string;
    year_founded?: string;
    website?: string;
    company_linkedin?: string;
    company_x?: string;
    company_github?: string;
    company_location?: string;
    company_tags?: string[];
    founders?: YCFounder[];
  } | null;
}

export interface JobsResponse {
  total: number;
  jobs: JobListItem[];
}

export interface JobStats {
  total: number;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
  byApplyMethod?: Record<string, number>;
}

export interface ResumeSummary {
  id: string;
  name: string;
  filePath: string;
  tags: string[];
  isDefault: boolean;
  uploadedAt: string;
  updatedAt: string;
}

export interface Resume extends ResumeSummary {
  textContent: string;
}

export interface ResumeAnalysis {
  overallScore: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  detectedSkills: string[];
  detectedRoles: string[];
  yearsOfExperience: number | null;
  seniority: 'junior' | 'mid' | 'senior' | 'staff' | 'unknown';
}

export interface PdfUploadResult {
  suggestedName: string;
  markdown: string;
  rawTextLength: number;
}

export interface TailorResult {
  markdown: string;
  changeNotes: string[];
  basedOn: {
    resumeId: string;
    jobId: string | null;
    jobTitle?: string;
    company?: string;
  };
}

// ── AI: cover letter + resume scoring ─────────────────────────────────────
export interface CoverLetterResult {
  coverLetter: string;
  wordCount: number;
  jobTitle: string;
  company: string;
}

export interface ResumeScoreEntry {
  resumeId: string;
  resumeName: string;
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
  strengthAreas: string[];
  improvements: string[];
  recommendation: 'strong_match' | 'good_match' | 'weak_match';
}

export interface ResumeScoreResult {
  scores: ResumeScoreEntry[];
  bestResumeId: string;
}

// ── Apply ──────────────────────────────────────────────────────────────────
export type ApplyMode = 'record' | 'email' | 'external' | 'full-auto';

export interface ApplySubmitBody {
  resumeId?: string;
  coverLetter?: string;
  mode?: ApplyMode;
  applyEmail?: string;
}

export interface ApplyOk {
  applicationId: string;
  status: 'recorded' | 'submitted_email';
  company: string;
  title: string;
  submittedAt: string;
  email: { messageId?: string; error?: string };
  message: string;
}

export interface ApplyConflict {
  error: { code: 'ALREADY_APPLIED'; message: string; applicationId: string };
}

export type ApplyResult = ApplyOk | ApplyConflict;
export function isApplyConflict(r: ApplyResult): r is ApplyConflict {
  return 'error' in r && r.error?.code === 'ALREADY_APPLIED';
}

export interface ProfileExperience {
  title: string;
  company: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  description?: string;
  location?: string;
}

export interface ProfileEducation {
  degree: string;
  field?: string;
  institution: string;
  graduationYear?: string;
  gpa?: string;
}

export interface Profile {
  id?: string;
  name: string;
  email: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  targetRoles?: string[];
  targetLocations?: string[];
  preferredSalaryMin?: number;
  // structured autofill fields (used by the browser extension)
  firstName?: string;
  lastName?: string;
  phone?: string;
  city?: string;
  state?: string;
  country?: string;
  zip?: string;
  experience?: ProfileExperience[];
  education?: ProfileEducation[];
}

export interface SettingsInfo {
  hasGeminiKey: boolean;
  geminiKeyHint: string | null;
  updatedAt: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  createdAt: string;
}

// ── Applications (tracker) ────────────────────────────────────────────────
export const APPLICATION_STAGES = [
  'applied', 'phone_screen', 'technical', 'offer', 'rejected', 'ghosted',
] as const;
export type ApplicationStage = (typeof APPLICATION_STAGES)[number];

export interface ApplicationJob {
  title: string;
  company: string;
  ycBatch: string | null;
  applyUrl: string;
  applyEmail: string | null;
}

export interface Application {
  id: string;
  jobId: string;
  resumeId: string | null;
  coverLetter: string | null;
  stage: ApplicationStage;
  submittedAt: string;
  interviewDate: string | null;
  followUpSentAt: string | null;
  notes: string | null;
  updatedAt: string;
  job: ApplicationJob;
  resume: { name: string } | null;
}

export type GroupedApplications = Record<ApplicationStage, Application[]>;

async function request<T>(path: string, init?: RequestInit & { allow?: number[] }): Promise<T> {
  const { allow, ...rest } = init ?? {};
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(rest.headers ?? {}) },
  });
  if (!res.ok && !allow?.includes(res.status)) {
    if (res.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('jp:unauthorized'));
    }
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  jobs: {
    list: (params: Record<string, string | number | boolean> = {}) => {
      const q = new URLSearchParams(
        Object.entries(params).map(([k, v]) => [k, String(v)])
      ).toString();
      return request<JobsResponse>(`/api/jobs${q ? `?${q}` : ''}`);
    },
    stats: () => request<JobStats>('/api/jobs/stats'),
    detail: (id: string) => request<JobDetail>(`/api/jobs/${id}`),
    scrape: (body: {
      sources?: string[];
      maxJobs?: number;
      fetchDetail?: boolean;
      useResumeScoring?: boolean;
      filters?: Record<string, string>;
    } = {}) =>
      request<{ status: string; saved: number; skipped: number; message: string }>(
        '/api/jobs/scrape',
        { method: 'POST', body: JSON.stringify(body) }
      ),
    updateStatus: (id: string, status: string) =>
      request<JobListItem>(`/api/jobs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
  },
  applications: {
    list: () => request<GroupedApplications>('/api/applications'),
    detail: (id: string) => request<Application>(`/api/applications/${id}`),
    patch: (id: string, data: { stage?: ApplicationStage; notes?: string | null; interviewDate?: string | null }) =>
      request<Application>(`/api/applications/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ ok: true }>(`/api/applications/${id}`, { method: 'DELETE' }),
  },
  followUp: {
    send: (applicationId: string, applyEmail?: string) =>
      request<{ sent: true; messageId: string; to: string }>(
        `/api/apply/${applicationId}/follow-up`,
        {
          method: 'POST',
          body: JSON.stringify(applyEmail ? { applyEmail } : {}),
        },
      ),
  },
  ai: {
    coverLetter: (body: { jobId: string; resumeId?: string; tone?: string }) =>
      request<CoverLetterResult>('/api/ai/cover-letter', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    scoreResume: (jobId: string) =>
      request<ResumeScoreResult>('/api/ai/score-resume', {
        method: 'POST',
        body: JSON.stringify({ jobId }),
      }),
  },
  apply: {
    submit: (jobId: string, body: ApplySubmitBody) =>
      request<ApplyResult>(`/api/apply/${jobId}`, {
        method: 'POST',
        body: JSON.stringify(body),
        allow: [409],
      }),
    mailerVerify: () =>
      request<{ ok: boolean; error?: string }>('/api/apply/mailer/verify'),
  },
  profile: {
    get: () => request<Profile>('/api/profile'),
    save: (body: Profile) =>
      request<Profile>('/api/profile', { method: 'PUT', body: JSON.stringify(body) }),
  },
  settings: {
    get: () => request<SettingsInfo>('/api/settings'),
    save: (geminiApiKey: string | null) =>
      request<SettingsInfo>('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ geminiApiKey }),
      }),
  },
  resumes: {
    list: () => request<ResumeSummary[]>('/api/resumes'),
    detail: (id: string) => request<Resume>(`/api/resumes/${id}`),
    create: (body: { name: string; content: string; tags?: string[]; isDefault?: boolean }) =>
      request<{ id: string; name: string; isDefault: boolean }>('/api/resumes', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (id: string, body: { name?: string; content?: string; tags?: string[] }) =>
      request<Resume>(`/api/resumes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    setDefault: (id: string) =>
      request<Resume>(`/api/resumes/${id}/default`, { method: 'PATCH' }),
    delete: (id: string) =>
      request<{ message: string }>(`/api/resumes/${id}`, { method: 'DELETE' }),
    analyze: (id: string) =>
      request<ResumeAnalysis>(`/api/resumes/${id}/analyze`, { method: 'POST' }),
    tailor: (
      id: string,
      body: { jobId?: string; jobDescription?: string; jobTitle?: string; company?: string }
    ) =>
      request<TailorResult>(`/api/resumes/${id}/tailor`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    uploadPdf: async (file: File): Promise<PdfUploadResult> => {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API_BASE}/api/resumes/upload-pdf`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      if (!res.ok) {
        if (res.status === 401 && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('jp:unauthorized'));
        }
        const body = await res.text().catch(() => '');
        throw new Error(`Upload failed (${res.status}): ${body || res.statusText}`);
      }
      return res.json() as Promise<PdfUploadResult>;
    },
    downloadUrl: (id: string) => `${API_BASE}/api/resumes/${id}/download`,
  },
  auth: {
    me: () => request<{ user: AuthUser | null }>('/api/auth/me'),
    bootstrapStatus: () => request<{ hasUsers: boolean }>('/api/auth/bootstrap-status'),
    login: (body: { email: string; password: string }) =>
      request<{ user: AuthUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    signup: (body: { email: string; password: string }) =>
      request<{ user: AuthUser }>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    logout: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
  },
};
