// app/api/ai/parse-resume/route.ts

import { NextResponse }    from "next/server";
import { verifyAuthToken } from "@/lib/firebase/auth";
import { v4 as uuid }      from "uuid";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

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
  // Moved to end — consistently returns prose instead of JSON
  "arcee-ai/trinity-large-preview:free",
];

function reqHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization:  `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    "X-Title":      "RESUFII Resume Parser",
  };
}

const SYSTEM_PROMPT = `You are a resume data extraction API. You receive raw resume text and return ONLY a valid JSON object. No explanation, no markdown, no code fences. Just the raw JSON.`;

// ─── Text pre-processor ────────────────────────────────────────────────────
// Run on ALL resumes (blob or not).
// Key fix: merges orphaned date lines back onto their title line.
// e.g. "TradeFXBook - Trade Journaling Platform\n   Dec 2025 - Present"
//   → "TradeFXBook - Trade Journaling Platform | Dec 2025 - Present"
function cleanResumeText(raw: string): string {
  let text = raw;

  // Step 1: collapse extra spaces within lines (PDF justified text adds many spaces)
  text = text.replace(/[ \t]{2,}/g, " ");

  // Step 2: merge orphaned date-only lines onto the previous line.
  // Matches a line that contains ONLY a date range like "Dec 2025 - Present" or "Oct 2022 - May 2026"
  // (possibly with leading spaces) and joins it to the line above with " | "
  text = text.replace(
    /([^\n]+)\n[ \t]*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\s*\d{4}\s*[-–]\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Present)?\s*\d{0,4})[ \t]*\n/gi,
    "$1 | $2\n"
  );

  // Step 3: also handle year-only ranges on orphaned lines e.g. "2023 - Present"
  text = text.replace(
    /([^\n]+)\n[ \t]*(\d{4}\s*[-–]\s*(?:\d{4}|Present))[ \t]*\n/gi,
    "$1 | $2\n"
  );

  // Step 4: normalise bullet characters
  text = text.replace(/^[ \t]*[●•·▪▸►]\s*/gm, "● ");

  // Step 5: collapse 3+ blank lines to 2
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}

// ─── Few-shot examples ─────────────────────────────────────────────────────
// Example A: standard EXPERIENCE/SKILLS headers
// Example B: modelled on Sameen's exact resume — "Projects & Initiatives",
//            "Leadership & Extra-Curricular", no SKILLS section, dates on
//            separate lines (already merged by cleanResumeText above)
const FEW_SHOT_EXAMPLE = `
=== EXAMPLE A — standard resume format ===
INPUT:
John Smith
Software Engineer
john@email.com | +1 555-123-4567 | New York, NY
linkedin.com/in/johnsmith | github.com/johnsmith

SUMMARY
Results-driven software engineer with 5 years of experience building scalable web applications.

EXPERIENCE
Senior Software Engineer — Acme Corp, New York, NY | Jan 2021 – Present
- Led development of microservices architecture serving 2M users
- Reduced API response time by 40% through caching strategies

Software Engineer — Beta Inc, Remote | Jun 2018 – Dec 2020
- Built React dashboards used by 500+ clients

EDUCATION
B.S. Computer Science — MIT, Cambridge, MA | Sep 2014 – May 2018

SKILLS
Languages: JavaScript, TypeScript, Python
Frameworks: React, Node.js, Express
Tools: Docker, Kubernetes, AWS

PROJECTS
Portfolio Website | github.com/johnsmith/portfolio | johnsmith.dev
- Personal portfolio built with Next.js and deployed on Vercel
Tech: Next.js, TailwindCSS, Vercel

CERTIFICATIONS
AWS Solutions Architect Associate — Amazon Web Services | Mar 2022 | ID: ABC-123
OUTPUT:
{"title":"John's Resume","personalInfo":{"fullName":"John Smith","email":"john@email.com","phone":"+1 555-123-4567","location":"New York, NY","linkedin":"linkedin.com/in/johnsmith","github":"github.com/johnsmith","website":"","jobTitle":"Software Engineer"},"summary":"Results-driven software engineer with 5 years of experience building scalable web applications.","experience":[{"id":"exp-1","company":"Acme Corp","role":"Senior Software Engineer","location":"New York, NY","startDate":"Jan 2021","endDate":"Present","current":true,"description":"- Led development of microservices architecture serving 2M users\n- Reduced API response time by 40% through caching strategies","aiGenerated":false},{"id":"exp-2","company":"Beta Inc","role":"Software Engineer","location":"Remote","startDate":"Jun 2018","endDate":"Dec 2020","current":false,"description":"- Built React dashboards used by 500+ clients","aiGenerated":false}],"education":[{"id":"edu-1","institution":"MIT","degree":"B.S.","field":"Computer Science","location":"Cambridge, MA","startDate":"Sep 2014","endDate":"May 2018","current":false,"description":"","aiGenerated":false}],"skills":[{"id":"sk-1","name":"JavaScript, TypeScript, Python","level":"advanced","category":"Languages"},{"id":"sk-2","name":"React, Node.js, Express","level":"advanced","category":"Frameworks"},{"id":"sk-3","name":"Docker, Kubernetes, AWS","level":"intermediate","category":"Tools"}],"projects":[{"id":"proj-1","name":"Portfolio Website","description":"Personal portfolio built with Next.js and deployed on Vercel","tech":["Next.js","TailwindCSS","Vercel"],"link":"johnsmith.dev","githubLink":"github.com/johnsmith/portfolio","aiGenerated":false}],"certifications":[{"id":"cert-1","name":"AWS Solutions Architect Associate","issuer":"Amazon Web Services","date":"Mar 2022","credentialId":"ABC-123","link":""}]}

