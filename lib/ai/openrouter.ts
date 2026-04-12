// lib/ai/openrouter.ts
// ============================================================
// OPENROUTER AI CLIENT — Multi-model fallback + retry
//
// Features:
//  1. Model fallback chain  — tries free models in order
//  2. Per-model retry       — up to 2 attempts with backoff on 429
//  3. Force strict JSON     — two-message (system+user) prompt
//  4. Compact schema        — capped response sizes
//  5. Hardened JSON parsing — 5-stage extraction pipeline
//  6. Truncation handling   — graceful repair on finish_reason='length'
//  7. Free preview fallback — template-based degradation on any error
//  8. Empty-content guard   — skips models that return reasoning but no JSON
//  9. 404 guard             — skips deprecated/unavailable models
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

// Free models first for reliability / zero cost.
// Paid / thinking models are last-resort fallbacks only —
// they may prepend <think> blocks or tool calls before JSON.
const MODELS = [
 /*  "nvidia/nemotron-3-nano-30b:free",
  "nvidia/nemotron-3-super:free", */
  "minimax/minimax-m2.5:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",

"google/gemma-3n-e2b-it:free",
"google/gemma-3n-e4b-it:free",
   "arcee-ai/trinity-large-preview:free",
  "google/gemma-4-26b-a4b-it:free",
  "google/gemma-4-31b-it:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "liquid/lfm-2.5-1.2b-instruct:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "google/gemma-3-27b-it:free",
  "qwen/qwen3-14b:free",
  "deepseek/deepseek-r1-distill-llama-70b:free",
  "nvidia/llama-3.1-nemotron-70b-instruct:free",
  // Paid fallbacks (used only when all free models fail)
  /* "stepfun/step-3.5-flash",
  "qwen/qwen3.6-plus", */
];

const MAX_RETRIES_PER_MODEL = 2;
const RETRY_BASE_DELAY_MS   = 800;
const MAX_SOURCE_CHARS      = 14_000;

// ─── Premium categories ───────────────────────────────────────
// These sections are ALWAYS locked for free users.
// Free users see: score hidden, issues hidden, upgrade prompt.
// Premium users see: score + full issues list.

const PREMIUM_CATEGORIES = new Set([
  "keywords",
  "ats_compatibility",
  "quantified_impact",
  "skills",
  "formatting",
  "summary",
]);

// Free categories — visible to everyone (score + issues shown)
// "action_verbs" and "length" are always free.

// ─── Shared fetch headers ─────────────────────────────────────

function getHeaders(): Record<string, string> {
  return {
    "Content-Type":  "application/json",
    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "HTTP-Referer":  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    "X-Title":       "RESUFII Resume Reviewer",
  };
}

// ─── Model fallback + retry fetch ────────────────────────────

async function fetchWithFallback(
  buildBody: (model: string) => object
): Promise<Response> {
  const headers = getHeaders();

  for (const model of MODELS) {
    for (let attempt = 0; attempt < MAX_RETRIES_PER_MODEL; attempt++) {
      let res: Response;
      try {
        res = await fetch(OPENROUTER_API_URL, {
          method: "POST",
          headers,
          body: JSON.stringify(buildBody(model)),
        });
      } catch (netErr) {
        throw new Error(`AI_SERVICE_ERROR:network:${(netErr as Error).message}`);
      }

      if (res.status === 404) {
        const body = await res.text().catch(() => "");
        console.warn(`[OpenRouter] "${model}" returned 404 — skipping.`, body.slice(0, 200));
        break;
      }

      // 5xx: upstream error — try next model rather than crashing the chain
      if (res.status >= 500) {
        const body = await res.text().catch(() => "");
        console.warn(`[OpenRouter] "${model}" returned ${res.status} — trying next model.`, body.slice(0, 200));
        break;
      }

      if (res.status !== 429) {
        if (res.ok) console.log(`[OpenRouter] ✓ Model "${model}" responded OK`);
        return res;
      }

      if (attempt < MAX_RETRIES_PER_MODEL - 1) {
        const wait = RETRY_BASE_DELAY_MS * (attempt + 1);
        console.warn(`[OpenRouter] 429 on "${model}" — retry ${attempt + 1}/${MAX_RETRIES_PER_MODEL - 1} in ${wait}ms`);
        await new Promise(r => setTimeout(r, wait));
      } else {
        console.warn(`[OpenRouter] "${model}" exhausted all retries — trying next model`);
      }
    }
  }

  throw new Error("AI_SERVICE_ERROR:rate_limited");
}

