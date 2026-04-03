"use client";
// app/(marketing)/page.tsx
// ============================================================
// LANDING PAGE
// Uses globals.css tokens exclusively — no inline styles.
// Sections: Navbar → Hero → Features → How it works → Pricing → CTA → Footer
// ============================================================

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// ─── Scroll reveal hook ───────────────────────────────────────
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) el.classList.add("revealed"); },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

// ─── Score ring SVG ───────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const r = 30;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" className="score-ring">
      <circle cx="38" cy="38" r={r} fill="none" stroke="var(--bg-elevated)" strokeWidth="5" />
      <circle
        cx="38" cy="38" r={r}
        fill="none"
        stroke="var(--gold)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform="rotate(-90 38 38)"
        style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1)" }}
      />
      <text
        x="38" y="43"
        textAnchor="middle"
        fill="var(--gold-light)"
        fontSize="14"
        fontWeight="700"
        fontFamily="var(--font-display)"
      >
        {score}
      </text>
    </svg>
  );
}

// ─── Resume mockup ────────────────────────────────────────────
function ResumeMockup() {
  return (
    <div className="mockup-wrap">
      <div className="mockup-glow" />
      <div className="mockup-card">
        <div className="mk-name" />
        <div className="mk-role" />
        <div className="mk-pills">
          <div className="mk-pill" /><div className="mk-pill" /><div className="mk-pill" />
        </div>
        <div className="mk-hr" />
        <div className="mk-section">
          <div className="mk-sh" />
          <div className="mk-line mk-full" />
          <div className="mk-line mk-84" />
          <div className="mk-line mk-62" />
        </div>
        <div className="mk-section">
          <div className="mk-sh" />
          <div className="mk-job-row">
            <div className="mk-line mk-42" />
            <div className="mk-line mk-24" />
          </div>
          <div className="mk-line mk-full" />
          <div className="mk-line mk-78" />
          <div className="mk-line mk-68" />
        </div>
        <div className="mk-section">
          <div className="mk-sh" />
          <div className="mk-skills">
            {[...Array(6)].map((_, i) => <div key={i} className="mk-skill" />)}
          </div>
        </div>
        <div className="mk-ai-badge">
          <span className="dot-live" />
          AI writing…
        </div>
      </div>
    </div>
  );
}

// ─── Feature card ─────────────────────────────────────────────
function FeatureCard({ icon, title, desc, delay }: {
  icon: string; title: string; desc: string; delay: number;
}) {
  const ref = useReveal();
  return (
    <div ref={ref} className="feat-card reveal-item" style={{ transitionDelay: `${delay}ms` }}>
      <div className="feat-icon">{icon}</div>
      <h5 className="feat-title">{title}</h5>
      <p className="feat-desc">{desc}</p>
    </div>
  );
}