=== EXAMPLE B — Indian student resume, non-standard sections, no SKILLS header ===
INPUT:
SAMEEN SARDAR S
CS Undergraduate & IEEE Student Member | Trivandrum, Kerala, IND | +91 7511160055
Email: sameensardar@gmail.com Linkedin: linkedin.com/in/sameen-sardar

Computer Science undergraduate and active student leader with a proven track record of architecting data-driven applications. Skilled in multi-agent AI systems, backend database management, and leading cross-functional teams to build scalable systems for global audiences.

Projects & Initiatives

Independent Trading & Market Analysis
● Actively manage personal capital across long-term holding scenarios.
● Conduct systematic backtesting on historical market data.

TradeFXBook - Trade Journaling Platform via Tenztro Pvt. Ltd | Dec 2025 - Present
● Co-founded a registered private limited company to manage international client contracts.
● Engineered the data architecture for TradeFXBook, a live trade journaling platform.
● Supported the platform's growth to $150,000+ in Annual Recurring Revenue and 3,000 global accounts.

AutoBooks - Agentic AI Invoice & Inventory Manager ( academic project ) | Jul 2025 - Present
● Building a multi-agent AI system to automate SME financial data extraction.
● Engineered an intelligent pipeline using TypeScript, Tesseract OCR, and Paddle OCR.

CampusFlo - Faculty & Student Campus Management System | Aug 2025 - Present
● Replaced an outdated legacy system (eTLab) by building a modern platform with a Convex backend.
● Successfully onboarded 149 students and 14 faculty members during a soft launch.

Education

B.Tech in Computer Science Engineering | Mohandas College of Engineering & Technology | Oct 2022 - May 2026
Affiliated to APJ Abdul Kalam Technological University, Kerala CGPA 8.17/10

Leadership & Extra-Curricular Experience

IEEE Student Volunteer
Student Branch, Kerala Chapter, and Global Team | 2023 - Present
● Recognized with the IEEE CS SYP Rising Star Global Award.
● Directed a 30-member team to organize 30+ technical events.
● Authored compliance documentation for 20+ events.
OUTPUT:
{"title":"Sameen's Resume","personalInfo":{"fullName":"SAMEEN SARDAR S","email":"sameensardar@gmail.com","phone":"+91 7511160055","location":"Trivandrum, Kerala, IND","linkedin":"linkedin.com/in/sameen-sardar","github":"","website":"","jobTitle":"CS Undergraduate & IEEE Student Member"},"summary":"Computer Science undergraduate and active student leader with a proven track record of architecting data-driven applications. Skilled in multi-agent AI systems, backend database management, and leading cross-functional teams to build scalable systems for global audiences.","experience":[{"id":"exp-1","company":"IEEE Student Branch, Kerala Chapter","role":"IEEE Student Volunteer","location":"Trivandrum, Kerala","startDate":"2023","endDate":"Present","current":true,"description":"● Recognized with the IEEE CS SYP Rising Star Global Award.\n● Directed a 30-member team to organize 30+ technical events.\n● Authored compliance documentation for 20+ events.","aiGenerated":false}],"education":[{"id":"edu-1","institution":"Mohandas College of Engineering & Technology","degree":"B.Tech","field":"Computer Science Engineering","location":"Kerala","startDate":"Oct 2022","endDate":"May 2026","current":true,"description":"CGPA 8.17/10. Affiliated to APJ Abdul Kalam Technological University, Kerala","aiGenerated":false}],"skills":[{"id":"sk-1","name":"TypeScript, Python","level":"advanced","category":"Languages"},{"id":"sk-2","name":"Convex, Tesseract OCR, Paddle OCR","level":"intermediate","category":"Tools"},{"id":"sk-3","name":"Multi-agent AI Systems, Backend Database Management","level":"advanced","category":"Specialisations"}],"projects":[{"id":"proj-1","name":"TradeFXBook - Trade Journaling Platform","description":"Co-founded a registered private limited company. Engineered the data architecture for a live trade journaling platform. Supported growth to $150,000+ ARR and 3,000 global accounts.","tech":["Convex"],"link":"","githubLink":"","aiGenerated":false},{"id":"proj-2","name":"AutoBooks - Agentic AI Invoice & Inventory Manager","description":"Building a multi-agent AI system to automate SME financial data extraction. Engineered an intelligent pipeline using TypeScript, Tesseract OCR, and Paddle OCR.","tech":["TypeScript","Tesseract OCR","Paddle OCR"],"link":"","githubLink":"","aiGenerated":false},{"id":"proj-3","name":"CampusFlo - Faculty & Student Campus Management System","description":"Replaced legacy system eTLab with a modern platform. Onboarded 149 students and 14 faculty members during a soft launch.","tech":["Convex"],"link":"","githubLink":"","aiGenerated":false},{"id":"proj-4","name":"Independent Trading & Market Analysis","description":"Actively manage personal capital across long-term holding scenarios. Conduct systematic backtesting on historical market data.","tech":[],"link":"","githubLink":"","aiGenerated":false}],"certifications":[]}`;

function buildPrompt(text: string): string {
  return `You are extracting a resume into JSON. Study both examples carefully — they show different resume styles.