// ─── Prompts ──────────────────────────────────────────────────

const REVIEW_SYSTEM_PROMPT = `You are a strict ATS resume scoring engine calibrated against real ATS systems (Taleo, Workday, Greenhouse, iCIMS).
Your ENTIRE response must be a single raw JSON object — no markdown, no prose, no code fences.
Do NOT write anything before or after the JSON. Output only the JSON object.`;

function buildReviewUserPrompt(resumeText: string): string {
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

### MANDATORY ISSUES RULE — you MUST follow this exactly:
- Score 0–55   → issues array MUST have at least 2 issues (severity: "critical" or "warning")
- Score 56–69  → issues array MUST have at least 1 issue (severity: "warning" or "suggestion")
- Score 70–84  → issues array SHOULD have 1 suggestion if any room for improvement exists
- Score 85–100 → issues array MAY be empty ONLY if the section is genuinely perfect
- A low score (below 70) with an EMPTY issues array is INVALID. You must explain WHY the score is low.

### overallScore calculation:
Weighted average of section scores using the weights above. Round to nearest integer.
Do NOT inflate. A typical resume scores 45-65. A score above 75 requires: strong keyword integration,
metrics on most bullets, AND clean formatting — all three, not one or two.

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

Rules:
- Exactly 8 sections (one per category above).
- 3-5 topFixes ordered critical first.
- NEVER return an empty issues array for any section scoring below 70. This is the most important rule.

RESUME:
${resumeText.slice(0, 4000)}`;
}

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

// ─── Default issues for low-scoring sections ──────────────────

const DEFAULT_ISSUES: Record<string, { message: string; fix: string }> = {
  ats_compatibility: {
    message: "Resume may not be fully parseable by ATS software",
    fix:     "Use standard section headers and avoid tables, columns, or images",
  },
  keywords: {
    message: "Insufficient job-specific keywords detected",
    fix:     "Add relevant keywords from the job description to your experience and summary",
  },
  quantified_impact: {
    message: "Few or no quantified achievements found",
    fix:     "Add numbers, percentages, or metrics to your bullet points",
  },
  skills: {
    message: "Skills section lacks depth or relevance to the target role",
    fix:     "Add more role-specific hard skills and organise them by category",
  },
  action_verbs: {
    message: "Bullet points lack strong action verbs",
    fix:     "Start each bullet with a past-tense action verb (Led, Built, Increased, etc.)",
  },
  formatting: {
    message: "Inconsistent formatting detected",
    fix:     "Standardise punctuation, date formats, capitalisation, and bullet styles throughout",
  },
  summary: {
    message: "Summary is generic or missing key information",
    fix:     "Tailor the summary to your target role and include one key achievement",
  },
  length: {
    message: "Resume length is not optimal for experience level",
    fix:     "Aim for 1 page (under 3 years) or 2 pages (3–8 years experience)",
  },
};

// ─── JSON extraction helpers ──────────────────────────────────

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
        if (ch === "\\") { j += text[j + 1] === "u" ? 6 : 2; continue; }
        if (ch === '"') inString = false;
        j++; continue;
      }

      if      (ch === '"') { inString = true; j++; continue; }
      else if (ch === "{") { depth++; j++; continue; }
      else if (ch === "}") {
        depth--;
        if (depth === 0) { closed = true; break; }
        j++; continue;
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

function stripFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/\s*```\s*$/m, "")
    .trim();
}

/**
 * Strips <think>…</think> reasoning blocks that newer thinking models
 * (Qwen3, DeepSeek-R1, etc.) inject before their JSON response.
 * Also handles partial blocks where the closing tag is missing (truncated).
 */
function stripThinkingTags(text: string): string {
  // Remove complete <think>…</think> blocks (may span multiple lines)
  let result = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  // If an opening tag remains but no closing tag (truncated output),
  // drop everything from the opening tag onward and keep any pre-tag content.
  const openIdx = result.search(/<think>/i);
  if (openIdx !== -1) {
    result = result.slice(0, openIdx);
  }
  return result.trim();
}

