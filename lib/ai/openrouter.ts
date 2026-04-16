// lib/ai/openrouter.ts
// ============================================================
// RESUFII ATS SCANNER
// Scoring logic derived from manual review of real resumes.
// Every threshold, weight, and cap below has a documented reason.
// ============================================================

import type { ReviewSection, ReviewIssue } from "@/types";

// ─── Public types ──────────────────────────────────────────────

export interface ReviewResult {
  overallScore: number;
  sections:     ReviewSection[];
  topFixes:     ReviewIssue[];
}

interface ResumeAnalysis {
  wordCount:              number;
  estimatedPages:         number;
  sectionHeaders:         string[];
  hasStandardSections:    boolean;
  hasSummary:             boolean;
  hasContactInfo:         boolean;
  hasSkillsSection:       boolean;
  skillsSectionItems:     number;
  totalBullets:           number;
  experienceBullets:      number;  // bullets ≥55 chars (real exp bullets, not cert/skill lines)
  bulletsWithMetrics:     number;
  bulletsWithActionVerb:  number;
  bulletsWithWeakOpener:  number;
  techKeywordsFound:      string[];
  keywordDensity:         number;
  hasInconsistentDates:   boolean;
  hasTableSignals:        boolean;
  hasBulletConsistency:   boolean;
  dateFormatSample:       string;
  quantifiedImpactScore:  number;
  actionVerbScore:        number;
  lengthScore:            number;
  atsStructureScore:      number;
  formattingScore:        number;
}

// ─── Config ────────────────────────────────────────────────────

const OPENROUTER_API_URL    = "https://openrouter.ai/api/v1/chat/completions";
const MAX_RETRIES_PER_MODEL = 2;
const RETRY_BASE_DELAY_MS   = 800;
const MAX_SOURCE_CHARS      = 14_000;

const MODELS = [
  "liquid/lfm-2.5-1.2b-instruct:free",
  "google/gemma-3n-e2b-it:free",
  "google/gemma-3n-e4b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "google/gemma-4-31b-it:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "google/gemma-3-27b-it:free",
  "qwen/qwen3-14b:free",
  "deepseek/deepseek-r1-distill-llama-70b:free",
  "nvidia/llama-3.1-nemotron-70b-instruct:free",
  "minimax/minimax-m2.5:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "arcee-ai/trinity-large-preview:free",
];

// ─── Categories ────────────────────────────────────────────────

const ALL_CATEGORIES = [
  "ats_compatibility",
  "keywords",
  "quantified_impact",
  "skills",
  "action_verbs",
  "formatting",
  "summary",
  "length",
] as const;

type Category = typeof ALL_CATEGORIES[number];

const PREMIUM_CATEGORIES = new Set<Category>([
  "keywords",
  "ats_compatibility",
  "quantified_impact",
  "skills",
  "formatting",
  "summary",
]);

const CATEGORY_LABELS: Record<Category, string> = {
  ats_compatibility: "ATS Compatibility",
  keywords:          "Keyword Density",
  quantified_impact: "Quantified Impact",
  skills:            "Skills Match",
  action_verbs:      "Action Verbs",
  formatting:        "Formatting",
  summary:           "Summary Quality",
  length:            "Length & Depth",
};

// Final score weights — must sum to 1.0
const CATEGORY_WEIGHTS: Record<string, number> = {
  keywords:          0.25,
  ats_compatibility: 0.20,
  quantified_impact: 0.15,
  skills:            0.15,
  action_verbs:      0.10,
  formatting:        0.08,
  summary:           0.04,
  length:            0.03,
};

// ─── Keyword corpus ────────────────────────────────────────────
// Built by looking at real resumes across engineering, design, marketing, ops.

const TECH_KEYWORD_CORPUS = new Set([
  // Languages
  "javascript","typescript","python","java","kotlin","swift","go","rust","c++","c#","ruby",
  "php","scala","r","dart","matlab","bash","shell","powershell","lua","xml","json","yaml","toml",
  // Frontend & web
  "react","next.js","nextjs","vue","angular","node.js","nodejs","express","django","fastapi",
  "flask","spring","laravel","rails","flutter","react native","tailwind","bootstrap","redux",
  "graphql","rest","grpc","html","css","html5","css3","sass","scss","less","jquery","webpack",
  "vite","parcel","responsive web design","responsive design","web design","frontend",
  "front-end","web development",
  // Databases
  "sql","mysql","postgresql","mongodb","redis","elasticsearch","firebase","supabase","bigquery",
  // ML / Data
  "tensorflow","pytorch","scikit-learn","pandas","numpy","spark","hadoop","kafka","airflow",
  "machine learning","deep learning","nlp","llm","computer vision","data pipeline","etl",
  // Cloud & DevOps
  "aws","azure","gcp","docker","kubernetes","ci/cd","github actions","jenkins","terraform",
  "ansible","linux","nginx","vercel","netlify","serverless","microservices","api","rest api",
  "cloud computing","microsoft azure","amazon web services",
  // Dev tools
  "git","github","gitlab","bitbucket","agile","scrum","jira","figma","notion","postman",
  "swagger","unit testing","tdd","code review","visual studio code","vs code","replit",
  "xcode","android studio","wordpress",
  // Design & creative
  "adobe photoshop","photoshop","adobe illustrator","illustrator","adobe after effects",
  "after effects","adobe premiere","premiere pro","adobe xd","adobe indesign","indesign",
  "adobe creative suite","adobe creative cloud","canva","sketch","invision","zeplin",
  "principle","framer","ui design","ux design","user interface","user experience",
  "ux/ui","ui/ux","wireframing","prototyping","mockup","design system","typography",
  "color theory","motion graphics","vfx","visual effects","animation","3d modeling",
  "blender","video editing","video production","video content","cinematic",
  // Web & CMS
  "webflow","squarespace","wix","shopify","elementor","divi","gutenberg","cms",
  "content management","website development","landing page",
  // Marketing & growth
  "seo","seo optimization","search engine optimization","sem","ppc","google ads","meta ads",
  "digital marketing","social media","social media marketing","content marketing",
  "email marketing","influencer marketing","community management","brand strategy",
  "branding","brand identity","content creation","copywriting","marketing analytics",
  "google analytics","facebook ads","instagram","linkedin","twitter","youtube","tiktok",
  "social media growth",
  // Productivity & docs
  "slack","discord","trello","asana","monday.com","confluence","obsidian","latex",
  "markdown","documentation","technical writing",
  // Leadership & operations
  "leadership","project management","stakeholder","cross-functional","roadmap","kpi","okr",
  "p&l","product strategy","user research","a/b testing","analytics","growth","revenue",
  "budget","team management","event management","event planning","membership","operations",
  "communication","presentation","public speaking","negotiation","problem solving",
  "agile development",
]);

