import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// --- Models ---
const proModel = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
const flashModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// ---------------------------------------------------------------------------
// 1. Cover Letter Generation
// ---------------------------------------------------------------------------
export async function generateCoverLetter(
  jobDescription: string,
  resumeMarkdown: string,
  companyContext: string,
  tone: string = 'startup-friendly'
): Promise<string> {
  const prompt = `
You are an expert job application writer. Generate a compelling, highly personalized cover letter.

**CANDIDATE RESUME (Markdown):**
${resumeMarkdown}

**JOB DESCRIPTION:**
${jobDescription}

**COMPANY CONTEXT:**
${companyContext}

**INSTRUCTIONS:**
- Tone: ${tone} (startup-friendly = direct, energetic, shows builder mentality)
- Length: 3 tight paragraphs, maximum 280 words total
- Structure:
  1. Hook — Reference something specific about the company or problem they solve (NOT "I am excited to apply")
  2. Value — 2-3 concrete accomplishments from the resume that match requirements. Use real metrics.
  3. Closing — One sentence on why THIS company specifically, not just any startup.
- DO NOT use: "I am passionate", "team player", "quick learner", "I would love to"
- Reference specific technologies and challenges from the JD
- Sound like a thoughtful human, not a template
- If the candidate has relevant open-source or project work, mention it

**OUTPUT:**
Return ONLY the cover letter body text. No subject line, no "Dear Hiring Manager", no signature.
`.trim();

  const result = await proModel.generateContent(prompt);
  const text = result.response.text().trim();

  // Basic quality gate
  if (text.length < 100) throw new Error('AI generated cover letter is too short');
  if (text.includes('[Company]') || text.includes('[Role]'))
    throw new Error('Cover letter contains unfilled template variables');

  return text;
}

// ---------------------------------------------------------------------------
// 2. Resume Scoring
// ---------------------------------------------------------------------------
export interface ResumeScore {
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
  strengthAreas: string[];
  improvements: string[];
  recommendation: 'strong_match' | 'good_match' | 'weak_match';
}

export async function scoreResumeForJob(
  resumeMarkdown: string,
  jobDescription: string
): Promise<ResumeScore> {
  const prompt = `
Analyze how well this resume matches the job description. Be accurate and strict.

**RESUME:**
${resumeMarkdown}

**JOB DESCRIPTION:**
${jobDescription}

Return ONLY valid JSON with this exact structure:
{
  "score": <0-100 integer>,
  "matchedSkills": ["skill1", "skill2"],
  "missingSkills": ["skill3"],
  "strengthAreas": ["area description"],
  "improvements": ["specific suggestion"],
  "recommendation": "strong_match" | "good_match" | "weak_match"
}

Scoring guide:
- 80-100: Strong match — apply immediately
- 60-79: Good match — worth applying with tailored letter
- 0-59: Weak match — skip or upskill first
`.trim();

  const result = await flashModel.generateContent(prompt);
  const text = result.response.text().trim()
    .replace(/^```json\n?/, '')
    .replace(/\n?```$/, '');

  return JSON.parse(text) as ResumeScore;
}

// ---------------------------------------------------------------------------
// 3. Job Relevance Score (for filtering scraped jobs)
// ---------------------------------------------------------------------------
export async function scoreJobRelevance(
  jobTitle: string,
  jobDescription: string,
  resumeMarkdown: string
): Promise<number> {
  const prompt = `
Rate how relevant this job is for this candidate. Return ONLY a single integer 0-100.

Job Title: ${jobTitle}
Job Description (first 1000 chars): ${jobDescription.slice(0, 1000)}

Candidate Resume Summary (first 800 chars): ${resumeMarkdown.slice(0, 800)}

Scoring: 80+ = great fit, 60-79 = decent fit, <60 = poor fit.
Return only the number, nothing else.
`.trim();

  const result = await flashModel.generateContent(prompt);
  const score = parseInt(result.response.text().trim(), 10);
  return isNaN(score) ? 50 : Math.min(100, Math.max(0, score));
}
