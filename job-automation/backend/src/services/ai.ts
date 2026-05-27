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

// ---------------------------------------------------------------------------
// 4. Clean raw resume text (from PDF extraction) into well-structured markdown
// ---------------------------------------------------------------------------
export async function cleanResumeToMarkdown(rawText: string): Promise<string> {
  const prompt = `
You are converting a resume extracted from a PDF into clean, well-structured Markdown.

**RAW PDF TEXT (line breaks may be wonky, columns may be merged):**
${rawText}

**INSTRUCTIONS:**
- Output ONLY valid GitHub-flavored Markdown (no code fences, no preamble, no comments).
- Top of file:
    # <Candidate Name>
    <one-line title> · <city> · <email> · <phone> · [LinkedIn](url) · [GitHub](url)
- Use \`## Summary\`, \`## Experience\`, \`## Projects\`, \`## Skills\`, \`## Education\` as section headers.
- For each role under Experience, use the format:
    ### <Title> — <Company>
    <Location> · <Start> – <End>
    - bullet
    - bullet
- Preserve every bullet from the source. Do NOT invent content, do NOT drop content, do NOT reword for "impact".
- Skills section: group as \`**Languages:**\`, \`**Frameworks:**\`, \`**Tools:**\`, \`**Cloud:**\` if those groupings are inferable, else a single bullet list.
- Fix obvious extraction issues: merged words, smart-quote characters, bullet glyphs, page numbers, header/footer noise.
- Drop the literal strings "Page X of Y" and any orphan page numbers.
`.trim();

  const result = await proModel.generateContent(prompt);
  let md = result.response.text().trim();
  // Strip accidental triple-backtick wrapping
  md = md.replace(/^```(?:markdown|md)?\n?/i, '').replace(/\n?```$/, '').trim();
  if (md.length < 100) throw new Error('AI resume cleanup produced suspiciously short output');
  return md;
}

// ---------------------------------------------------------------------------
// 5. Analyze a resume — structured feedback
// ---------------------------------------------------------------------------
export interface ResumeAnalysis {
  overallScore: number;          // 0-100
  summary: string;               // 1-2 sentences
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];         // concrete, actionable
  detectedSkills: string[];
  detectedRoles: string[];       // e.g. "Backend Engineer", "Full Stack"
  yearsOfExperience: number | null;
  seniority: 'junior' | 'mid' | 'senior' | 'staff' | 'unknown';
}

export async function analyzeResume(resumeMarkdown: string): Promise<ResumeAnalysis> {
  const prompt = `
Analyze this resume and return structured JSON only.

**RESUME:**
${resumeMarkdown}

Return ONLY valid JSON with exactly this shape (no markdown fence, no commentary):
{
  "overallScore": <0-100 integer; how strong is this resume for senior IC roles at startups>,
  "summary": "<1-2 sentence executive summary of the candidate>",
  "strengths": ["<concrete strength>", ...],
  "weaknesses": ["<concrete gap or weakness>", ...],
  "suggestions": ["<actionable rewrite/addition the candidate should make>", ...],
  "detectedSkills": ["<skill>", ...],
  "detectedRoles": ["<role title the candidate is a fit for>", ...],
  "yearsOfExperience": <integer or null>,
  "seniority": "junior" | "mid" | "senior" | "staff" | "unknown"
}

Be specific. "Add metrics" is too vague — say "Quantify the 'led migration' bullet under Stripe with throughput delta."
`.trim();

  const result = await proModel.generateContent(prompt);
  const text = result.response.text().trim()
    .replace(/^```(?:json)?\n?/, '')
    .replace(/\n?```$/, '');
  return JSON.parse(text) as ResumeAnalysis;
}

// ---------------------------------------------------------------------------
// 6. Tailor an existing resume for a specific job description
// ---------------------------------------------------------------------------
export interface TailoredResume {
  markdown: string;       // the rewritten resume in markdown
  changeNotes: string[];  // bullet list of what changed and why
}

export async function tailorResumeForJob(
  resumeMarkdown: string,
  jobDescription: string,
  jobTitle?: string,
  company?: string
): Promise<TailoredResume> {
  const prompt = `
You are tailoring a candidate's resume for a specific job. Return ONLY valid JSON.

**ORIGINAL RESUME (markdown):**
${resumeMarkdown}

**JOB DESCRIPTION:**
${jobTitle ? `Title: ${jobTitle}\n` : ''}${company ? `Company: ${company}\n` : ''}${jobDescription}

**TAILORING RULES:**
- Reorder Skills and Experience bullets to surface what matches the JD first.
- Rewrite bullet phrasing to use vocabulary from the JD when the candidate's underlying work supports it.
- **Never invent experience, employers, projects, dates, or metrics.** If the resume doesn't contain it, do NOT add it.
- Tighten or drop bullets that are clearly irrelevant to this role (e.g. drop iOS bullets for a backend role) — but keep at least 2 bullets per role.
- Preserve the original section structure (Summary / Experience / Projects / Skills / Education).
- Output must remain valid GitHub-flavored markdown.

Return ONLY this JSON shape (no fence, no commentary):
{
  "markdown": "<the full tailored resume as one markdown string>",
  "changeNotes": ["<change 1: what + why>", "<change 2>", ...]
}
`.trim();

  const result = await proModel.generateContent(prompt);
  const text = result.response.text().trim()
    .replace(/^```(?:json)?\n?/, '')
    .replace(/\n?```$/, '');
  const parsed = JSON.parse(text) as TailoredResume;
  if (!parsed.markdown || parsed.markdown.length < 100) {
    throw new Error('Tailored resume came back empty or truncated');
  }
  return parsed;
}