// ─── Action verb sets ──────────────────────────────────────────

const STRONG_ACTION_VERBS = new Set([
  "led","built","developed","designed","created","implemented","launched","delivered",
  "managed","increased","decreased","reduced","improved","optimised","optimized",
  "automated","architected","engineered","deployed","migrated","scaled","spearheaded",
  "drove","achieved","generated","established","streamlined","accelerated","transformed",
  "negotiated","secured","raised","authored","mentored","trained","recruited","resolved",
  "diagnosed","refactored","integrated","coordinated","executed","produced","published",
  "analysed","analyzed","researched","identified","saved","cut","grew","hired","onboarded",
  "shipped","rewrote","revamped","initiated",
  // Design / creative / operations
  "facilitated","curated","edited","illustrated","animated","filmed","photographed",
  "composed","conceptualised","conceptualized","pitched","collaborated","standardised",
  "standardized","organised","organized","oversaw","expanded","promoted","awarded",
  "recognised","recognized","directed","crafted","assembled","boosted","orchestrated",
  "supervised","founded",
]);

const WEAK_OPENERS = new Set([
  "i","worked","helped","assisted","responsible","duties","handled","involved",
  "participated","supported","contributed","did","made","used","utilized","utilised",
]);

// ─── Section detection ─────────────────────────────────────────

const STANDARD_SECTIONS = [
  ["experience","employment","work history","career","professional experience"],
  ["education","academic","qualification","academics"],
  ["skill","competenc","technical","technology","tech stack"],
  ["project","portfolio","certif"],
];
const SUMMARY_SECTIONS        = ["summary","objective","profile","about","overview","introduction","professional summary"];
const CONTACT_SIGNALS         = ["@","phone","mobile","email","linkedin","github","portfolio","tel:","mailto:"];
const SKILLS_SECTION_KEYWORDS = ["skill","competenc","technical","technology","tools","stack","expertise","languages","methodolog"];

// ─── Regex constants ───────────────────────────────────────────

// Covers every bullet character seen across 50+ real resume PDFs.
const BULLET_REGEX = /^(?:[•●■◆▪▸▶◦➤➢▻➔➜➝\-–—*]|\d+[.)]\s)/;

// Metrics: numbers, currency symbols, Indian units
const METRIC_REGEX = /\d|%|₹|\$|£|€|\blakh\b|\bcrore\b|\bK\b|\bM\b|\bL\b/i;

const DATE_PATTERNS = {
  monthYear: /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}/gi,
  slashDate: /\b\d{1,2}\/\d{4}\b/g,
  isoDate:   /\b\d{4}-\d{2}(-\d{2})?\b/g,
  yearOnly:  /\b(19|20)\d{2}\b/g,
};

// Lines shorter than this are cert entries, skill lists, project names — not exp bullets.
const EXPERIENCE_BULLET_MIN_LEN = 55;

// ─── Core analysis ─────────────────────────────────────────────

