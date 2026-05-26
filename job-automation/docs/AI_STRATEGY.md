# 🤖 AI Strategy — Cover Letters & Resume Tailoring

## Overview

The AI layer is the secret weapon of this app. Instead of sending generic applications, every submission is personalized using Gemini (or GPT-4o as fallback).

---

## 1. Cover Letter Generation

### Prompt Architecture

```typescript
// backend/src/services/ai.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function generateCoverLetter(
  jobDescription: string,
  resume: string,
  companyContext: string,
  preferences: CoverLetterPreferences
): Promise<string> {

  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

  const prompt = `
You are an expert job application writer. Generate a compelling cover letter.

**CANDIDATE RESUME:**
${resume}

**JOB DESCRIPTION:**
${jobDescription}

**COMPANY CONTEXT:**
${companyContext}

**INSTRUCTIONS:**
- Tone: ${preferences.tone} (formal/conversational/startup-friendly)
- Length: 3 paragraphs, max 300 words
- Structure:
  1. Hook: Start with something specific about the company (not "I am excited to apply")
  2. Value: 2-3 specific accomplishments that match their requirements (use metrics)
  3. Closing: Why this specific company, not just any startup
- DO NOT use generic phrases like "I am a passionate developer"
- DO reference specific technologies/challenges mentioned in the JD
- Sound like a real human, not a ChatGPT output

**OUTPUT FORMAT:**
Return ONLY the cover letter text, no subject line or salutation.
`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}
```

### Tone Options
- **startup-friendly** (default for YC): Direct, energetic, shows builder mentality
- **conversational**: Warm, personable — good for smaller teams
- **formal**: Professional — for more traditional companies

---

## 2. Resume Scoring Against JD

```typescript
export async function scoreResumeForJob(
  resumeText: string,
  jobDescription: string
): Promise<ResumeScore> {

  const prompt = `
Analyze how well this resume matches the job description.

**RESUME:**
${resumeText}

**JOB DESCRIPTION:**
${jobDescription}

Return a JSON object with:
{
  "score": 0-100,
  "matchedSkills": ["skill1", "skill2"],
  "missingSkills": ["skill3", "skill4"],
  "strengthAreas": ["area1"],
  "improvements": ["suggestion1", "suggestion2"],
  "recommendation": "strong_match" | "good_match" | "weak_match"
}
`;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text());
}
```

---

## 3. Company Research Summarizer

Before applying, gather context on the company to personalize the application:

```typescript
export async function summarizeCompany(
  companyName: string,
  ycBatch: string,
  website: string
): Promise<CompanySummary> {

  // First, fetch their website and YC profile
  const [websiteText, ycProfile] = await Promise.all([
    fetchWebsiteText(website),
    fetchYCProfile(companyName, ycBatch),
  ]);

  const prompt = `
Summarize this company for a job applicant in 5 bullet points:
- What they build (1 sentence, very specific)
- Their core technical challenge
- Their growth stage and traction signals
- Company culture signals
- Why a top engineer would want to join

**YC Profile:**
${ycProfile}

**Website Content:**
${websiteText.slice(0, 3000)}

Return JSON: { bullets: string[], techStack: string[], teamSize: string }
`;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text());
}
```

---

## 4. Application Email Generator

For jobs that require email applications:

```typescript
export async function generateApplicationEmail(
  job: ScrapedJob,
  coverLetter: string,
  yourName: string
): Promise<EmailDraft> {

  const prompt = `
Write a professional application email.

**JOB TITLE:** ${job.title}
**COMPANY:** ${job.company}
**COVER LETTER CONTENT:** ${coverLetter}
**YOUR NAME:** ${yourName}

Requirements:
- Subject line: Direct, specific — e.g., "Application: Senior Engineer @ [Company] — [Your Name]"
- Body: 2-3 lines max intro, then paste cover letter
- Sign-off: Professional but warm

Return JSON: { subject: string, body: string }
`;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text());
}
```

---

## 5. AI-Powered Job Relevance Filter

Before showing jobs in your dashboard, score them for relevance to avoid wasting time:

```typescript
export async function filterRelevantJobs(
  jobs: ScrapedJob[],
  userProfile: UserProfile
): Promise<ScoredJob[]> {
  
  // Batch score all jobs in parallel (Gemini supports this)
  const scoringPromises = jobs.map(async (job) => {
    const score = await scoreJobRelevance(job, userProfile);
    return { ...job, relevanceScore: score };
  });

  const scored = await Promise.all(scoringPromises);
  
  // Only show jobs with relevance > 60
  return scored
    .filter(j => j.relevanceScore > 60)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}
```

---

## 6. Model Selection

| Task | Model | Why |
|------|-------|-----|
| Cover letter generation | `gemini-1.5-pro` | Best writing quality |
| Resume scoring | `gemini-1.5-flash` | Fast, cheap, structured output |
| Company research | `gemini-1.5-flash` | Quick summaries |
| Job relevance filter | `gemini-1.5-flash` | High volume, needs to be fast |

### Cost Estimation (Gemini Pricing)
- Flash: ~$0.075 per 1M input tokens
- If applying to 50 jobs/day: ~$0.10–0.20/day total
- **Very affordable** for personal use

---

## 7. Prompt Templates Storage

Store and version your prompts as files — easier to iterate:

```
backend/src/prompts/
├── cover-letter.md
├── resume-score.md
├── company-summary.md
├── email-draft.md
└── job-relevance.md
```

This makes A/B testing prompt changes easy without touching code.

---

## 8. Quality Control

Before sending any AI-generated content:

```typescript
// Always run these checks before submission
function validateCoverLetter(text: string): ValidationResult {
  const checks = [
    { check: text.length > 100, error: 'Too short' },
    { check: text.length < 600, error: 'Too long' },
    { check: !text.includes('I am excited to apply'), error: 'Generic phrase detected' },
    { check: !text.includes('ChatGPT'), error: 'AI disclosure detected' },
    { check: !text.includes('[Company]'), error: 'Unfilled template variable' },
  ];
  
  const failures = checks.filter(c => !c.check);
  return { valid: failures.length === 0, errors: failures.map(f => f.error) };
}
```
