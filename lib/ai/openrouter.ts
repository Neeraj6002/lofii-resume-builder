// lib/ai/openrouter.ts
// ============================================================
// OPENROUTER AI CLIENT — StepFun Reasoning Model Compatible
// WITH FIXES: generateFreePreview error handling + fallback
//
// FIXES in this version:
//  1. Force strict JSON output  — two-message (system+user) prompt
//  2. Reduce response size      — compact schema, capped lengths
//  3. Extract JSON safely       — hardened extractLastJsonBlock()
//  4. Fallback parsing chain    — 5-stage pipeline
//  5. MEMORY FIX                — removed JSON.stringify, capped sizes
//  6. FREE PREVIEW FIX          — comprehensive logging + fallback generation
//  7. TRUNCATION HANDLING       — graceful fallback on finish_reason='length'
// ============================================================

import type { ReviewSection, ReviewIssue } from "@/types";

// ─── Types ────────────────────────────────────────────────────
export interface ReviewResult {
  overallScore: number;
  sections:     ReviewSection[];
  topFixes:     ReviewIssue[];
}

// ─── Config ───────────────────────────────────────────────────
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL              = "stepfun/step-3.5-flash:free";

// Max chars we store from any single AI text field — prevents multi-MB strings
const MAX_SOURCE_CHARS = 14_000;

// ─── Prompt ───────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a strict ATS resume scoring engine calibrated against real ATS systems (Taleo, Workday, Greenhouse, iCIMS).
Your ENTIRE response must be a single raw JSON object — no markdown, no prose, no code fences.
Do NOT write anything before or after the JSON. Output only the JSON object.`;

function buildUserPrompt(resumeText: string): string {
  return `Score this resume strictly against real ATS standards. Return ONLY the JSON below — no other text.

## SCORING RULES (read carefully before scoring)

### Category weights (these determine overallScore):
| category            | weight | what to measure |
|---------------------|--------|-----------------|
| keywords            | 25%    | Job-specific tech terms, role titles, tools present AND naturally placed in Experience/Summary — not just listed in Skills. NO job description provided = cap score at 55 max. |
| ats_compatibility   | 20%    | Parseable structure: standard section headers, no tables/columns/images, consistent date format, contact info at top. |
| quantified_impact   | 15%    | % of bullets with a number/metric. 0 bullets = 0-20. Some = 30-55. Most = 60-80. All strong = 81-100. |
| skills              | 15%    | Hard skills relevant to the apparent target role, properly categorised. |
| action_verbs        | 10%    | % of bullets starting with a strong past-tense verb. Weak openers (Helped, I did, Worked on) = critical penalty. |
| formatting          | 8%     | Consistent punctuation, dates, capitalisation, spacing, bullet style. |
| summary             | 4%     | Tailored, concise, mentions target role and a key achievement. Generic or missing = 40 max. |
| length              | 3%     | 1 page for under 3 yrs exp. 2 pages for 3-8 yrs. Penalise if bloated or too sparse. |

### Score anchors — BE STRICT, do not give benefit of the doubt:
- 0-20  : Critical failure (section missing, completely unparseable)
- 21-40 : Poor (major issues, most ATS would reject or rank last)
- 41-55 : Below average (several problems, needs significant work)
- 56-69 : Average (passes basic ATS but mid-rank; most resumes land here)
- 70-79 : Good (minor issues only; would rank well in most ATS)
- 80-89 : Strong (nearly optimised; recruiter would likely see it)
- 90-100: Excellent (rare; fully optimised with metrics, keywords, clean format)

### overallScore calculation:
Weighted average of section scores using the weights above. Round to nearest integer.
Do NOT inflate. A typical resume scores 45-65. A score above 75 requires: strong keyword integration, metrics on most bullets, AND clean formatting — all three, not one or two.

### JSON schema to return:
{
  "overallScore": <integer 0-100>,
  "sections": [
    {
      "category": "<ats_compatibility|keywords|quantified_impact|summary|formatting|length|action_verbs|skills>",
      "label": "<descriptive label, max 40 chars>",
      "score": <integer 0-100>,
      "issues": [{ "severity": "<critical|warning|suggestion>", "message": "<max 120 chars>", "fix": "<max 120 chars>" }],
      "isPremium": false
    }
  ],
  "topFixes": [{ "severity": "<critical|warning|suggestion>", "message": "<max 120 chars>", "fix": "<max 120 chars>" }]
}

Rules: exactly 8 sections (one per category), 3-5 topFixes ordered critical first.