RULES (never break these):
1. fullName = ONLY the person's name from the very first line. Nothing else.
2. jobTitle = the subtitle/tagline on line 2 (e.g. "CS Undergraduate & IEEE Student Member"). Stop at | or newline.
3. summary = ONLY the 1-3 sentence bio paragraph. Stop when you hit a section heading.
4. "Projects & Initiatives" section → put each item in "projects" array.
5. "Leadership" / "Extra-Curricular" section → put each item in "experience" array (company = org name, role = position).
6. A line that starts with a project/company name and ends with "| DATE - DATE" has the date in it — extract startDate and endDate from that line.
7. If no SKILLS section exists → infer skills from technologies mentioned in projects/experience descriptions.
8. "___" underscores or a line of dashes = section divider, ignore it.
9. Return ONLY the JSON object. No other text.

${FEW_SHOT_EXAMPLE}

=== NOW EXTRACT THIS RESUME ===
INPUT:
${text.slice(0, 6000)}
OUTPUT:`;
}

function extractJson(raw: string): unknown {
  let clean = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const openThink = clean.search(/<think>/i);
  if (openThink !== -1) clean = clean.slice(0, openThink).trim();
  clean = clean.replace(/^```(?:json)?\s*/im, "").replace(/\s*```\s*$/m, "").trim();

  try { return JSON.parse(clean); } catch { /* continue */ }
  try { return JSON.parse(raw);   } catch { /* continue */ }

  let last: string | null = null;
  let i = 0;
  while (i < clean.length) {
    const start = clean.indexOf("{", i);
    if (start === -1) break;
    let depth = 0, inStr = false, j = start, closed = false;
    while (j < clean.length) {
      const ch = clean[j];
      if (inStr) {
        if (ch === "\\") { j += 2; continue; }
        if (ch === '"')  inStr = false;
        j++; continue;
      }
      if      (ch === '"') inStr = true;
      else if (ch === "{") depth++;
      else if (ch === "}") { if (--depth === 0) { closed = true; break; } }
      j++;
    }
    if (closed) { last = clean.slice(start, j + 1); i = j + 1; } else break;
  }
  if (last) { try { return JSON.parse(last); } catch { /* fail */ } }
  throw new Error("No valid JSON found in AI response");
}

function sanitise(raw: Record<string, unknown>) {
  const pi = (raw.personalInfo ?? {}) as Record<string, unknown>;
  const personalInfo = {
    fullName: str(pi.fullName),
    email:    str(pi.email),
    phone:    str(pi.phone),
    location: str(pi.location),
    linkedin: str(pi.linkedin),
    github:   str(pi.github),
    website:  str(pi.website),
    jobTitle: str(pi.jobTitle),
  };

  const experience = arr(raw.experience).map((e) => {
    const x = e as Record<string, unknown>;
    return {
      id:          ensureId(x.id),
      company:     str(x.company),
      role:        str(x.role ?? x.position ?? x.title),
      location:    str(x.location),
      startDate:   str(x.startDate),
      endDate:     str(x.endDate),
      current:     bool(x.current),
      description: str(x.description),
      aiGenerated: false,
    };
  });

  const education = arr(raw.education).map((e) => {
    const x = e as Record<string, unknown>;
    return {
      id:          ensureId(x.id),
      institution: str(x.institution ?? x.school ?? x.university),
      degree:      str(x.degree),
      field:       str(x.field ?? x.major),
      location:    str(x.location),
      startDate:   str(x.startDate),
      endDate:     str(x.endDate),
      current:     bool(x.current),
      description: str(x.description),
      aiGenerated: false,
    };
  });

  const skills = arr(raw.skills).map((s) => {
    if (typeof s === "string") {
      return { id: uuid(), name: s, level: "intermediate" as const, category: "" };
    }
    const x = s as Record<string, unknown>;
    return {
      id:       ensureId(x.id),
      name:     str(x.name),
      level:    normaliseLevel(str(x.level)),
      category: str(x.category),
    };
  });

  const projects = arr(raw.projects).map((p) => {
    const x = p as Record<string, unknown>;
    let tech: string[] = [];
    if (Array.isArray(x.tech)) {
      tech = (x.tech as unknown[]).map(String).filter(Boolean);
    } else if (typeof x.tech === "string" && x.tech) {
      tech = x.tech.split(/[,;]/).map((t: string) => t.trim()).filter(Boolean);
    } else if (typeof x.technologies === "string" && x.technologies) {
      tech = x.technologies.split(/[,;]/).map((t: string) => t.trim()).filter(Boolean);
    }
    return {
      id:          ensureId(x.id),
      name:        str(x.name),
      description: str(x.description),
      tech,
      link:        str(x.link ?? x.url ?? x.liveLink),
      githubLink:  str(x.githubLink ?? x.github ?? x.repoLink),
      aiGenerated: false,
    };
  });

  const certifications = arr(raw.certifications).map((c) => {
    const x = c as Record<string, unknown>;
    return {
      id:           ensureId(x.id),
      name:         str(x.name),
      issuer:       str(x.issuer ?? x.issuedBy ?? x.organization),
      date:         str(x.date),
      credentialId: str(x.credentialId ?? x.credential_id ?? x.credId),
      link:         str(x.link ?? x.url),
    };
  });

  return {
    title: str(raw.title) || `${personalInfo.fullName || "My"}'s Resume`,
    personalInfo,
    summary:        str(raw.summary),
    experience,
    education,
    skills,
    projects,
    certifications,
  };
}