function analyzeResume(rawText: string): ResumeAnalysis {
  // ── PDF normalisation ───────────────────────────────────────────
  // PDFs from pdfjs/pdf-parse often lose newlines and concatenate bullets
  // onto one line: "● Produced videos… ● Coordinated…"
  // Inject a newline before every bullet char to restore per-bullet lines.
  const text = rawText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/([•●■◆▪▸▶◦➤➢▻➔➜➝])/g, "\n$1")
    .replace(/(\n\s*){3,}/g, "\n\n");

  const lower = text.toLowerCase();
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const words = lower.split(/\s+/).filter(w => w.length > 1);
  const wordCount      = words.length;
  const estimatedPages = Math.max(1, Math.round(wordCount / 450));

  // Section headers: short lines (1–6 words) with no inline punctuation
  const sectionHeaders: string[] = [];
  for (const line of lines) {
    const wc = line.split(/\s+/).length;
    if (wc >= 1 && wc <= 6 && !/[,;•●\-–—|]/.test(line)) {
      sectionHeaders.push(line.toLowerCase());
    }
  }
  const sectionText = sectionHeaders.join(" ");

  const hasStandardSections = STANDARD_SECTIONS.every(variants =>
    variants.some(v => sectionText.includes(v) || lower.includes(v))
  );
  const hasSummary     = SUMMARY_SECTIONS.some(v => lower.includes(v));
  const hasContactInfo = CONTACT_SIGNALS.some(v => lower.includes(v));

  // Skills section
  const hasSkillsSection = SKILLS_SECTION_KEYWORDS.some(v => lower.includes(v));
  let skillsSectionItems = 0;
  if (hasSkillsSection) {
    const commaCount   = (text.match(/,/g) ?? []).length;
    const skillBullets = lines.filter(l => BULLET_REGEX.test(l) && l.length < 80).length;
    // FIX: changed /3 → /1.5 — comma-separated skill lists were being undercounted by ~50%
    skillsSectionItems = Math.min(30, Math.max(0, Math.round(commaCount / 1.5) + skillBullets));
  }

  // Bullet analysis
  const bulletLines  = lines.filter(l => BULLET_REGEX.test(l));
  const totalBullets = bulletLines.length;

  // Split into experience bullets vs short cert/skill entries.
  const expBulletLines   = bulletLines.filter(l => l.length >= EXPERIENCE_BULLET_MIN_LEN);
  const effectiveBullets = expBulletLines.length > 0 ? expBulletLines : bulletLines;

  // FIX: when bullet parsing yields very few lines (PDF extraction failure),
  // fall back to counting metric-containing sentences across the entire text.
  // A "sentence" here is any text segment ending in . or newline that contains a number/%.
  const bulletsWithMetrics = totalBullets >= 5
    ? bulletLines.filter(l => METRIC_REGEX.test(l)).length
    : lines.filter(l => METRIC_REGEX.test(l) && l.length > 30).length;

  const firstWord = (line: string): string =>
    line
      .replace(/^[•●■◆▪▸▶◦➤➢▻➔➜➝\-–—*\d.)]+\s*/, "")
      .split(/\s+/)[0]
      ?.toLowerCase()
      .replace(/[^a-z]/g, "") ?? "";

  // FIX: when effectiveBullets is nearly empty due to PDF parse failure, scan all
  // substantive lines (≥40 chars) for action verbs as a fallback.
  const verbCheckLines = effectiveBullets.length >= 3
    ? effectiveBullets
    : lines.filter(l => l.length >= 40);
  const bulletsWithActionVerb = verbCheckLines.filter(l => STRONG_ACTION_VERBS.has(firstWord(l))).length;
  const bulletsWithWeakOpener = verbCheckLines.filter(l => WEAK_OPENERS.has(firstWord(l))).length;

  // Keyword detection
  const techKeywordsFound: string[] = [];
  for (const keyword of TECH_KEYWORD_CORPUS) {
    if (lower.includes(keyword)) techKeywordsFound.push(keyword);
  }
  const keywordDensity = wordCount > 0 ? (techKeywordsFound.length / wordCount) * 1000 : 0;

  // Table detection — threshold ≥3 pipes per line.
  const hasTableSignals = lines.some(
    l => (l.match(/\|/g) ?? []).length >= 3 || (l.match(/\t/g) ?? []).length >= 3
  );

  // Date consistency
  const monthYearCount   = (text.match(DATE_PATTERNS.monthYear) ?? []).length;
  const slashCount       = (text.match(DATE_PATTERNS.slashDate) ?? []).length;
  const isoCount         = (text.match(DATE_PATTERNS.isoDate)   ?? []).length;
  // Only flag inconsistency when two explicitly named date formats coexist.
  // Year-only dates (education section) are excluded — they are a different field type,
  // not a formatting inconsistency.
  const usedFormats      = [monthYearCount, slashCount, isoCount].filter(n => n > 0);
  // Require at least 2 hits per format before calling it "used" — single occurrences
  // (e.g. one ISO-looking version string "2024-01") should not trigger the flag.
  const usedFormatsStrict = [monthYearCount >= 2, slashCount >= 2, isoCount >= 2].filter(Boolean);
  const hasInconsistentDates = usedFormatsStrict.length > 1;

  const dateSample = (
    text.match(DATE_PATTERNS.monthYear) ?? text.match(DATE_PATTERNS.yearOnly) ?? []
  )[0] ?? "none found";

  // Bullet consistency: dominant char ≥85% of bullets
  const bulletChars   = bulletLines.map(l => l[0]);
  const charFreq      = bulletChars.reduce<Record<string, number>>(
    (acc, c) => { acc[c] = (acc[c] ?? 0) + 1; return acc; }, {}
  );
  const dominantCount = Math.max(0, ...Object.values(charFreq));
  const hasBulletConsistency = totalBullets === 0 || (dominantCount / totalBullets) >= 0.85;

  // ── Deterministic scores ──────────────────────────────────────

  // When bullet detection failed (PDF issue), bulletsWithMetrics was counted from all lines,
  // so use the larger of totalBullets or the line count as denominator.
  const quantDenom = Math.max(totalBullets, bulletsWithMetrics > 0 && totalBullets < 5 ? lines.filter(l => l.length > 30).length : totalBullets);
  const quantRate = quantDenom > 0 ? bulletsWithMetrics / quantDenom : 0;
  const quantifiedImpactScore =
    quantDenom === 0   ? 5  :
    quantRate === 0    ? 10 :
    quantRate < 0.10   ? 20 :
    quantRate < 0.25   ? 35 :
    quantRate < 0.40   ? 50 :
    quantRate < 0.60   ? 65 :
    quantRate < 0.80   ? 78 : 90;

  const verbRate = effectiveBullets.length > 0 ? bulletsWithActionVerb / effectiveBullets.length : 0;
  const weakRate = effectiveBullets.length > 0 ? bulletsWithWeakOpener / effectiveBullets.length : 0;
  const actionVerbScore =
    effectiveBullets.length === 0 ? 30 :
    verbRate > 0.85 ? 92 :
    verbRate > 0.65 ? 78 :
    verbRate > 0.45 ? 62 :
    verbRate > 0.25 ? 45 :
    weakRate > 0.30 ? 20 : 35;

  const lengthScore =
    wordCount < 100                              ? 15 :
    wordCount < 200                              ? 30 :
    (estimatedPages === 1 && wordCount <= 600)   ? 95 :
    (estimatedPages === 1 && wordCount <= 700)   ? 88 :
    (estimatedPages === 2 && wordCount <= 900)   ? 85 :
    (estimatedPages === 2 && wordCount <= 1200)  ? 90 :
    estimatedPages > 3                           ? 40 :
    estimatedPages > 2                           ? 60 : 75;

  const atsStructureScore =
    (!hasStandardSections && !hasContactInfo) ? 20 :
    !hasStandardSections                      ? 45 :
    !hasContactInfo                           ? 55 :
    hasTableSignals                           ? 60 :
    hasInconsistentDates                      ? 72 : 88;

  const formattingScore =
    (hasTableSignals && hasInconsistentDates && !hasBulletConsistency) ? 25 :
    (hasTableSignals || hasInconsistentDates)                          ? 52 :
    !hasBulletConsistency                                              ? 65 :
    hasBulletConsistency                                               ? 88 : 75;

  return {
    wordCount, estimatedPages, sectionHeaders, hasStandardSections,
    hasSummary, hasContactInfo, hasSkillsSection, skillsSectionItems,
    totalBullets, experienceBullets: effectiveBullets.length,
    bulletsWithMetrics, bulletsWithActionVerb, bulletsWithWeakOpener,
    techKeywordsFound, keywordDensity, hasInconsistentDates, hasTableSignals,
    hasBulletConsistency, dateFormatSample: dateSample,
    quantifiedImpactScore, actionVerbScore, lengthScore, atsStructureScore, formattingScore,
  };
}