RESUME:
${resumeText.slice(0, 6000)}`;
}

// ─── JSON extraction helpers ──────────────────────────────────

/**
 * Hardened brace-balanced scanner.
 * - Handles \\uXXXX unicode escape sequences.
 * - Tracks inString correctly across multi-line strings.
 * - Returns LAST complete block (reasoning models write JSON at end).
 * - Falls back to attempting repair on an unclosed trailing block.
 */
function extractLastJsonBlock(text: string): string | null {
  let lastBlock: string | null = null;
  let i = 0;

  while (i < text.length) {
    const start = text.indexOf("{", i);
    if (start === -1) break;

    let depth    = 0;
    let inString = false;
    let j        = start;
    let closed   = false;

    while (j < text.length) {
      const ch = text[j];

      if (inString) {
        if (ch === "\\") {
          if (text[j + 1] === "u") {
            j += 5;
          } else {
            j += 2;
          }
          continue;
        }
        if (ch === '"') inString = false;
        j++;
        continue;
      }

      if (ch === '"') { inString = true; j++; continue; }
      if (ch === "{") { depth++; j++; continue; }
      if (ch === "}") {
        depth--;
        if (depth === 0) { closed = true; break; }
        j++;
        continue;
      }
      j++;
    }

    if (closed) {
      lastBlock = text.slice(start, j + 1);
      i = j + 1;
    } else {
      const candidate = repairTruncatedJson(text.slice(start));
      try { JSON.parse(candidate); lastBlock = candidate; } catch { /* skip */ }
      break;
    }
  }

  return lastBlock;
}

/** Strip markdown code fences the model sometimes wraps JSON in. */
function stripFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/\s*```\s*$/m, "")
    .trim();
}

/**
 * Close unclosed braces/brackets left by token-limit truncation.
 * Handles nested structures and removes trailing commas.
 */
function repairTruncatedJson(raw: string): string {
  let s        = raw.trimEnd().replace(/,\s*$/, "");
  const opens: string[] = [];
  let inString = false;

  let k = 0;
  while (k < s.length) {
    const ch = s[k];
    if (inString) {
      if (ch === "\\") { k += 2; continue; }
      if (ch === '"')  inString = false;
      k++;
      continue;
    }
    if (ch === '"')                    { inString = true; }
    else if (ch === "{" || ch === "[") opens.push(ch);
    else if (ch === "}" || ch === "]") opens.pop();
    k++;
  }

  if (inString) s += '"';
  for (let n = opens.length - 1; n >= 0; n--) {
    s += opens[n] === "{" ? "}" : "]";
  }
  return s;
}

/**
 * 5-stage fallback parsing pipeline.
 */
function extractAndParse(text: string): ReviewResult {
  try { return JSON.parse(text) as ReviewResult; } catch { /* next */ }

  const stripped = stripFences(text);
  try { return JSON.parse(stripped) as ReviewResult; } catch { /* next */ }

  const lastBlock = extractLastJsonBlock(text);
  if (lastBlock) {
    try { return JSON.parse(lastBlock) as ReviewResult; } catch { /* next */ }

    try {
      return JSON.parse(repairTruncatedJson(lastBlock)) as ReviewResult;
    } catch { /* next */ }
  }

  const searchText  = text.slice(0, 20_000);
  const jsonPattern = /\{[^{}]{0,8000}"overallScore"[\s\S]{0,8000}\}/g;
  const candidates  = [...searchText.matchAll(jsonPattern)]
    .map(m => m[0])
    .sort((a, b) => b.length - a.length);

  for (const candidate of candidates) {
    try { return JSON.parse(candidate) as ReviewResult; } catch { /* next */ }
    try { return JSON.parse(repairTruncatedJson(candidate)) as ReviewResult; } catch { /* next */ }
  }

  console.error("[OpenRouter] All 5 parse stages failed.", {
    textLength: text.length,
    tail: text.slice(-600),
  });
  throw new Error("AI_PARSE_ERROR");
}

// ─── Validation ───────────────────────────────────────────────

const VALID_CATEGORIES = new Set([
  "ats_compatibility", "keywords", "quantified_impact",
  "summary", "formatting", "length", "action_verbs", "skills",
]);
const VALID_SEVERITIES = new Set(["critical", "warning", "suggestion"]);

