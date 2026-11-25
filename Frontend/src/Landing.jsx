import React, { useEffect, useRef } from 'react';
import { useNavigate } from './router';
import './Landing.css';

const FEATURES = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M6 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
        <path d="M19 6l1.5-1.5M5 6L3.5 4.5M12 2V0" />
      </svg>
    ),
    title: 'Real-time AI detection',
    desc: 'MediaPipe tracks your face, ears, and shoulders — 9 key landmarks — and flags bad posture the moment it happens.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
    title: 'Instant correction alerts',
    desc: 'Get notified within seconds when you slouch, hunch, or tilt — no waiting until your back already hurts.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </svg>
    ),
    title: 'Personalised exercises',
    desc: '21 clinically-informed exercises matched to your posture type — forward head, kyphosis, lordosis, sway back.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    title: 'Progress analytics',
    desc: 'Weekly charts of good vs bad posture time, posture score trends, and session history over time.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    title: '100% private',
    desc: 'All AI inference runs locally in your browser. No video is ever sent to any server.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4l3 3" />
      </svg>
    ),
    title: 'Works while you work',
    desc: 'Runs quietly in a browser tab. Keep working — PostureGuard watches so you don\'t have to.',
  },
];

const STEPS = [
  { n: '01', title: 'Create your free account', desc: 'Sign up in under 30 seconds. No credit card needed.' },
  { n: '02', title: 'Allow camera access', desc: 'PostureGuard uses your webcam — processed entirely on your device.' },
  { n: '03', title: 'Start a monitoring session', desc: 'Sit at your desk, click Start, and get real-time posture feedback.' },
  { n: '04', title: 'Do the recommended exercises', desc: 'After each session, follow exercises tailored to your posture type.' },
];

const STATS = [
  { value: '9', unit: 'landmarks', label: 'tracked per frame' },
  { value: '21', unit: 'exercises', label: 'clinically matched' },
  { value: '4', unit: 'posture types', label: 'detected & coached' },
  { value: '0', unit: 'MB uploaded', label: 'video stays local' },
];