function repairTruncatedJson(raw: string): string {
  let s        = raw.trimEnd().replace(/,\s*$/, "");
  const opens: string[] = [];
  let inString = false;
  let k        = 0;

  while (k < s.length) {
    const ch = s[k];
    if (inString) {
      if (ch === "\\") { k += 2; continue; }
      if (ch === '"')  inString = false;
      k++; continue;
    }
    if      (ch === '"')               inString = true;
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

function extractAndParse(text: string): ReviewResult {
  // Stage 0: strip <think>…</think> reasoning blocks (Qwen3, DeepSeek-R1, etc.)
  const clean = stripThinkingTags(text);

  try { return JSON.parse(clean) as ReviewResult; } catch { /* next */ }
  try { return JSON.parse(text) as ReviewResult; } catch { /* next */ }

  const stripped = stripFences(clean);
  try { return JSON.parse(stripped) as ReviewResult; } catch { /* next */ }

  const lastBlock = extractLastJsonBlock(clean) ?? extractLastJsonBlock(text);
  if (lastBlock) {
    try { return JSON.parse(lastBlock) as ReviewResult; } catch { /* next */ }
    try { return JSON.parse(repairTruncatedJson(lastBlock)) as ReviewResult; } catch { /* next */ }
  }

  const searchText  = clean.length > 0 ? clean.slice(0, 20_000) : text.slice(0, 20_000);
  const jsonPattern = /\{[^{}]{0,8000}"overallScore"[\s\S]{0,8000}\}/g;
  const candidates  = [...searchText.matchAll(jsonPattern)]
    .map(m => m[0])
    .sort((a, b) => b.length - a.length);

  for (const candidate of candidates) {
    try { return JSON.parse(candidate) as ReviewResult; } catch { /* next */ }
    try { return JSON.parse(repairTruncatedJson(candidate)) as ReviewResult; } catch { /* next */ }
  }

  console.error("[OpenRouter] All parse stages failed.", { textLength: text.length, tail: text.slice(-600) });
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
    .map(s => {
      const score    = Math.min(100, Math.max(0, Math.round(Number(s.score) || 0)));
      const category = VALID_CATEGORIES.has(s.category) ? s.category : "ats_compatibility";

      let issues: ReviewIssue[] = Array.isArray(s.issues)
        ? s.issues
            .filter(i => i && typeof i === "object")
            .map(i => ({
              severity: VALID_SEVERITIES.has(i.severity) ? i.severity : "suggestion" as const,
              message:  String(i.message ?? "").slice(0, 150),
              fix:      String(i.fix     ?? "").slice(0, 150),
            }))
        : [];

      // Safety net: enforce issues for low-scoring sections
      if (score < 70 && issues.length === 0) {
        const severity = score < 40 ? "critical" as const : "warning" as const;
        const fallback = DEFAULT_ISSUES[category] ?? {
          message: `This section scored ${score}/100 and needs improvement`,
          fix:     "Review this section carefully and address the underlying weaknesses",
        };
        issues = [{ severity, message: fallback.message, fix: fallback.fix }];
        console.warn(
          `[OpenRouter] Section "${category}" scored ${score} but had no issues — injected default issue.`
        );
      }

      return {
        category,
        label:    String(s.label ?? s.category ?? "").slice(0, 40),
        score,
        issues,
        // ── FIX: isPremium is ALWAYS decided here by category, never by the AI ──
        isPremium: PREMIUM_CATEGORIES.has(category),
      };
    });

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
        severity: VALID_SEVERITIES.has(f.severity) ? f.severity : "suggestion" as const,
        message:  String(f.message ?? "").slice(0, 150),
        fix:      String(f.fix     ?? "").slice(0, 150),
      }));
  }

  return r;
}

// ─── Response parsing helper ──────────────────────────────────

function hasUsableContent(apiData: {
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?:           string | null;
      reasoning?:         string | null;
      reasoning_details?: Array<{ type: string; text?: string }>;
    };
  }>;
}): boolean {
  const message = apiData.choices?.[0]?.message;
  if (!message) return false;

  const hasContent         = !!message.content?.trim();
  const hasReasoning       = !!message.reasoning?.trim();
  const hasReasoningDetail = Array.isArray(message.reasoning_details) &&
    message.reasoning_details.some(d => d.type === "reasoning.text" && d.text?.trim());

  return hasContent || hasReasoning || hasReasoningDetail;
}

