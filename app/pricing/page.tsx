"use client";
// app/pricing/page.tsx
// ============================================================
// PRICING PAGE
// Standalone page showing Free vs Premium plan comparison.
// Upgrade button triggers Dodo checkout.
// ============================================================

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const FREE_FEATURES = [
  { label: "Create unlimited resumes",      included: true  },
  { label: "6 professional templates",      included: true  },
  { label: "PDF download",                  included: true  },
  { label: "ATS score (number only)",       included: true  },
  { label: "1 AI suggestion preview",       included: true  },
  { label: "Full AI content generation",    included: false },
  { label: "Detailed ATS review (8 cats)",  included: false },
  { label: "All improvement fixes",         included: false },
  { label: "Priority support",              included: false },
  { label: "All future templates",          included: false },
];

const PREMIUM_FEATURES = [
  { label: "Everything in Free",            included: true },
  { label: "Unlimited AI generation",       included: true },
  { label: "Full ATS review — 8 categories",included: true },
  { label: "All improvement fixes",         included: true },
  { label: "Priority support",              included: true },
  { label: "All future templates",          included: true },
  { label: "Early access to new features",  included: true },
  { label: "Lifetime access — pay once",    included: true },
];

const FAQ = [
  {
    q: "Is this really a one-time payment?",
    a: "Yes. Pay $2 once and get lifetime access to all premium features — no subscriptions, no renewals.",
  },
  {
    q: "What AI model powers the content generation?",
    a: "We use Llama 3.3 70B via OpenRouter, one of the strongest open-source models available. It generates ATS-optimized bullet points tailored to your role.",
  },
  {
    q: "Can I get a refund?",
    a: "Yes — if you're not satisfied within 7 days of purchase, contact us for a full refund. No questions asked.",
  },
  {
    q: "What happens to my resumes if I don't upgrade?",
    a: "Your resumes stay safe forever on the free plan. You just won't have access to AI generation and detailed review breakdowns.",
  },
  {
    q: "Will I get future templates and features?",
    a: "Yes. Premium is lifetime — any new templates or features we ship are included at no extra cost.",
  },
];