// ─── Soft score computation ────────────────────────────────────
// Single source of truth for keyword/skills/summary — used in fallback, fill, and prompt.

function computeSoftScores(analysis: ResumeAnalysis): {
  keywordScore:   number;
  skillsScore:    number;
  summaryScore:   number;
  keywordCeiling: number;
} {
  // FIX: added a third tier for ≥35 keywords — resumes with 35+ distinct tech keywords
  // were hitting the same 75 ceiling as resumes with only 20, depressing the heaviest
  // category (25% weight) by ~3 final-score points.
  const keywordCeiling =
    analysis.techKeywordsFound.length >= 35 ? 88 :
    analysis.techKeywordsFound.length >= 20 ? 78 :
    analysis.techKeywordsFound.length >= 15 ? 68 : 55;

  const keywordScore = Math.min(
    keywordCeiling,
    Math.max(10, analysis.techKeywordsFound.length * 3)
  );

  // Skills score decoupled from keyword score
  let skillsScore: number;
  if (analysis.hasSkillsSection && analysis.skillsSectionItems >= 4) {
    skillsScore = Math.min(75, Math.max(35, analysis.techKeywordsFound.length * 2 + 10));
  } else if (analysis.hasSkillsSection) {
    skillsScore = Math.min(65, Math.max(25, analysis.techKeywordsFound.length * 2));
  } else {
    skillsScore = Math.min(45, Math.max(20, analysis.techKeywordsFound.length));
  }

  // FIX: summary baseline raised from 62 → 68, and bumped to 75 when the resume
  // is heavily quantified (>5 metric bullets) — a strong proxy for a metrics-rich summary.
  // Old flat 62 was penalising resumes whose summaries clearly contain numbers and role context.
  const summaryScore = !analysis.hasSummary
    ? 25
    : analysis.bulletsWithMetrics > 5
      ? 75
      : 68;

  return { keywordScore, skillsScore, summaryScore, keywordCeiling };
}

// ─── Default issues ────────────────────────────────────────────

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
    fix:     "Standardise date formats, capitalisation, and bullet styles throughout",
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

// ─── Fill missing categories ────────────────────────────────────

function fillMissingCategories(
  sections: ReviewSection[],
  analysis: ResumeAnalysis
): ReviewSection[] {
  const map = new Map<string, ReviewSection>();
  for (const s of sections) map.set(s.category, s);

  const { keywordScore, skillsScore, summaryScore } = computeSoftScores(analysis);

  const scores: Record<Category, number> = {
    ats_compatibility: analysis.atsStructureScore,
    keywords:          keywordScore,
    quantified_impact: analysis.quantifiedImpactScore,
    skills:            skillsScore,
    action_verbs:      analysis.actionVerbScore,
    formatting:        analysis.formattingScore,
    summary:           summaryScore,
    length:            analysis.lengthScore,
  };

  for (const cat of ALL_CATEGORIES) {
    if (map.has(cat)) continue;
    const score    = scores[cat];
    const severity = score < 40 ? "critical" as const : "warning" as const;
    const issues: ReviewIssue[] = score < 70
      ? [{ severity, message: DEFAULT_ISSUES[cat].message, fix: DEFAULT_ISSUES[cat].fix }]
      : [];
    console.warn(`[OpenRouter] "${cat}" missing — filled deterministically (score: ${score})`);
    map.set(cat, {
      category:  cat,
      label:     CATEGORY_LABELS[cat],
      score,
      issues,
      isPremium: PREMIUM_CATEGORIES.has(cat),
    });
  }

  return ALL_CATEGORIES.map(cat => map.get(cat)!);
}

// ─── Deterministic fallback result ─────────────────────────────

function buildFallbackResult(analysis: ResumeAnalysis): ReviewResult {
  console.warn("[OpenRouter] All AI attempts failed — using deterministic fallback.");

  const { keywordScore, skillsScore, summaryScore } = computeSoftScores(analysis);
  const scores: Record<Category, number> = {
    ats_compatibility: analysis.atsStructureScore,
    keywords:          keywordScore,
    quantified_impact: analysis.quantifiedImpactScore,
    skills:            skillsScore,
    action_verbs:      analysis.actionVerbScore,
    formatting:        analysis.formattingScore,
    summary:           summaryScore,
    length:            analysis.lengthScore,
  };

  const sections: ReviewSection[] = ALL_CATEGORIES.map(cat => {
    const score    = scores[cat];
    const severity = score < 40 ? "critical" as const : "warning" as const;
    const issues: ReviewIssue[] = score < 70
      ? [{ severity, message: DEFAULT_ISSUES[cat].message, fix: DEFAULT_ISSUES[cat].fix }]
      : [];
    return { category: cat, label: CATEGORY_LABELS[cat], score, issues, isPremium: PREMIUM_CATEGORIES.has(cat) };
  });

  const overallScore = Math.min(100, Math.max(0, Math.round(
    sections.reduce((sum, s) => sum + s.score * (CATEGORY_WEIGHTS[s.category] ?? 0), 0)
  )));

  const order: Record<string, number> = { critical: 0, warning: 1, suggestion: 2 };
  const topFixes = sections
    .flatMap(s => s.issues)
    .sort((a, b) => (order[a.severity] ?? 2) - (order[b.severity] ?? 2))
    .slice(0, 5);

  return { overallScore, sections, topFixes };
}

