// frontend/src/lib/api.ts
// Thin browser-side client for the JobPilot backend (Bun + Elysia).
// All Phase 0 pages call into this — keep types loose for now.

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface JobListItem {
  id: string;
  title: string;
  company: string;
  ycBatch: string | null;
  location: string | null;
  isRemote: boolean;
  tags: string[];
  status: string;
  relevanceScore: number | null;
  source: string;
  postedAt: string | null;
  scrapedAt: string;
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
    detail: (id: string) => request<JobListItem & { description: string; applyUrl: string }>(
      `/api/jobs/${id}`
    ),
    scrape: (body: { sources?: string[]; maxYCJobs?: number; useResumeScoring?: boolean } = {}) =>
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
  },
};
