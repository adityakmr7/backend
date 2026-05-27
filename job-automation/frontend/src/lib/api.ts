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
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
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
    list: () => request<Record<string, unknown[]>>('/api/applications'),
    patch: (id: string, data: { stage?: string; notes?: string; interviewDate?: string }) =>
      request<Record<string, unknown>>(`/api/applications/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },
  profile: {
    get: () => request<Profile>('/api/profile'),
    save: (body: Profile) =>
      request<Profile>('/api/profile', { method: 'PUT', body: JSON.stringify(body) }),
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
        body: form,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Upload failed (${res.status}): ${body || res.statusText}`);
      }
      return res.json() as Promise<PdfUploadResult>;
    },
    downloadUrl: (id: string) => `${API_BASE}/api/resumes/${id}/download`,
  },
};