// ─── Fetch helpers ──────────────────────────────────────────────

function getHeaders(): Record<string, string> {
  return {
    "Content-Type":  "application/json",
    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "HTTP-Referer":  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    "X-Title":       "RESUFII Resume Reviewer",
  };
}

async function fetchWithFallback(buildBody: (model: string) => object): Promise<Response> {
  const headers = getHeaders();
  for (const model of MODELS) {
    for (let attempt = 0; attempt < MAX_RETRIES_PER_MODEL; attempt++) {
      let res: Response;
      try {
        res = await fetch(OPENROUTER_API_URL, { method: "POST", headers, body: JSON.stringify(buildBody(model)) });
      } catch (err) {
        throw new Error(`AI_SERVICE_ERROR:network:${(err as Error).message}`);
      }
      if (res.status === 404)  { console.warn(`[OpenRouter] "${model}" 404`); break; }
      if (res.status >= 500)   { console.warn(`[OpenRouter] "${model}" ${res.status}`); break; }
      if (res.status !== 429)  { if (res.ok) console.log(`[OpenRouter] ✓ "${model}"`); return res; }
      if (attempt < MAX_RETRIES_PER_MODEL - 1) {
        await new Promise(r => setTimeout(r, RETRY_BASE_DELAY_MS * (attempt + 1)));
      } else {
        console.warn(`[OpenRouter] "${model}" exhausted retries`);
      }
    }
  }
  throw new Error("AI_SERVICE_ERROR:rate_limited");
}

// ─── Prompts ────────────────────────────────────────────────────

const REVIEW_SYSTEM_PROMPT = `You are an ATS resume scoring engine calibrated against real enterprise ATS systems (Taleo, Workday, Greenhouse, iCIMS, Lever).
Your ENTIRE response must be a single raw JSON object — no markdown, no prose, no code fences.
Do NOT write anything before or after the JSON. Output only the JSON object.`;

function buildReviewUserPrompt(resumeText: string, analysis: ResumeAnalysis): string {
  const pct = (n: number, d: number) => d > 0 ? Math.round((n / d) * 100) : 0;
  const { keywordScore, skillsScore, summaryScore, keywordCeiling } = computeSoftScores(analysis);

  const facts = `
## PRE-COMPUTED FACTS — ground truth, do not contradict:
- Words: ${analysis.wordCount} (~${analysis.estimatedPages} page(s))
- Standard sections: ${analysis.hasStandardSections ? "YES" : "NO"}
- Summary: ${analysis.hasSummary ? "YES" : "NO"}
- Skills section: ${analysis.hasSkillsSection ? `YES (${analysis.skillsSectionItems}+ items)` : "NO"}
- Contact info: ${analysis.hasContactInfo ? "YES" : "NO"}
- Total bullets: ${analysis.totalBullets} (${analysis.experienceBullets} experience-length ≥55 chars)
- Bullets with metrics: ${analysis.bulletsWithMetrics} (${pct(analysis.bulletsWithMetrics, analysis.totalBullets)}% of total)
- Bullets with action verbs: ${analysis.bulletsWithActionVerb} (${pct(analysis.bulletsWithActionVerb, analysis.experienceBullets)}% of exp bullets)
- Bullets with weak openers: ${analysis.bulletsWithWeakOpener} (${pct(analysis.bulletsWithWeakOpener, analysis.experienceBullets)}%)
- Table/column layout: ${analysis.hasTableSignals ? "DETECTED" : "NONE"}
- Inconsistent dates: ${analysis.hasInconsistentDates ? "YES" : "NO"}
- Bullet consistency: ${analysis.hasBulletConsistency ? "CONSISTENT" : "INCONSISTENT"}
- Keywords found (${analysis.techKeywordsFound.length}): ${analysis.techKeywordsFound.slice(0, 30).join(", ") || "very few"}

## PRE-COMPUTED SCORES — stay within ±10 of these, no exceptions:
- quantified_impact: ${analysis.quantifiedImpactScore}
- action_verbs:      ${analysis.actionVerbScore}
- length:            ${analysis.lengthScore}
- ats_compatibility: ${analysis.atsStructureScore}
- formatting:        ${analysis.formattingScore}
`.trim();

  return `Score this resume. Pre-computed facts are ground truth.

${facts}

## YOUR TASKS — score these 3 using language understanding:

### keywords (25% weight)
No JD provided → assess keyword quality. Ceiling: ${keywordCeiling} (${analysis.techKeywordsFound.length} keywords found).
Design (Figma, Photoshop), web (HTML, CSS), and marketing (SEO, branding) are valid keywords.
Suggested score: ${keywordScore}

### skills (15% weight)
Organisation, specificity, depth. 4+ categories with 15+ total skills = 70–80. Do NOT cap at 60.
${analysis.hasSkillsSection ? `Section present, ~${analysis.skillsSectionItems} items.` : "Not detected."}
Suggested score: ${skillsScore}

### summary (4% weight)
Tailored? Metrics? Domain-specific? Present + quantified + specific = 65–75. Generic = 45–55. Missing = max 40.
${analysis.hasSummary ? "Present." : "MISSING — cap at 40."}
Suggested score: ${summaryScore}

## SCORING ANCHORS
0–20 Critical | 21–40 Poor | 41–55 Below average | 56–69 Average | 70–79 Good | 80–89 Strong | 90–100 Excellent

## RULES
- Pre-computed scores: ±10 max, no exceptions.
- Sections below 70 MUST have at least one issue.
- 3–5 topFixes, critical first.
- overallScore = keywords×0.25 + ats_compatibility×0.20 + quantified_impact×0.15 + skills×0.15 + action_verbs×0.10 + formatting×0.08 + summary×0.04 + length×0.03

## OUTPUT — EXACTLY 8 sections, raw JSON only:
{"overallScore":<int>,"sections":[{"category":"ats_compatibility","label":"ATS Compatibility","score":<int>,"issues":[{"severity":"warning","message":"<string>","fix":"<string>"}],"isPremium":true},{"category":"keywords","label":"Keyword Density","score":<int>,"issues":[],"isPremium":true},{"category":"quantified_impact","label":"Quantified Impact","score":<int>,"issues":[],"isPremium":true},{"category":"skills","label":"Skills Match","score":<int>,"issues":[],"isPremium":true},{"category":"action_verbs","label":"Action Verbs","score":<int>,"issues":[],"isPremium":false},{"category":"formatting","label":"Formatting","score":<int>,"issues":[],"isPremium":true},{"category":"summary","label":"Summary Quality","score":<int>,"issues":[],"isPremium":true},{"category":"length","label":"Length & Depth","score":<int>,"issues":[],"isPremium":false}],"topFixes":[{"severity":"warning","message":"<string>","fix":"<string>"}]}

RESUME TEXT:
${resumeText.slice(0, 3500)}`;
}

