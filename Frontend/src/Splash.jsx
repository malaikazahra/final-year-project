import React from 'react';

export default function Splash() {
  return (
    <div className="splash-root" role="presentation">
      <div className="splash-bg" aria-hidden>
        <span className="blob b1" />
        <span className="blob b2" />
        <span className="blob b3" />
      </div>

      <div className="splash-card" role="status" aria-live="polite">
        <div className="splash-mark-wrap">
          <div className="splash-mark">PG</div>
          <div className="splash-ring" aria-hidden />
        </div>

        <div className="splash-text">
          <h1 className="splash-title">PostureGuard</h1>
          <p className="splash-sub">Smart posture coaching with real-time corrections.</p>
        </div>

        <div className="splash-lottie">
          <div className="splash-lottie-fallback splash-loader-shell" />
          <span className="sr-only">Loading PostureGuard...</span>
        </div>
      </div>
    </div>
  );
}