function parseReviewResponse(apiData: {
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?:           string | null;
      reasoning?:         string | null;
      reasoning_details?: Array<{ type: string; text?: string }>;
    };
  }>;
}): ReviewResult {
  const choice  = apiData.choices?.[0];
  const message = choice?.message;
  if (!message) throw new Error("AI_SERVICE_ERROR:no_message");

  if (choice?.finish_reason === "length") {
    console.warn("[OpenRouter] finish_reason=length — output was truncated, attempting JSON repair.");
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

  if (sources.length === 0) {
    throw new Error(`AI_SERVICE_ERROR:no_content:${choice?.finish_reason ?? "unknown"}`);
  }

  for (const { label, text } of sources) {
    console.log(`[OpenRouter] Trying source "${label}" (${text.length} chars)…`);
    try {
      const result = validateResult(extractAndParse(text));
      console.log(`[OpenRouter] ✓ Parsed via "${label}". Score: ${result.overallScore}`);
      return result;
    } catch (err) {
      console.warn(`[OpenRouter] Source "${label}" failed:`, (err as Error).message);
    }
  }

  const allText = sources.map(s => s.text).join("\n\n");
  console.log(`[OpenRouter] Trying combined sources (${allText.length} chars)…`);
  const result = validateResult(extractAndParse(allText));
  console.log(`[OpenRouter] ✓ Parsed via combined sources. Score: ${result.overallScore}`);
  return result;
}

// ─── Exported functions ───────────────────────────────────────

export async function reviewResume(resumeText: string): Promise<ReviewResult> {
  console.log(`[OpenRouter] Starting review | resume: ${resumeText.length} chars`);

  const headers = getHeaders();

  for (const model of MODELS) {
    for (let attempt = 0; attempt < MAX_RETRIES_PER_MODEL; attempt++) {
      let res: Response;
      try {
        res = await fetch(OPENROUTER_API_URL, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model,
            max_tokens:  3_000,
            temperature: 0.0,
            messages: [
              { role: "system", content: REVIEW_SYSTEM_PROMPT },
              { role: "user",   content: buildReviewUserPrompt(resumeText) },
            ],
          }),
        });
      } catch (netErr) {
        throw new Error(`AI_SERVICE_ERROR:network:${(netErr as Error).message}`);
      }

      if (res.status === 404) {
        const body = await res.text().catch(() => "");
        console.warn(`[OpenRouter] "${model}" returned 404 — skipping.`, body.slice(0, 200));
        break;
      }

      if (res.status === 429) {
        if (attempt < MAX_RETRIES_PER_MODEL - 1) {
          const wait = RETRY_BASE_DELAY_MS * (attempt + 1);
          console.warn(`[OpenRouter] 429 on "${model}" — retry ${attempt + 1}/${MAX_RETRIES_PER_MODEL - 1} in ${wait}ms`);
          await new Promise(r => setTimeout(r, wait));
          continue;
        }
        console.warn(`[OpenRouter] "${model}" exhausted all retries — trying next model`);
        break;
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.warn(`[OpenRouter] HTTP ${res.status} on "${model}":`, body.slice(0, 300));
        if (res.status >= 500) {
          // Upstream error — skip this model and try the next
          break;
        }
        // 4xx errors are usually auth/quota issues on this model; throw
        throw new Error(`AI_SERVICE_ERROR:${res.status}`);
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
        apiData = await res.json();
      } catch {
        // Malformed JSON from this model — skip it and try the next
        console.warn(`[OpenRouter] "${model}" returned unparseable JSON — skipping.`);
        break;
      }

      const finishReason    = apiData.choices?.[0]?.finish_reason;
      const contentLength   = apiData.choices?.[0]?.message?.content?.length   ?? 0;
      const reasoningLength = apiData.choices?.[0]?.message?.reasoning?.length ?? 0;

      console.log(`[OpenRouter] "${model}" response:`, { finishReason, contentLength, reasoningLength });

      if (!apiData.choices?.[0]?.message?.content?.trim() && finishReason === "length") {
        console.warn(`[OpenRouter] "${model}" has empty content with finish_reason=length — skipping.`);
        break;
      }

      if (!hasUsableContent(apiData)) {
        console.warn(`[OpenRouter] "${model}" returned no usable content — skipping.`);
        break;
      }

      console.log(`[OpenRouter] ✓ Model "${model}" responded OK`);
      const result = parseReviewResponse(apiData);

      // @ts-expect-error — intentional early GC of large object
      apiData = null;

      return result;
    }
  }

  throw new Error("AI_SERVICE_ERROR:rate_limited");
}