function validateResult(raw: unknown): ReviewResult {
  const r = raw as ReviewResult;

  if (typeof r?.overallScore !== "number") throw new Error("Missing overallScore");
  if (!Array.isArray(r.sections) || r.sections.length === 0) throw new Error("Missing sections");

  r.overallScore = Math.min(100, Math.max(0, Math.round(r.overallScore)));

  r.sections = r.sections
    .filter(s => s && typeof s === "object")
    .map(s => ({
      category:  VALID_CATEGORIES.has(s.category) ? s.category : "ats_compatibility",
      label:     String(s.label ?? s.category ?? "").slice(0, 40),
      score:     Math.min(100, Math.max(0, Math.round(Number(s.score) || 0))),
      issues: Array.isArray(s.issues)
        ? s.issues
            .filter(i => i && typeof i === "object")
            .map(i => ({
              severity: VALID_SEVERITIES.has(i.severity) ? i.severity : "suggestion",
              message:  String(i.message ?? "").slice(0, 150),
              fix:      String(i.fix     ?? "").slice(0, 150),
            }))
        : [],
      isPremium: false,
    }));

  if (!Array.isArray(r.topFixes) || r.topFixes.length === 0) {
    console.warn("[OpenRouter] topFixes missing — synthesising from section issues.");
    const allIssues = r.sections.flatMap(s => s.issues ?? []);
    const order: Record<string, number> = { critical: 0, warning: 1, suggestion: 2 };
    r.topFixes = allIssues
      .sort((a, b) => (order[a.severity] ?? 2) - (order[b.severity] ?? 2))
      .slice(0, 5);
  } else {
    r.topFixes = r.topFixes
      .filter(f => f && typeof f === "object")
      .slice(0, 5)
      .map(f => ({
        severity: VALID_SEVERITIES.has(f.severity) ? f.severity : "suggestion",
        message:  String(f.message ?? "").slice(0, 150),
        fix:      String(f.fix     ?? "").slice(0, 150),
      }));
  }

  return r;
}

// ─── Main export ──────────────────────────────────────────────