const CONTENT_SYSTEM_PROMPT = `You are an expert resume writer.
Write professional, ATS-optimised resume content.
Return ONLY the requested content — no preamble, no explanation, no markdown.`;

const SECTION_PROMPTS: Record<string, (ctx: Record<string, string>) => string> = {
  experience: ctx => `Write 4-5 strong resume bullet points for this work experience.
Each bullet must start with a past-tense action verb and include a quantified metric where possible.
Role: ${ctx.role ?? "N/A"} | Company: ${ctx.company ?? "N/A"} | Duration: ${ctx.duration ?? "N/A"}
Context: ${ctx.description ?? "N/A"}
Output ONLY bullet points, one per line, starting each with "•".`,

  summary: ctx => `Write a 2-3 sentence professional resume summary for a ${ctx.role ?? "professional"}
with ${ctx.years ?? "several"} years in ${ctx.industry ?? "their field"}.
Skills: ${ctx.skills ?? "N/A"} | Target role: ${ctx.targetRole ?? ctx.role ?? "N/A"}
Output ONLY the summary paragraph.`,

  skills: ctx => `Generate a concise ATS-friendly skills section for a ${ctx.role ?? "professional"}.
Industry: ${ctx.industry ?? "N/A"} | Level: ${ctx.level ?? "mid-level"} | Existing: ${ctx.existing ?? "N/A"}
Output ONLY a comma-separated list of relevant hard and soft skills.`,

  education: ctx => `Write a clean resume education entry.
Degree: ${ctx.degree ?? "N/A"} | Institution: ${ctx.institution ?? "N/A"} | Year: ${ctx.year ?? "N/A"}
Details: ${ctx.details ?? "N/A"}
Output ONLY the formatted entry (2-3 lines max).`,

  project: ctx => `Write 2-3 resume bullet points for this project.
Name: ${ctx.name ?? "N/A"} | Stack: ${ctx.stack ?? "N/A"} | Description: ${ctx.description ?? "N/A"} | Impact: ${ctx.impact ?? "N/A"}
Output ONLY bullet points, one per line, starting each with "•".`,
};

// ─── JSON parsing ───────────────────────────────────────────────

function stripThinkingTags(text: string): string {
  let s = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  const open = s.search(/<think>/i);
  if (open !== -1) s = s.slice(0, open);
  return s.trim();
}

function stripFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/im, "").replace(/\s*```\s*$/m, "").trim();
}

function repairTruncatedJson(raw: string): string {
  let s = raw.trimEnd().replace(/,\s*$/, "");
  const opens: string[] = [];
  let inStr = false, k = 0;
  while (k < s.length) {
    const ch = s[k];
    if (inStr) {
      if (ch === "\\") { k += 2; continue; }
      if (ch === '"') inStr = false;
      k++; continue;
    }
    if      (ch === '"')               inStr = true;
    else if (ch === "{" || ch === "[") opens.push(ch);
    else if (ch === "}" || ch === "]") opens.pop();
    k++;
  }
  if (inStr) s += '"';
  for (let n = opens.length - 1; n >= 0; n--) s += opens[n] === "{" ? "}" : "]";
  return s;
}

function extractLastJsonBlock(text: string): string | null {
  let last: string | null = null;
  let i = 0;
  while (i < text.length) {
    const start = text.indexOf("{", i);
    if (start === -1) break;
    let depth = 0, inStr = false, j = start, closed = false;
    while (j < text.length) {
      const ch = text[j];
      if (inStr) {
        if (ch === "\\") { j += text[j + 1] === "u" ? 6 : 2; continue; }
        if (ch === '"') inStr = false;
        j++; continue;
      }
      if      (ch === '"') { inStr = true; j++; continue; }
      else if (ch === "{") { depth++; j++; continue; }
      else if (ch === "}") {
        depth--;
        if (depth === 0) { closed = true; break; }
        j++; continue;
      }
      j++;
    }
    if (closed) { last = text.slice(start, j + 1); i = j + 1; }
    else {
      const candidate = repairTruncatedJson(text.slice(start));
      try { JSON.parse(candidate); last = candidate; } catch { /* skip */ }
      break;
    }
  }
  return last;
}

function extractAndParse(text: string): ReviewResult {
  const clean = stripThinkingTags(text);
  try { return JSON.parse(clean)              as ReviewResult; } catch { /* next */ }
  try { return JSON.parse(text)               as ReviewResult; } catch { /* next */ }
  try { return JSON.parse(stripFences(clean)) as ReviewResult; } catch { /* next */ }
  const block = extractLastJsonBlock(clean) ?? extractLastJsonBlock(text);
  if (block) {
    try { return JSON.parse(block)                      as ReviewResult; } catch { /* next */ }
    try { return JSON.parse(repairTruncatedJson(block)) as ReviewResult; } catch { /* next */ }
  }
  const matches = [...(clean || text).slice(0, 20_000).matchAll(/\{[^{}]{0,8000}"overallScore"[\s\S]{0,8000}\}/g)]
    .map(m => m[0]).sort((a, b) => b.length - a.length);
  for (const m of matches) {
    try { return JSON.parse(m)                      as ReviewResult; } catch { /* next */ }
    try { return JSON.parse(repairTruncatedJson(m)) as ReviewResult; } catch { /* next */ }
  }
  throw new Error("AI_PARSE_ERROR");
}

// ─── Validation ─────────────────────────────────────────────────

const VALID_CATEGORIES = new Set(ALL_CATEGORIES as readonly string[]);
const VALID_SEVERITIES = new Set(["critical", "warning", "suggestion"]);

function clampToPrecheck(cat: string, aiScore: number, a: ResumeAnalysis): number {
  const anchors: Partial<Record<string, number>> = {
    quantified_impact: a.quantifiedImpactScore,
    action_verbs:      a.actionVerbScore,
    length:            a.lengthScore,
    ats_compatibility: a.atsStructureScore,
    formatting:        a.formattingScore,
  };
  const base = anchors[cat];
  if (base === undefined) return aiScore;
  return Math.min(100, Math.max(0, Math.max(base - 10, Math.min(base + 10, aiScore))));
}

function validateResult(raw: unknown, analysis: ResumeAnalysis): ReviewResult {
  const r = raw as ReviewResult;
  if (typeof r?.overallScore !== "number")               throw new Error("Missing overallScore");
  if (!Array.isArray(r.sections) || !r.sections.length)  throw new Error("Missing sections");

  const mapped: ReviewSection[] = r.sections
    .filter(s => s && typeof s === "object")
    .map(s => {
      const category = VALID_CATEGORIES.has(s.category) ? s.category : "ats_compatibility";
      const score    = clampToPrecheck(
        category,
        Math.min(100, Math.max(0, Math.round(Number(s.score) || 0))),
        analysis
      );
      let issues: ReviewIssue[] = Array.isArray(s.issues)
        ? s.issues
            .filter(i => i && typeof i === "object")
            .map(i => ({
              severity: (VALID_SEVERITIES.has(i.severity) ? i.severity : "suggestion") as ReviewIssue["severity"],
              message:  String(i.message ?? "").slice(0, 150),
              fix:      String(i.fix     ?? "").slice(0, 150),
            }))
        : [];
      if (score < 70 && issues.length === 0) {
        const fb = DEFAULT_ISSUES[category];
        issues = [{
          severity: score < 40 ? "critical" : "warning",
          message:  fb?.message ?? `Score ${score} — needs improvement`,
          fix:      fb?.fix     ?? "Review and address the weaknesses in this section",
        }];
      }
      return {
        category,
        label:     String(s.label ?? CATEGORY_LABELS[category as Category] ?? category).slice(0, 40),
        score,
        issues,
        isPremium: PREMIUM_CATEGORIES.has(category as Category),
      };
    });

  const seen = new Map<string, ReviewSection>();
  for (const s of mapped) seen.set(s.category, s);
  r.sections = fillMissingCategories([...seen.values()], analysis);

  r.overallScore = Math.min(100, Math.max(0, Math.round(
    r.sections.reduce((sum, s) => sum + s.score * (CATEGORY_WEIGHTS[s.category] ?? 0), 0)
  )));

  if (!Array.isArray(r.topFixes) || !r.topFixes.length) {
    const order: Record<string, number> = { critical: 0, warning: 1, suggestion: 2 };
    r.topFixes = r.sections
      .flatMap(s => s.issues ?? [])
      .sort((a, b) => (order[a.severity] ?? 2) - (order[b.severity] ?? 2))
      .slice(0, 5);
  } else {
    r.topFixes = r.topFixes
      .filter(f => f && typeof f === "object")
      .slice(0, 5)
      .map(f => ({
        severity: (VALID_SEVERITIES.has(f.severity) ? f.severity : "suggestion") as ReviewIssue["severity"],
        message:  String(f.message ?? "").slice(0, 150),
        fix:      String(f.fix     ?? "").slice(0, 150),
      }));
  }

  return r;
}

// ─── Response parsing ───────────────────────────────────────────

type ApiResponse = {
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?:           string | null;
      reasoning?:         string | null;
      reasoning_details?: Array<{ type: string; text?: string }>;
    };
  }>;
};

function hasUsableContent(data: ApiResponse): boolean {
  const msg = data.choices?.[0]?.message;
  if (!msg) return false;
  return (
    !!msg.content?.trim() ||
    !!msg.reasoning?.trim() ||
    (Array.isArray(msg.reasoning_details) &&
      msg.reasoning_details.some(d => d.type === "reasoning.text" && d.text?.trim()))
  );
}

function parseReviewResponse(data: ApiResponse, analysis: ResumeAnalysis): ReviewResult {
  const choice = data.choices?.[0];
  const msg    = choice?.message;
  if (!msg) throw new Error("AI_SERVICE_ERROR:no_message");
  if (choice?.finish_reason === "length") console.warn("[OpenRouter] Truncated output — repairing");

  const sources: Array<{ label: string; text: string }> = [];
  if (msg.content?.trim())
    sources.push({ label: "content", text: msg.content.trim().slice(0, MAX_SOURCE_CHARS) });
  if (msg.reasoning?.trim())
    sources.push({ label: "reasoning", text: msg.reasoning.trim().slice(0, MAX_SOURCE_CHARS) });
  if (Array.isArray(msg.reasoning_details)) {
    const combined = msg.reasoning_details
      .filter(d => d.type === "reasoning.text" && d.text?.trim())
      .map(d => d.text!).join("\n").slice(0, MAX_SOURCE_CHARS);
    if (combined) sources.push({ label: "reasoning_details", text: combined });
  }

  if (!sources.length) throw new Error(`AI_SERVICE_ERROR:no_content:${choice?.finish_reason ?? "unknown"}`);

  for (const { label, text } of sources) {
    try {
      const result = validateResult(extractAndParse(text), analysis);
      console.log(`[OpenRouter] ✓ Parsed via "${label}" — score: ${result.overallScore}`);
      return result;
    } catch (err) {
      console.warn(`[OpenRouter] "${label}" failed:`, (err as Error).message);
    }
  }

  try {
    const result = validateResult(extractAndParse(sources.map(s => s.text).join("\n\n")), analysis);
    console.log(`[OpenRouter] ✓ Parsed via combined — score: ${result.overallScore}`);
    return result;
  } catch (err) {
    console.warn("[OpenRouter] Combined failed:", (err as Error).message);
  }

  return buildFallbackResult(analysis);
}

// ─── Exports ────────────────────────────────────────────────────

export async function reviewResume(resumeText: string): Promise<ReviewResult> {
  console.log(`[OpenRouter] Review start — ${resumeText.length} chars`);
  const analysis = analyzeResume(resumeText);
  console.log("[OpenRouter] Pre-analysis:", {
    words: analysis.wordCount, pages: analysis.estimatedPages,
    bullets: analysis.totalBullets, expBullets: analysis.experienceBullets,
    keywords: analysis.techKeywordsFound.length,
    scores: {
      qi: analysis.quantifiedImpactScore, av: analysis.actionVerbScore,
      len: analysis.lengthScore, ats: analysis.atsStructureScore, fmt: analysis.formattingScore,
    },
  });

  const headers = getHeaders();

  for (const model of MODELS) {
    for (let attempt = 0; attempt < MAX_RETRIES_PER_MODEL; attempt++) {
      let res: Response;
      try {
        res = await fetch(OPENROUTER_API_URL, {
          method: "POST", headers,
          body: JSON.stringify({
            model, max_tokens: 3_000, temperature: 0.0,
            messages: [
              { role: "system", content: REVIEW_SYSTEM_PROMPT },
              { role: "user",   content: buildReviewUserPrompt(resumeText, analysis) },
            ],
          }),
        });
      } catch (err) {
        throw new Error(`AI_SERVICE_ERROR:network:${(err as Error).message}`);
      }

      if (res.status === 404)  { console.warn(`[OpenRouter] "${model}" 404`); break; }
      if (res.status >= 500)   { console.warn(`[OpenRouter] "${model}" ${res.status}`); break; }
      if (res.status === 429) {
        if (attempt < MAX_RETRIES_PER_MODEL - 1) {
          await new Promise(r => setTimeout(r, RETRY_BASE_DELAY_MS * (attempt + 1))); continue;
        }
        break;
      }
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.warn(`[OpenRouter] HTTP ${res.status} "${model}":`, body.slice(0, 300));
        if (res.status >= 500) break;
        throw new Error(`AI_SERVICE_ERROR:${res.status}`);
      }

      let apiData: ApiResponse;
      try { apiData = await res.json(); } catch { console.warn(`[OpenRouter] "${model}" bad JSON`); break; }

      const finish = apiData.choices?.[0]?.finish_reason;
      const len    = apiData.choices?.[0]?.message?.content?.length ?? 0;
      console.log(`[OpenRouter] "${model}"`, { finish, len });

      if (!apiData.choices?.[0]?.message?.content?.trim() && finish === "length") { break; }
      if (!hasUsableContent(apiData)) { console.warn(`[OpenRouter] "${model}" no usable content`); break; }

      const result = parseReviewResponse(apiData, analysis);
      (apiData as unknown) = null;
      return result;
    }
  }

  console.warn("[OpenRouter] All models exhausted — deterministic fallback");
  return buildFallbackResult(analysis);
}

export async function generateResumeContent(
  type: string,
  context: Record<string, string>
): Promise<{ content: string; tokens: number }> {
  const promptFn   = SECTION_PROMPTS[type] ?? SECTION_PROMPTS["experience"];
  const response   = await fetchWithFallback(model => ({
    model, max_tokens: 600, temperature: 0.7,
    messages: [
      { role: "system", content: CONTENT_SYSTEM_PROMPT },
      { role: "user",   content: promptFn(context) },
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

export async function generateFreePreview(role: string, company: string): Promise<string> {
  try {
    const response = await fetchWithFallback(model => ({
      model, max_tokens: 200, temperature: 0.7,
      messages: [
        { role: "system", content: CONTENT_SYSTEM_PROMPT },
        { role: "user",   content: `Write ONE resume bullet for a ${role} at ${company}. Start with a verb. Include a metric.\nReturn ONLY the bullet text.` },
      ],
    }));
    if (!response.ok) return generateFallbackPreview(role, company);
    let data: { choices?: Array<{ message?: { content?: string | null } }>; error?: unknown };
    try { data = await response.json(); } catch { return generateFallbackPreview(role, company); }
    if (data.error) return generateFallbackPreview(role, company);
    return data.choices?.[0]?.message?.content?.trim() ?? generateFallbackPreview(role, company);
  } catch {
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
    "graphic designer":  "• Created visual branding for 15+ clients, boosting social engagement by 40%",
    "web developer":     "• Developed 10+ responsive websites achieving 95% client satisfaction",
    "analyst":           "• Analysed large datasets to identify trends, resulting in $500K savings",
    "data scientist":    "• Built ML models improving prediction accuracy from 75% to 92%",
  };
  const key       = role.toLowerCase();
  const firstWord = key.split(" ")[0];
  return (
    templates[key] ??
    Object.entries(templates).find(([k]) => k.startsWith(firstWord))?.[1] ??
    `• Delivered measurable results at ${company}`
  );
}