export async function generateResumeContent(
  type: string,
  context: Record<string, string>
): Promise<{ content: string; tokens: number }> {
  const promptFn   = SECTION_PROMPTS[type] ?? SECTION_PROMPTS["experience"];
  const userPrompt = promptFn(context);

  const response = await fetchWithFallback((model) => ({
    model,
    max_tokens:  600,
    temperature: 0.7,
    messages: [
      { role: "system", content: CONTENT_SYSTEM_PROMPT },
      { role: "user",   content: userPrompt },
    ],
  }));

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`[OpenRouter/generate] HTTP ${response.status}:`, body.slice(0, 300));
    if (response.status === 429) throw new Error("AI_SERVICE_ERROR:rate_limited");
    if (response.status >= 500) throw new Error(`AI_SERVICE_ERROR:upstream_${response.status}`);
    throw new Error(`AI_SERVICE_ERROR:${response.status}`);
  }

  const data = await response.json() as {
    usage?:   { total_tokens?: number };
    choices?: Array<{ message?: { content?: string | null } }>;
  };

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("AI_SERVICE_ERROR:no_content");

  return { content, tokens: data.usage?.total_tokens ?? 0 };
}

export async function generateFreePreview(
  role: string,
  company: string
): Promise<string> {
  console.log(`[OpenRouter/preview] Starting | role: ${role} | company: ${company}`);

  try {
    const response = await fetchWithFallback((model) => ({
      model,
      max_tokens:  200,
      temperature: 0.7,
      messages: [
        { role: "system", content: CONTENT_SYSTEM_PROMPT },
        {
          role:    "user",
          content: `Write ONE resume bullet for a ${role} at ${company}. Start with a verb. Include a metric.\nReturn ONLY the bullet text.`,
        },
      ],
    }));

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(`[OpenRouter/preview] HTTP ${response.status}:`, body.slice(0, 300));
      return generateFallbackPreview(role, company);
    }

    let data: {
      choices?: Array<{
        finish_reason?: string;
        message?:       { content?: string | null };
      }>;
      error?: { message?: string };
    };

    try {
      data = await response.json();
    } catch {
      console.error("[OpenRouter/preview] Failed to parse JSON response");
      return generateFallbackPreview(role, company);
    }

    console.log("[OpenRouter/preview] Response:", {
      finishReason:  data.choices?.[0]?.finish_reason,
      contentLength: data.choices?.[0]?.message?.content?.length ?? 0,
    });

    if (data.error) {
      console.error("[OpenRouter/preview] API error:", data.error.message);
      return generateFallbackPreview(role, company);
    }

    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      console.warn(`[OpenRouter/preview] Empty content. finish_reason: ${data.choices?.[0]?.finish_reason ?? "unknown"}`);
      return generateFallbackPreview(role, company);
    }

    console.log(`[OpenRouter/preview] ✓ Generated (${content.length} chars)`);
    return content;

  } catch (err) {
    console.error("[OpenRouter/preview] Unexpected error:", (err as Error).message);
    return generateFallbackPreview(role, company);
  }
}

export function generateFallbackPreview(role: string, company: string): string {
  const templates: Record<string, string> = {
    "engineer":          "• Developed and deployed scalable systems impacting 10K+ end users",
    "software engineer": "• Built full-stack features improving system performance by 25%+",
    "senior engineer":   "• Architected microservices reducing latency by 40% for 50K+ users",
    "product manager":   "• Led cross-functional team delivering product roadmap ahead of schedule",
    "manager":           "• Managed team of 5+ professionals, achieving 120% of quarterly OKRs",
    "designer":          "• Designed user-centric interfaces increasing engagement by 35%",
    "analyst":           "• Analysed large datasets to identify trends, resulting in $500K savings",
    "data scientist":    "• Built ML models improving prediction accuracy from 75% to 92%",
  };

  const key       = role.toLowerCase();
  const firstWord = key.split(" ")[0];

  const template =
    templates[key] ??
    Object.entries(templates).find(([k]) => k.startsWith(firstWord))?.[1] ??
    `• Delivered measurable results at ${company}`;

  console.log("[OpenRouter/preview] Using fallback template:", template);
  return template;
}