export async function reviewResume(resumeText: string): Promise<ReviewResult> {
  console.log(`[OpenRouter] Starting review | model: ${MODEL} | resume: ${resumeText.length} chars`);

  let response: Response;
  try {
    response = await fetch(OPENROUTER_API_URL, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer":  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        "X-Title":       "RESUFII Resume Reviewer",
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: 8000,
        temperature: 0.0,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user",   content: buildUserPrompt(resumeText) },
        ],
      }),
    });
  } catch (netErr) {
    const msg = (netErr as Error).message;
    console.error("[OpenRouter] Network error:", msg);
    throw new Error(`AI_SERVICE_ERROR:network:${msg}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`[OpenRouter] HTTP ${response.status}:`, body.slice(0, 300));
    if (response.status === 429) throw new Error("AI_SERVICE_ERROR:rate_limited");
    if (response.status >= 500) throw new Error(`AI_SERVICE_ERROR:upstream_${response.status}`);
    throw new Error(`AI_SERVICE_ERROR:${response.status}`);
  }

  let apiData: {
    choices?: Array<{
      finish_reason?: string;
      message?: {
        content?:           string | null;
        reasoning?:         string | null;
        reasoning_details?: Array<{ type: string; text?: string }>;
      };
    }>;
  };

  try {
    apiData = await response.json();
  } catch {
    throw new Error("AI_SERVICE_ERROR:bad_api_response");
  }

  console.log("[OpenRouter] API response received:", {
    finish_reason:   apiData.choices?.[0]?.finish_reason,
    contentLength:   apiData.choices?.[0]?.message?.content?.length   ?? 0,
    reasoningLength: apiData.choices?.[0]?.message?.reasoning?.length ?? 0,
  });

  const choice  = apiData.choices?.[0];
  const message = choice?.message;
  if (!message) throw new Error("AI_SERVICE_ERROR:no_message");

  const finishReason = choice?.finish_reason;
  if (finishReason === "length") {
    console.warn("[OpenRouter] finish_reason=length — output was truncated. Will attempt JSON repair.");
  }

  const sources: Array<{ label: string; text: string }> = [];

  if (message.content?.trim()) {
    sources.push({ label: "content", text: message.content.trim().slice(0, MAX_SOURCE_CHARS) });
  }
  if (message.reasoning?.trim()) {
    sources.push({ label: "reasoning", text: message.reasoning.trim().slice(0, MAX_SOURCE_CHARS) });
  }
  if (Array.isArray(message.reasoning_details)) {
    const combined = message.reasoning_details
      .filter(d => d.type === "reasoning.text" && d.text?.trim())
      .map(d => d.text!)
      .join("\n")
      .slice(0, MAX_SOURCE_CHARS);
    if (combined) sources.push({ label: "reasoning_details", text: combined });
  }

  // @ts-expect-error — intentional early release of large object
  apiData = null;

  if (sources.length === 0) {
    console.error(`[OpenRouter] No text in any field. finish_reason: ${finishReason ?? "unknown"}`);
    throw new Error(`AI_SERVICE_ERROR:no_content:${finishReason ?? "unknown"}`);
  }

  for (const { label, text } of sources) {
    console.log(`[OpenRouter] Trying source "${label}" (${text.length} chars)…`);
    try {
      const result = validateResult(extractAndParse(text));
      console.log(`[OpenRouter] ✓ Review complete via "${label}". Score: ${result.overallScore}`);
      return result;
    } catch (err) {
      console.warn(`[OpenRouter] Source "${label}" failed:`, (err as Error).message);
    }
  }

  const allText = sources.map(s => s.text).join("\n\n");
  console.log(`[OpenRouter] Trying combined text (${allText.length} chars)…`);
  const result = validateResult(extractAndParse(allText));
  console.log(`[OpenRouter] ✓ Review complete via combined text. Score: ${result.overallScore}`);
  return result;
}


// ─── Content Generation ───────────────────────────────────────

const CONTENT_SYSTEM_PROMPT = `You are an expert resume writer. 
Write professional, ATS-optimised resume content.
Return ONLY the requested content — no preamble, no explanation, no markdown formatting.`;

const SECTION_PROMPTS: Record<string, (ctx: Record<string, string>) => string> = {
  experience: (ctx) => `Write 4-5 strong resume bullet points for this work experience.
Each bullet must start with a past-tense action verb and include a quantified metric where possible.
Role: ${ctx.role ?? "N/A"}
Company: ${ctx.company ?? "N/A"}
Duration: ${ctx.duration ?? "N/A"}
Key responsibilities/context: ${ctx.description ?? "N/A"}
Output ONLY the bullet points, one per line, starting each with "•".`,

  summary: (ctx) => `Write a 2-3 sentence professional resume summary for a ${ctx.role ?? "professional"} 
with ${ctx.years ?? "several"} years of experience in ${ctx.industry ?? "their field"}.
Key skills: ${ctx.skills ?? "N/A"}
Target role: ${ctx.targetRole ?? ctx.role ?? "N/A"}
Output ONLY the summary paragraph.`,

  skills: (ctx) => `Generate a concise, ATS-friendly skills section for a ${ctx.role ?? "professional"}.
Industry: ${ctx.industry ?? "N/A"}
Experience level: ${ctx.level ?? "mid-level"}
Existing skills mentioned: ${ctx.existing ?? "N/A"}
Output ONLY a comma-separated list of relevant hard and soft skills.`,

  education: (ctx) => `Write a clean resume education entry for:
Degree: ${ctx.degree ?? "N/A"}
Institution: ${ctx.institution ?? "N/A"}
Year: ${ctx.year ?? "N/A"}
Relevant coursework/achievements: ${ctx.details ?? "N/A"}
Output ONLY the formatted education entry (2-3 lines max).`,

  project: (ctx) => `Write 2-3 resume bullet points for this project:
Project name: ${ctx.name ?? "N/A"}
Tech stack: ${ctx.stack ?? "N/A"}
Description: ${ctx.description ?? "N/A"}
Impact/outcome: ${ctx.impact ?? "N/A"}
Output ONLY the bullet points, one per line, starting each with "•".`,
};

/**
 * Generate full resume section content for premium users.
 * Returns { content: string, tokens: number }.
 */
export async function generateResumeContent(
  type: string,
  context: Record<string, string>
): Promise<{ content: string; tokens: number }> {
  const promptFn   = SECTION_PROMPTS[type] ?? SECTION_PROMPTS["experience"];
  const userPrompt = promptFn(context);

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "HTTP-Referer":  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      "X-Title":       "RESUFII Resume Writer",
    },
    body: JSON.stringify({
      model:       MODEL,
      max_tokens:  600,
      temperature: 0.7,
      messages: [
        { role: "system", content: CONTENT_SYSTEM_PROMPT },
        { role: "user",   content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`[OpenRouter/generate] HTTP ${response.status}:`, body.slice(0, 300));
    if (response.status === 429) throw new Error("AI_SERVICE_ERROR:rate_limited");
    if (response.status >= 500) throw new Error(`AI_SERVICE_ERROR:upstream_${response.status}`);
    throw new Error(`AI_SERVICE_ERROR:${response.status}`);
  }

  const data = await response.json() as {
    usage?: { total_tokens?: number };
    choices?: Array<{ message?: { content?: string | null } }>;
  };

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("AI_SERVICE_ERROR:no_content");

  const tokens = data.usage?.total_tokens ?? 0;
  return { content, tokens };
}

/**
 * Generate a single free preview bullet point for non-premium users.
 * Returns a plain string (one bullet).
 * 
 * IMPROVEMENTS:
 * - Comprehensive logging to diagnose failures
 * - Validates each step of response parsing
 * - Graceful fallback to template on any error or truncation
 * - Handles finish_reason='length' without throwing
 */
export async function generateFreePreview(
  role: string,
  company: string
): Promise<string> {
  console.log(`[OpenRouter/preview] Starting preview | role: ${role} | company: ${company}`);

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer":  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        "X-Title":       "RESUFII Resume Writer",
      },
      body: JSON.stringify({
        model:       MODEL,
        max_tokens:  200,
        temperature: 0.7,
        messages: [
          { role: "system", content: CONTENT_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Write ONE resume bullet for a ${role} at ${company}. Start with a verb. Include a metric.
Return ONLY the bullet text.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(`[OpenRouter/preview] HTTP ${response.status}:`, body.slice(0, 300));
      console.log(`[OpenRouter/preview] Falling back to template for role: ${role}`);
      return generateFallbackPreview(role, company);
    }

    let data: {
      choices?: Array<{ 
        finish_reason?: string;
        message?: { content?: string | null } 
      }>;
      error?: { message?: string };
    };

    try {
      data = await response.json();
    } catch (parseErr) {
      console.error(`[OpenRouter/preview] Failed to parse JSON response:`, (parseErr as Error).message);
      console.log(`[OpenRouter/preview] Falling back to template for role: ${role}`);
      return generateFallbackPreview(role, company);
    }

    // Log the actual response structure for debugging
    console.log(`[OpenRouter/preview] Response structure:`, {
      hasChoices: !!data.choices,
      choicesLength: data.choices?.length ?? 0,
      finishReason: data.choices?.[0]?.finish_reason,
      contentLength: data.choices?.[0]?.message?.content?.length ?? 0,
    });

    // Check for API-level errors
    if (data.error) {
      console.error(`[OpenRouter/preview] API error:`, data.error.message);
      console.log(`[OpenRouter/preview] Falling back to template for role: ${role}`);
      return generateFallbackPreview(role, company);
    }

    // Validate choices array and extract content
    const choice = data.choices?.[0];
    if (!choice?.message) {
      console.error(`[OpenRouter/preview] Invalid response structure`);
      console.log(`[OpenRouter/preview] Falling back to template for role: ${role}`);
      return generateFallbackPreview(role, company);
    }

    const content = choice.message.content?.trim();
    if (!content) {
      console.warn(`[OpenRouter/preview] Empty content field. finish_reason: ${choice.finish_reason ?? "unknown"}`);
      console.log(`[OpenRouter/preview] Falling back to template for role: ${role}`);
      return generateFallbackPreview(role, company);
    }

    console.log(`[OpenRouter/preview] ✓ Preview generated (${content.length} chars)`);
    return content;
  } catch (err) {
    console.error(`[OpenRouter/preview] Unexpected error:`, (err as Error).message);
    console.log(`[OpenRouter/preview] Falling back to template for role: ${role}`);
    return generateFallbackPreview(role, company);
  }
}

/**
 * Fallback template-based bullet generator.
 * Used if AI generation fails to provide a graceful degradation.
 */
export function generateFallbackPreview(role: string, company: string): string {
  const templates: Record<string, string> = {
    engineer: `• Developed and deployed scalable systems impacting 10K+ end users`,
    "software engineer": `• Built full-stack features improving system performance by 25%+`,
    "senior engineer": `• Architected microservices reducing latency by 40% for 50K+ users`,
    "product manager": `• Led cross-functional team delivering product roadmap ahead of schedule`,
    manager: `• Managed team of 5+ professionals, achieving 120% of quarterly OKRs`,
    designer: `• Designed user-centric interfaces increasing engagement by 35%`,
    analyst: `• Analyzed large datasets to identify trends, resulting in $500K savings`,
    "data scientist": `• Built ML models improving prediction accuracy from 75% to 92%`,
  };

  // Try exact match first, then fuzzy match on first word
  let template: string | undefined = templates[role.toLowerCase()];
  if (!template) {
    const firstWord = role.toLowerCase().split(" ")[0];
    const match = Object.entries(templates).find(([k]) => k.startsWith(firstWord));
    template = match?.[1];
  }

  // Fallback to generic if no match
  const result: string = template || `• Delivered measurable results at ${company}`;
  console.log(`[OpenRouter/preview] Using fallback template:`, result);
  return result;
}