export default function PricingPage() {
  const router      = useRouter();
  const { user, getIdToken }    = useAuth();
  const [upgrading, setUpgrading] = useState(false);
  const [openFaq,   setOpenFaq]   = useState<number | null>(null);

  async function handleUpgrade() {
    if (!user) {
      router.push("/register?redirect=/pricing");
      return;
    }
    if (user.isPremium) {
      toast.info("You already have Premium access!");
      return;
    }
    setUpgrading(true);
    try {
      const token = await getIdToken();
      if (!token) {
        toast.error("Session expired. Please sign in again.");
        return;
      }
      const res  = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }
      throw new Error(data.error ?? "Checkout failed");
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Could not start checkout.");
    } finally {
      setUpgrading(false);
    }
  }

  return (
    <>
      <style>{`
        .pricing-page { min-height: 100vh; position: relative; }

        /* Nav */
        .pricing-nav {
          position: sticky; top: 0; z-index: var(--z-sticky);
          height: var(--nav-height);
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 5vw;
          background: var(--bg-overlay); backdrop-filter: blur(18px);
          border-bottom: 1px solid var(--border);
        }
        .nav-logo { font-family: var(--font-display); font-size: 1.3rem; font-weight: 900; color: var(--text-primary); text-decoration: none; letter-spacing: -0.02em; }
        .nav-logo span { color: var(--gold); }

        /* Hero */
        .pricing-hero {
          text-align: center; padding: 80px 5vw 60px;
          max-width: 700px; margin: 0 auto;
        }
        .pricing-hero h1 { margin-bottom: var(--space-4); }
        .pricing-hero p  { font-size: var(--text-lg); color: var(--text-secondary); font-weight: 300; }

        /* Cards grid */
        .pricing-grid {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: var(--space-5); max-width: 800px;
          margin: 0 auto; padding: 0 5vw var(--space-16);
        }
        .plan-card {
          background: var(--bg-surface); border: 1px solid var(--border);
          border-radius: var(--radius-xl); padding: 2.5rem 2.2rem;
          transition: transform var(--duration-base), border-color var(--duration-base);
        }
        .plan-card:hover { transform: translateY(-4px); border-color: var(--border-hover); }
        .plan-card.featured {
          border-color: var(--gold-border);
          background: linear-gradient(145deg, var(--bg-surface) 0%, rgba(201,168,76,.05) 100%);
          position: relative;
        }
        .featured-badge {
          position: absolute; top: -12px; left: 50%; transform: translateX(-50%);
          background: var(--gold); color: #080d14;
          font-size: var(--text-xs); font-weight: 700; letter-spacing: 0.05em;
          padding: 3px 16px; border-radius: var(--radius-full); white-space: nowrap;
        }
        .plan-name  { font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.12em; color: var(--text-secondary); margin-bottom: var(--space-3); }
        .plan-price { font-family: var(--font-display); font-size: 3rem; font-weight: 900; color: var(--text-primary); line-height: 1; margin-bottom: var(--space-2); }
        .plan-price sup { font-size: 1.2rem; vertical-align: top; margin-top: 8px; display: inline-block; }
        .plan-sub   { font-size: var(--text-sm); color: var(--text-secondary); margin-bottom: var(--space-6); }
        .plan-features { list-style: none; display: flex; flex-direction: column; gap: var(--space-3); margin-bottom: var(--space-6); }
        .plan-feature { display: flex; align-items: flex-start; gap: var(--space-2); font-size: var(--text-sm); color: var(--text-secondary); }
        .feature-check { flex-shrink: 0; margin-top: 1px; }
        .feature-check.yes { color: var(--gold); }
        .feature-check.no  { color: var(--text-disabled); }
        .feature-label.no  { opacity: 0.4; }

        /* Guarantee strip */
        .guarantee {
          text-align: center; padding: 0 5vw var(--space-16);
        }
        .guarantee-inner {
          display: inline-flex; align-items: center; gap: var(--space-3);
          background: var(--bg-surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: var(--space-4) var(--space-6);
          font-size: var(--text-sm); color: var(--text-secondary);
        }
        .guarantee-icon { font-size: 1.4rem; }

        /* FAQ */
        .faq-section { max-width: 680px; margin: 0 auto; padding: 0 5vw var(--space-20); }
        .faq-title { font-family: var(--font-display); font-size: var(--text-3xl); font-weight: 700; color: var(--text-primary); text-align: center; margin-bottom: var(--space-10); }
        .faq-item { border-bottom: 1px solid var(--border); }
        .faq-q {
          display: flex; align-items: center; justify-content: space-between;
          padding: var(--space-5) 0; cursor: pointer;
          font-size: var(--text-md); font-weight: 500; color: var(--text-primary);
          background: none; border: none; width: 100%; text-align: left;
          transition: color var(--duration-fast);
        }
        .faq-q:hover { color: var(--gold); }
        .faq-a { font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.7; padding-bottom: var(--space-5); }

        @media (max-width: 640px) {
          .pricing-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="bg-mesh" />
      <div className="bg-grain" />

      <div className="pricing-page">

        {/* Nav */}
        <nav className="pricing-nav">
          <Link href="/" className="nav-logo">Resu<span>fii</span></Link>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
            {user ? (
              <Link href="/dashboard" className="btn btn-secondary btn-sm">Dashboard</Link>
            ) : (
              <>
                <Link href="/login"    className="btn btn-ghost btn-sm">Sign In</Link>
                <Link href="/register" className="btn btn-primary btn-sm">Get Started Free</Link>
              </>
            )}
          </div>
        </nav>

        {/* Hero */}
        <div className="pricing-hero">
          <p className="eyebrow" style={{ marginBottom: "var(--space-3)" }}>Pricing</p>
          <h1>Simple, honest pricing.</h1>
          <p>Start free. Upgrade once for lifetime access — no subscriptions, no monthly fees, no surprises.</p>
        </div>

        {/* Plans */}
        <div className="pricing-grid">

          {/* Free */}
          <div className="plan-card">
            <p className="plan-name">Free</p>
            <div className="plan-price"><sup>₹</sup>0</div>
            <p className="plan-sub">Forever free. No credit card needed.</p>
            <ul className="plan-features">
              {FREE_FEATURES.map(f => (
                <li key={f.label} className="plan-feature">
                  <span className={`feature-check ${f.included ? "yes" : "no"}`}>
                    {f.included ? "✓" : "✕"}
                  </span>
                  <span className={`feature-label${f.included ? "" : " no"}`}>{f.label}</span>
                </li>
              ))}
            </ul>
            <Link
              href={user ? "/dashboard" : "/register"}
              className="btn btn-secondary"
              style={{ width: "100%", justifyContent: "center" }}
            >
              {user ? "Go to Dashboard" : "Get started free"}
            </Link>
          </div>

          {/* Premium */}
          <div className="plan-card featured">
            <div className="featured-badge">✦ LIFETIME DEAL</div>
            <p className="plan-name">Premium</p>
            <div className="plan-price"><sup>$</sup>2</div>
            <p className="plan-sub">One-time payment. Access forever.</p>
            <ul className="plan-features">
              {PREMIUM_FEATURES.map(f => (
                <li key={f.label} className="plan-feature">
                  <span className="feature-check yes">✓</span>
                  <span className="feature-label">{f.label}</span>
                </li>
              ))}
            </ul>
            {user?.isPremium ? (
              <div
                className="btn btn-secondary"
                style={{ width: "100%", justifyContent: "center", textAlign: "center" }}
              >
                ✓ You have Premium
              </div>
            ) : (
              <button
                className={`btn btn-primary${upgrading ? " btn-loading" : ""}`}
                style={{ width: "100%", justifyContent: "center" }}
                onClick={handleUpgrade}
                disabled={upgrading}
              >
                {upgrading ? "" : "Get lifetime access →"}
              </button>
            )}
          </div>
        </div>

        {/* Guarantee */}
        <div className="guarantee">
          <div className="guarantee-inner">
            <span className="guarantee-icon">🛡️</span>
            <span>
              <strong style={{ color: "var(--text-primary)" }}>7-day money-back guarantee.</strong>
              {" "}Not happy? Get a full refund — no questions asked.
            </span>
          </div>
        </div>

        {/* FAQ */}
        <div className="faq-section">
          <h2 className="faq-title">Frequently asked questions</h2>
          {FAQ.map((item, i) => (
            <div key={i} className="faq-item">
              <button
                className="faq-q"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                {item.q}
                <svg
                  width="16" height="16" viewBox="0 0 16 16" fill="none"
                  style={{ transform: openFaq === i ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}
                >
                  <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              {openFaq === i && <p className="faq-a">{item.a}</p>}
            </div>
          ))}
        </div>

      </div>
    </>
  );
}