// ─── Step ─────────────────────────────────────────────────────
function Step({ num, title, desc, delay }: {
  num: string; title: string; desc: string; delay: number;
}) {
  const ref = useReveal();
  return (
    <div ref={ref} className="step reveal-item" style={{ transitionDelay: `${delay}ms` }}>
      <div className="step-num">{num}</div>
      <div>
        <h5 className="step-title">{title}</h5>
        <p className="step-desc">{desc}</p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────
export default function LandingPage() {
  const [score, setScore] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setScore(87), 700);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <style>{`
        /* ── Navbar ─────────────────────────────────────────── */
        .nav {
          position: fixed; top: 0; left: 0; right: 0;
          z-index: var(--z-sticky);
          height: var(--nav-height);
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 5vw;
          background: var(--bg-overlay);
          backdrop-filter: blur(18px);
          border-bottom: 1px solid var(--border);
        }
        .nav-logo {
          font-family: var(--font-display);
          font-size: 1.35rem; font-weight: 900;
          color: var(--text-primary); text-decoration: none;
          letter-spacing: -0.02em;
        }
        .nav-logo span { color: var(--gold); }
        .nav-links { display: flex; align-items: center; gap: var(--space-8); }
        .nav-links a {
          font-size: var(--text-sm); color: var(--text-secondary);
          text-decoration: none; transition: color var(--duration-base);
        }
        .nav-links a:hover { color: var(--text-primary); }

        /* ── Hero ───────────────────────────────────────────── */
        .hero {
          min-height: 100vh;
          display: grid; grid-template-columns: 1fr 1fr;
          align-items: center; gap: var(--space-16);
          padding: calc(var(--nav-height) + 60px) 5vw 80px;
          max-width: var(--max-width); margin: 0 auto;
        }
        .hero-badge {
          display: inline-flex; align-items: center; gap: var(--space-2);
          background: var(--gold-dim); border: 1px solid var(--gold-border);
          color: var(--gold-light); padding: 0.3rem 0.9rem;
          border-radius: var(--radius-full);
          font-size: var(--text-xs); font-weight: 600;
          margin-bottom: var(--space-5);
          animation: fade-down 0.6s var(--ease) both;
        }
        .hero h1 {
          margin-bottom: var(--space-5);
          animation: fade-down 0.6s 0.1s var(--ease) both;
        }
        .hero h1 em { color: var(--gold); font-style: italic; display: block; }
        .hero-sub {
          font-size: var(--text-md); color: var(--text-secondary);
          max-width: 440px; margin-bottom: var(--space-8);
          line-height: 1.75; font-weight: 300;
          animation: fade-down 0.6s 0.2s var(--ease) both;
        }
        .hero-cta {
          display: flex; align-items: center; gap: var(--space-4);
          animation: fade-down 0.6s 0.3s var(--ease) both;
        }
        .hero-stats {
          display: flex; gap: var(--space-8); margin-top: var(--space-10);
          padding-top: var(--space-8); border-top: 1px solid var(--border);
          animation: fade-down 0.6s 0.4s var(--ease) both;
        }
        .stat-num {
          font-family: var(--font-display); font-size: var(--text-2xl);
          font-weight: 700; color: var(--gold-light); display: block;
        }
        .stat-lbl {
          font-size: var(--text-xs); color: var(--text-secondary);
          text-transform: uppercase; letter-spacing: 0.1em;
        }

        /* ── Mockup ──────────────────────────────────────────── */
        .hero-visual {
          display: flex; align-items: center; justify-content: center;
          animation: fade-up 0.8s 0.2s var(--ease) both;
        }
        .mockup-wrap { position: relative; display: flex; align-items: center; justify-content: center; }
        .mockup-glow {
          position: absolute; inset: -50px;
          background: radial-gradient(ellipse at center, var(--gold-glow) 0%, transparent 70%);
          pointer-events: none;
        }
        .mockup-card {
          position: relative; background: #fff;
          border-radius: var(--radius-lg); padding: 24px 22px; width: 300px;
          box-shadow: var(--shadow-lg), 0 0 0 1px rgba(255,255,255,.06);
          transform: perspective(1100px) rotateY(-8deg) rotateX(2deg);
          transition: transform var(--duration-slow) var(--ease);
        }
        .mockup-card:hover { transform: perspective(1100px) rotateY(-2deg) rotateX(0); }
        .mk-name  { height: 11px; background: #1a1a2e; border-radius: 3px; width: 52%; margin-bottom: 5px; }
        .mk-role  { height: 7px;  background: #c9a84c; border-radius: 3px; width: 34%; margin-bottom: 9px; opacity: .8; }
        .mk-pills { display: flex; gap: 5px; margin-bottom: 10px; }
        .mk-pill  { height: 6px; background: #e0e0e0; border-radius: 99px; width: 52px; }
        .mk-hr    { height: 1px; background: #e8e8e8; margin: 0 0 12px; }
        .mk-section { margin-bottom: 13px; }
        .mk-sh    { height: 6px; background: #1a1a2e; border-radius: 3px; width: 26%; margin-bottom: 7px; }
        .mk-line  { height: 5px; background: #ebebeb; border-radius: 3px; margin-bottom: 4px; }
        .mk-full  { width: 100%; } .mk-84 { width: 84%; } .mk-78 { width: 78%; }
        .mk-68    { width: 68%; }  .mk-62 { width: 62%; } .mk-42 { width: 42%; } .mk-24 { width: 24%; }
        .mk-job-row { display: flex; gap: 6px; margin-bottom: 4px; }
        .mk-skills  { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 3px; }
        .mk-skill   { height: 15px; width: 46px; background: #f5eed8; border-radius: 99px; border: 1px solid #d4b96a; }
        .mk-ai-badge {
          position: absolute; top: -13px; right: -13px;
          background: var(--bg-elevated); border: 1px solid var(--gold-border);
          color: var(--gold-light); padding: 5px 11px;
          border-radius: var(--radius-full); font-size: var(--text-xs); font-weight: 500;
          display: flex; align-items: center; gap: var(--space-2);
          box-shadow: var(--shadow-md); animation: float 3s ease-in-out infinite;
        }
        .score-card {
          position: absolute; bottom: -18px; left: -38px;
          background: var(--bg-elevated); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: 12px 16px;
          display: flex; align-items: center; gap: var(--space-3);
          box-shadow: var(--shadow-md);
          animation: float 3.5s 0.5s ease-in-out infinite; z-index: 2;
        }
        .score-lbl { font-size: var(--text-xs); color: var(--text-secondary); margin-bottom: 2px; }
        .score-val { font-family: var(--font-display); font-size: var(--text-base); color: var(--gold-light); font-weight: 700; }

        /* ── Section shared ──────────────────────────────────── */
        .section-inner { max-width: var(--max-width); margin: 0 auto; padding: 100px 5vw; }
        .section-header { margin-bottom: var(--space-12); }
        .section-header h2 { margin-bottom: var(--space-3); }
        .section-header p { max-width: 500px; font-size: var(--text-md); }

        /* ── Features ────────────────────────────────────────── */
        .feat-grid {
          display: grid; grid-template-columns: repeat(3, 1fr);
          border: 1px solid var(--border); border-radius: var(--radius-lg);
          overflow: hidden; gap: 1px; background: var(--border);
        }
        .feat-card {
          background: var(--bg-surface); padding: 2rem 1.8rem;
          transition: background var(--duration-base) var(--ease), opacity 0.5s var(--ease), transform 0.5s var(--ease);
        }
        .feat-card:hover { background: var(--bg-elevated); }
        .feat-icon {
          font-size: 1.4rem; width: 42px; height: 42px;
          display: flex; align-items: center; justify-content: center;
          background: var(--gold-dim); border: 1px solid var(--gold-border);
          border-radius: var(--radius-md); margin-bottom: var(--space-4);
        }
        .feat-title { color: var(--text-primary); margin-bottom: var(--space-2); }
        .feat-desc  { font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.65; }

        /* ── How it works ────────────────────────────────────── */
        .how-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5rem; align-items: start; }
        .steps { display: flex; flex-direction: column; }
        .step {
          display: flex; gap: var(--space-6); align-items: flex-start;
          padding: var(--space-6) 0; border-bottom: 1px solid var(--border);
          transition: opacity 0.5s var(--ease), transform 0.5s var(--ease);
        }
        .step:last-child { border-bottom: none; }
        .step-num {
          font-family: var(--font-display); font-size: 2.8rem; font-weight: 900;
          color: var(--gold-dim); line-height: 1; min-width: 54px;
          transition: color var(--duration-slow) var(--ease);
        }
        .step:hover .step-num { color: var(--gold-border); }
        .step-title { color: var(--text-primary); margin-bottom: var(--space-2); }
        .step-desc  { font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.7; }

        /* ── Pricing ─────────────────────────────────────────── */
        .pricing-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-5); max-width: 700px; }
        .price-card {
          background: var(--bg-surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: 2.2rem 2rem;
          transition: transform var(--duration-base) var(--ease), border-color var(--duration-base) var(--ease);
        }
        .price-card:hover { transform: translateY(-4px); border-color: var(--border-hover); }
        .price-card.featured {
          border-color: var(--gold-border);
          background: linear-gradient(145deg, var(--bg-surface) 0%, rgba(201,168,76,.04) 100%);
          position: relative;
        }
        .featured-tag {
          position: absolute; top: -11px; left: 50%; transform: translateX(-50%);
          background: var(--gold); color: #080d14;
          font-size: var(--text-xs); font-weight: 700; letter-spacing: 0.05em;
          padding: 2px 14px; border-radius: var(--radius-full); white-space: nowrap;
        }
        .plan-name  { font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.12em; color: var(--text-secondary); margin-bottom: var(--space-3); }
        .plan-price { font-family: var(--font-display); font-size: 2.6rem; font-weight: 900; color: var(--text-primary); line-height: 1; margin-bottom: var(--space-2); }
        .plan-price sup { font-size: 1.1rem; vertical-align: top; margin-top: 6px; display: inline-block; }
        .plan-tagline { font-size: var(--text-sm); color: var(--text-secondary); margin-bottom: var(--space-6); }
        .plan-features { list-style: none; display: flex; flex-direction: column; gap: var(--space-3); margin-bottom: var(--space-6); }
        .plan-features li { font-size: var(--text-sm); color: var(--text-secondary); display: flex; align-items: flex-start; gap: var(--space-2); }
        .plan-features li::before { content: '✓'; color: var(--gold); font-weight: 700; flex-shrink: 0; margin-top: 1px; }
        .plan-features li.locked { opacity: 0.38; }
        .plan-features li.locked::before { content: '✕'; color: var(--text-secondary); }
        .plan-btn { display: block; width: 100%; text-align: center; }

        /* ── CTA ─────────────────────────────────────────────── */
        .cta-wrap {
          text-align: center; padding: 100px 5vw;
          max-width: var(--max-width); margin: 0 auto; position: relative;
        }
        .cta-glow {
          position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
          width: 560px; height: 260px;
          background: radial-gradient(ellipse, var(--gold-glow) 0%, transparent 70%);
          pointer-events: none;
        }
        .cta-wrap h2 { margin-bottom: var(--space-4); }
        .cta-wrap > p { max-width: 420px; margin: 0 auto var(--space-8); font-size: var(--text-md); }

        /* ── Footer ──────────────────────────────────────────── */
        .footer {
          border-top: 1px solid var(--border); padding: var(--space-8) 5vw;
          display: flex; align-items: center; justify-content: space-between;
          max-width: var(--max-width); margin: 0 auto;
        }
        .footer-logo { font-family: var(--font-display); font-size: 1.05rem; font-weight: 900; color: var(--text-secondary); text-decoration: none; }
        .footer-logo span { color: var(--gold); }
        .footer-links { display: flex; gap: var(--space-6); }
        .footer-links a { font-size: var(--text-xs); color: var(--text-secondary); text-decoration: none; transition: color var(--duration-base); }
        .footer-links a:hover { color: var(--text-primary); }
        .footer-copy { font-size: var(--text-xs); color: var(--text-disabled); }

        /* ── Reveal ──────────────────────────────────────────── */
        .reveal-item { opacity: 0; transform: translateY(22px); }
        .reveal-item.revealed { opacity: 1; transform: translateY(0); }

        /* ── Responsive ──────────────────────────────────────── */
        @media (max-width: 960px) {
          .hero         { grid-template-columns: 1fr; padding-top: calc(var(--nav-height) + 40px); text-align: center; gap: var(--space-12); }
          .hero-sub     { max-width: 100%; }
          .hero-cta     { justify-content: center; flex-wrap: wrap; }
          .hero-stats   { justify-content: center; }
          .hero-visual  { display: none; }
          .feat-grid    { grid-template-columns: 1fr; }
          .how-grid     { grid-template-columns: 1fr; gap: var(--space-8); }
          .pricing-grid { grid-template-columns: 1fr; max-width: 380px; }
          .footer       { flex-direction: column; gap: var(--space-5); text-align: center; }
          .footer-links { flex-wrap: wrap; justify-content: center; }
          .nav-links a:not(.btn) { display: none; }
        }
      `}</style>

      {/* Global BG effects */}
      <div className="bg-mesh" />
      <div className="bg-grain" />

      {/* ── Navbar ─────────────────────────────────────────── */}
      <nav className="nav">
        <Link href="/" className="nav-logo">Resu<span>fii</span></Link>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#pricing">Pricing</a>
          <Link href="/login" className="btn btn-primary btn-sm">Get Started →</Link>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────── */}
      <section>
        <div className="hero">
          <div>
            <div className="hero-badge">
              <span className="dot-live" />
              AI-Powered Resume Builder
            </div>
            <h1>Resumes that<br />get <em>interviews.</em></h1>
            <p className="hero-sub">
              Build ATS-optimized resumes with AI-written content, get scored
              against real job requirements, and land more interviews — in minutes.
            </p>
            <div className="hero-cta">
              <Link href="/register" className="btn btn-primary btn-lg">Build My Resume →</Link>
              <a href="#how-it-works" className="btn btn-ghost btn-lg">See how it works ↓</a>
            </div>
            <div className="hero-stats">
              <div><span className="stat-num">87%</span><span className="stat-lbl">ATS Pass Rate</span></div>
              <div><span className="stat-num">6+</span><span className="stat-lbl">Templates</span></div>
              <div><span className="stat-num">3×</span><span className="stat-lbl">More Interviews</span></div>
            </div>
          </div>
          <div className="hero-visual">
            <ResumeMockup />
            <div className="score-card">
              <ScoreRing score={score} />
              <div>
                <div className="score-lbl">ATS Score</div>
                <div className="score-val">Excellent</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────── */}
      <section id="features">
        <div className="section-inner">
          <div className="section-header">
            <p className="eyebrow" style={{ marginBottom: "var(--space-3)" }}>Features</p>
            <h2>Everything you need<br />to stand out.</h2>
            <p>From AI-written bullet points to real ATS scoring — every tool built to get past the bots and in front of humans.</p>
          </div>
          <div className="feat-grid">
            <FeatureCard delay={0}   icon="✦" title="AI Content Generation" desc="Llama 3.3 70B writes ATS-optimized bullet points for your experience, education, and summary — tailored to your role." />
            <FeatureCard delay={80}  icon="◎" title="ATS Score & Review"     desc="Upload any resume and get a detailed score across 8 categories — keywords, impact, formatting, action verbs, and more." />
            <FeatureCard delay={160} icon="▦" title="6 Pro Templates"        desc="Classic, Modern, Minimal, Executive, Creative, Tech — all ATS-compliant and designed to impress hiring managers." />
            <FeatureCard delay={0}   icon="⬡" title="PDF Export"             desc="Download a pixel-perfect PDF ready to submit. No watermarks, no branding — yours completely." />
            <FeatureCard delay={80}  icon="⟳" title="Live Preview"           desc="See your resume update in real time as you type. Switch templates instantly without losing your content." />
            <FeatureCard delay={160} icon="⛨" title="Secure & Private"       desc="Firebase Auth with strict Firestore rules — encrypted data that only you can access. No exceptions." />
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────── */}
      <section id="how-it-works">
        <div className="section-inner">
          <div className="how-grid">
            <div>
              <p className="eyebrow" style={{ marginBottom: "var(--space-3)" }}>How it works</p>
              <h2>From blank page<br />to hired.</h2>
              <p style={{ marginTop: "var(--space-4)" }}>Three simple steps. No resume-writing experience needed.</p>
            </div>
            <div className="steps">
              <Step delay={0}   num="01" title="Fill in your details" desc="Enter your experience, education, and skills. Our guided form walks you through each section clearly." />
              <Step delay={120} num="02" title="Let AI write it"      desc="Hit the AI button on any section. Llama 3.3 70B generates ATS-optimized bullet points based on your role." />
              <Step delay={240} num="03" title="Score & download"     desc="Run an ATS review to see your score. Fix what's flagged, then export a professional PDF — ready to send." />
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────── */}
      <section id="pricing">
        <div className="section-inner">
          <div className="section-header">
            <p className="eyebrow" style={{ marginBottom: "var(--space-3)" }}>Pricing</p>
            <h2>Simple, honest pricing.</h2>
            <p>Start free. Upgrade once for lifetime access — no subscriptions, no monthly fees.</p>
          </div>
          <div className="pricing-grid">
            <div className="price-card">
              <p className="plan-name">Free</p>
              <div className="plan-price"><sup>₹</sup>0</div>
              <p className="plan-tagline">Forever free. No credit card needed.</p>
              <ul className="plan-features">
                <li>Create unlimited resumes</li>
                <li>6 professional templates</li>
                <li>PDF download</li>
                <li>ATS score (number only)</li>
                <li>1 AI suggestion preview</li>
                <li className="locked">Full AI content generation</li>
                <li className="locked">Detailed review breakdown</li>
                <li className="locked">All improvement fixes</li>
              </ul>
              <Link href="/register" className="btn btn-secondary plan-btn">Get started free</Link>
            </div>
            <div className="price-card featured">
              <div className="featured-tag">✦ LIFETIME DEAL</div>
              <p className="plan-name">Premium</p>
              <div className="plan-price"><sup>$</sup>2</div>
              <p className="plan-tagline">One-time payment. Access forever.</p>
              <ul className="plan-features">
                <li>Everything in Free</li>
                <li>Unlimited AI generation</li>
                <li>Full review — 8 categories</li>
                <li>All improvement fixes</li>
                <li>Priority support</li>
                <li>All future templates</li>
                <li>Early access to new features</li>
              </ul>
              <Link href="/register" className="btn btn-primary plan-btn">Get lifetime access →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────── */}
      <section>
        <div className="cta-wrap">
          <div className="cta-glow" />
          <h2>Your next job starts with a <em>better resume.</em></h2>
          <p>Join thousands of job seekers who use RESUFII to build resumes that actually get callbacks.</p>
          <Link href="/register" className="btn btn-primary btn-lg">
            Build My Resume — It&apos;s Free →
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="footer">
        <Link href="/" className="footer-logo">Resu<span>fii</span></Link>
        <div className="footer-links">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#pricing">Pricing</a>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </div>
        <span className="footer-copy">© 2026 RESUFII. All rights reserved.</span>
      </footer>
    </>
  );
}