export default function Landing() {
  const navigate = useNavigate();
  const heroRef = useRef(null);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const handler = (e) => {
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 18;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * -12;
      el.style.setProperty('--rx', `${y}deg`);
      el.style.setProperty('--ry', `${x}deg`);
    };
    el.addEventListener('mousemove', handler);
    return () => el.removeEventListener('mousemove', handler);
  }, []);

  return (
    <div className="lp-root">

      {/* ── NAV ── */}
      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <div className="lp-logo">
            <div className="lp-logo-mark">PG</div>
            <span className="lp-logo-name">PostureGuard</span>
          </div>
          <div className="lp-nav-links">
            <a href="#features" className="lp-nav-link">Features</a>
            <a href="#how" className="lp-nav-link">How it works</a>
            <button className="lp-btn-ghost" onClick={() => navigate('/login')}>Log in</button>
            <button className="lp-btn-primary" onClick={() => navigate('/login', { state: { signup: true } })}>Get started free</button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="lp-hero" ref={heroRef}>
        <div className="lp-hero-glow lp-glow-1" aria-hidden />
        <div className="lp-hero-glow lp-glow-2" aria-hidden />

        <div className="lp-hero-content">
          <div className="lp-badge">AI-powered · Browser-native · Free</div>
          <h1 className="lp-h1">
            Your posture coach,<br />
            <span className="lp-h1-accent">always watching</span>
          </h1>
          <p className="lp-hero-sub">
            PostureGuard uses your webcam and AI to detect bad posture in real time —
            then tells you exactly which exercises will fix it.
          </p>
          <div className="lp-hero-actions">
            <button className="lp-btn-primary lp-btn-lg" onClick={() => navigate('/login', { state: { signup: true } })}>
              Start monitoring free
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </button>
            <button className="lp-btn-ghost lp-btn-lg" onClick={() => navigate('/login')}>
              Already have an account
            </button>
          </div>
        </div>

        {/* mock monitor card */}
        <div className="lp-hero-visual">
          <div className="lp-monitor-card">
            <div className="lp-mc-header">
              <span className="lp-mc-dot lp-dot-red" />
              <span className="lp-mc-dot lp-dot-yellow" />
              <span className="lp-mc-dot lp-dot-green" />
              <span className="lp-mc-title">Live Monitor</span>
              <span className="lp-live-pill">● LIVE</span>
            </div>
            <div className="lp-mc-body">
              <div className="lp-skeleton-cam">
                <div className="lp-pose-figure">
                  {/* simple SVG stick person sitting upright */}
                  <svg viewBox="0 0 80 120" width="80" height="120" fill="none" stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="round">
                    <circle cx="40" cy="14" r="10" />
                    <line x1="40" y1="24" x2="40" y2="65" />
                    <line x1="40" y1="35" x2="18" y2="55" />
                    <line x1="40" y1="35" x2="62" y2="55" />
                    <line x1="40" y1="65" x2="26" y2="95" />
                    <line x1="40" y1="65" x2="54" y2="95" />
                    <line x1="26" y1="95" x2="22" y2="118" />
                    <line x1="54" y1="95" x2="58" y2="118" />
                  </svg>
                </div>
                <div className="lp-score-ring">
                  <svg viewBox="0 0 56 56" width="56" height="56">
                    <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
                    <circle cx="28" cy="28" r="22" fill="none" stroke="#06b6d4" strokeWidth="5"
                      strokeDasharray="138.2" strokeDashoffset="27.6" strokeLinecap="round"
                      transform="rotate(-90 28 28)" />
                    <text x="28" y="33" textAnchor="middle" fontSize="13" fontWeight="600" fill="#e7eef8">80%</text>
                  </svg>
                  <span className="lp-score-label">Score</span>
                </div>
              </div>
              <div className="lp-mc-alerts">
                <div className="lp-alert-row lp-alert-good">
                  <span className="lp-alert-dot" />
                  Good posture — keep it up!
                </div>
                <div className="lp-alert-row lp-alert-warn">
                  <span className="lp-alert-dot lp-dot-warn" />
                  Slight forward head — adjust
                </div>
              </div>
              <div className="lp-mc-exercise-hint">
                <span className="lp-ex-label">Recommended today</span>
                <span className="lp-ex-name">Chin Tucks · Doorway Chest Stretch</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS STRIP ── */}
      <section className="lp-stats-strip">
        {STATS.map((s) => (
          <div key={s.label} className="lp-stat-item">
            <span className="lp-stat-value">{s.value}<span className="lp-stat-unit"> {s.unit}</span></span>
            <span className="lp-stat-label">{s.label}</span>
          </div>
        ))}
      </section>

      {/* ── FEATURES ── */}
      <section className="lp-section" id="features">
        <div className="lp-section-inner">
          <p className="lp-overline">What you get</p>
          <h2 className="lp-h2">Everything your spine needs</h2>
          <div className="lp-features-grid">
            {FEATURES.map((f) => (
              <div key={f.title} className="lp-feature-card">
                <div className="lp-feature-icon">{f.icon}</div>
                <h3 className="lp-feature-title">{f.title}</h3>
                <p className="lp-feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="lp-section lp-section-alt" id="how">
        <div className="lp-section-inner">
          <p className="lp-overline">How it works</p>
          <h2 className="lp-h2">Up and running in 2 minutes</h2>
          <div className="lp-steps">
            {STEPS.map((s, i) => (
              <div key={s.n} className="lp-step">
                <div className="lp-step-num">{s.n}</div>
                <div className="lp-step-connector" aria-hidden={i === STEPS.length - 1} />
                <h3 className="lp-step-title">{s.title}</h3>
                <p className="lp-step-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="lp-cta-section">
        <div className="lp-cta-glow" aria-hidden />
        <h2 className="lp-cta-heading">Your back will thank you.</h2>
        <p className="lp-cta-sub">Free. Private. No credit card. Works in any browser.</p>
        <button className="lp-btn-primary lp-btn-lg lp-btn-cta" onClick={() => navigate('/login', { state: { signup: true } })}>
          Create your free account
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </button>
      </section>

      {/* ── FOOTER ── */}
      <footer className="lp-footer">
        <div className="lp-logo">
          <div className="lp-logo-mark lp-logo-mark-sm">PG</div>
          <span className="lp-logo-name">PostureGuard</span>
        </div>
        <p className="lp-footer-copy">Final Year Project · 2026</p>
      </footer>

    </div>
  );
}