function str(v: unknown): string {
  if (v == null) return "";
  return typeof v === "string" ? v.trim() : String(v).trim();
}

function bool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.toLowerCase() === "true";
  return false;
}

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function ensureId(v: unknown): string {
  return typeof v === "string" && v.length >= 8 ? v : uuid();
}

function normaliseLevel(v: string): "beginner" | "intermediate" | "advanced" | "expert" {
  const map: Record<string, "beginner" | "intermediate" | "advanced" | "expert"> = {
    beginner: "beginner", basic: "beginner", novice: "beginner",
    intermediate: "intermediate", mid: "intermediate",
    advanced: "advanced", proficient: "advanced",
    expert: "expert", master: "expert",
  };
  return map[v.toLowerCase()] ?? "intermediate";
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const decoded    = await verifyAuthToken(authHeader);
    if (!decoded?.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const rawText = typeof body?.resumeText === "string" ? body.resumeText.trim() : "";
    if (rawText.length < 30) {
      return NextResponse.json({ error: "Resume text too short." }, { status: 400 });
    }
    // Clean up blob text before sending to AI
    const text = cleanResumeText(rawText);

    const rh = reqHeaders();

    for (const model of MODELS) {
      let res: Response;
      try {
        res = await fetch(OPENROUTER_API_URL, {
          method: "POST",
          headers: rh,
          body: JSON.stringify({
            model,
            max_tokens:  3000,
            temperature: 0.0,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user",   content: buildPrompt(text) },
            ],
          }),
        });
      } catch (netErr) {
        console.warn(`[ParseResume] network error on ${model}:`, (netErr as Error).message);
        continue;
      }

      if (res.status === 429 || res.status === 404 || res.status >= 500) {
        console.warn(`[ParseResume] ${model} returned ${res.status}, skipping`);
        continue;
      }
      if (!res.ok) {
        console.warn(`[ParseResume] ${model} returned ${res.status}`);
        continue;
      }

      let apiData: { choices?: Array<{ message?: { content?: string | null } }> };
      try { apiData = await res.json(); } catch { continue; }

      const content = apiData.choices?.[0]?.message?.content?.trim();
      if (!content) continue;

      try {
        const raw    = extractJson(content) as Record<string, unknown>;
        const parsed = sanitise(raw);
        console.log(`[ParseResume] success via ${model}`);
        return NextResponse.json(parsed);
      } catch (parseErr) {
        console.warn(`[ParseResume] parse failed on ${model}:`, (parseErr as Error).message);
        continue;
      }
    }

    return NextResponse.json(
      { error: "AI parsing failed. Please fill in manually." },
      { status: 503 }
    );

  } catch (err) {
    const e = err as Error;
    console.error("[POST /api/ai/parse-resume]", e);
    if (e.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}