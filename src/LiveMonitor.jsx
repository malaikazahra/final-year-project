import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useMonitoring } from './monitoring/MonitoringContext';

const POSTURE_COLORS = {
  good:              '#10b981',
  bad:               '#ef4444',
  unclear:           '#f59e0b',
  camera_misaligned: '#f59e0b',
  out_of_position:   '#f59e0b',
  idle:              '#64748b',
};

const TIPS = [
  'Sit with your back straight and shoulders relaxed, not hunched.',
  'Position your monitor at eye level so your neck stays neutral.',
  'Take a 30-second stretch break every 30 minutes.',
  'Your feet should rest flat on the floor or a footrest.',
];

const fmt = (s) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
};

const ScoreRing = ({ score }) => {
  const r = 28, C = 2 * Math.PI * r;
  const fill = C - (C * (score || 0)) / 100;
  const color = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
      <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6"
        strokeLinecap="round" strokeDasharray={C} strokeDashoffset={fill}
        transform="rotate(-90 36 36)" style={{ transition: 'stroke-dashoffset 0.7s ease' }} />
      <text x="36" y="40" textAnchor="middle" fill={color} fontSize="14" fontWeight="700">{score || 0}</text>
    </svg>
  );
};

const SetupCheck = ({ label, status, detail }) => (
  <div className={`lm-setup-check lm-setup-${status}`}>
    <span className="lm-setup-icon">
      {status === 'ok' ? 'OK' : status === 'warn' ? '!' : '...'}
    </span>
    <span>
      <strong>{label}</strong>
      <small>{detail}</small>
    </span>
  </div>
);

const SESSION_DURATIONS = [
  { label: '15 min',  value: 15 * 60 },
  { label: '30 min',  value: 30 * 60 },
  { label: '45 min',  value: 45 * 60 },
  { label: '1 hour',  value: 60 * 60 },
  { label: '2 hours', value: 120 * 60 },
  { label: 'Custom',  value: 'custom' },
  { label: 'Never',   value: null },
];

const LiveMonitor = () => {
  const {
    error, cameraAllowed, isSaving, analysis,
    isInitializing, isMonitoring, recoveryMessage,
    registerPreviewVideo, handleCameraToggle,
    startMonitoring, stopMonitoring,
    isCalibrating, calibrationProgress, calibrationBaseline,
    calibrationMessage, startCalibration, clearCalibration,
  } = useMonitoring();

  const previewRef = useRef(null);
  const timerRef = useRef(null);

  const [sessionLimit, setSessionLimit] = useState(null);
  const [customMinutes, setCustomMinutes] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [remaining, setRemaining] = useState(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const handleDurationSelect = (value) => {
    if (value === 'custom') {
      setShowCustom(true);
      setSessionLimit(null);
    } else {
      setShowCustom(false);
      setCustomMinutes('');
      setSessionLimit(value);
    }
  };

  const applyCustom = () => {
    const mins = parseInt(customMinutes, 10);
    if (mins > 0) {
      setSessionLimit(mins * 60);
      setShowCustom(false);
    }
  };

  const handleStart = useCallback(() => {
    setSessionExpired(false);
    startMonitoring();
  }, [startMonitoring]);

  const handleStop = useCallback(() => {
    setRemaining(null);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    stopMonitoring();
  }, [stopMonitoring]);

  useEffect(() => {
    if (!isMonitoring || sessionLimit == null) {
      setRemaining(null);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }
    const endTime = Date.now() + sessionLimit * 1000;
    setRemaining(sessionLimit);
    timerRef.current = setInterval(() => {
      const left = Math.max(0, Math.round((endTime - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        setSessionExpired(true);
        stopMonitoring();
      }
    }, 1000);
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [isMonitoring, sessionLimit, stopMonitoring]);

  useEffect(() => {
    if (!cameraAllowed) return undefined;
    registerPreviewVideo(previewRef.current).catch(() => {});
    return () => { registerPreviewVideo(null).catch(() => {}); };
  }, [registerPreviewVideo, cameraAllowed]);

  const monitoringDisplayActive = isMonitoring || isCalibrating;
  const displayPosture = monitoringDisplayActive ? (analysis.posture || 'idle') : 'idle';
  const displayScore = monitoringDisplayActive ? (analysis.postureScore || 0) : 0;
  const displayColor = POSTURE_COLORS[displayPosture] || POSTURE_COLORS.idle;
  const postureLabel = displayPosture.replaceAll('_', ' ');
  const visibleIssues = monitoringDisplayActive && analysis.posture !== 'good' ? (analysis.issues || []) : [];

  const goodPct = Math.round((analysis.goodPercent || 0));
  const badPct  = 100 - goodPct;


  const metrics = monitoringDisplayActive ? analysis.metrics : null;
  const hasMetrics = Boolean(metrics);
  const setupChecks = [
    {
      label: 'Face and shoulders',
      status: !cameraAllowed || !hasMetrics ? 'wait' : analysis.visibilityIssue ? 'warn' : 'ok',
      detail: !cameraAllowed
        ? 'Turn camera on'
        : !hasMetrics
          ? 'Waiting for landmarks'
          : analysis.visibilityIssue
            ? 'Improve light or sit centered'
            : 'Visible clearly',
    },
    {
      label: 'Distance',
      status: !cameraAllowed || !hasMetrics ? 'wait' : analysis.deskPositionIssue ? 'warn' : 'ok',
      detail: !cameraAllowed
        ? 'Turn camera on'
        : !hasMetrics
          ? 'Checking frame size'
          : analysis.deskPositionIssue
            ? 'Move closer or farther until shoulders fill the frame'
            : 'Good framing',
    },
    {
      label: 'Posture baseline',
      status: !cameraAllowed || !hasMetrics ? 'wait' : analysis.posture === 'good' && (analysis.postureScore || 0) >= 75 ? 'ok' : 'warn',
      detail: !cameraAllowed
        ? 'Turn camera on'
        : !hasMetrics
          ? 'Waiting for posture score'
          : analysis.posture === 'good' && (analysis.postureScore || 0) >= 75
            ? 'Ready to calibrate'
            : 'Sit tall before calibration',
    },
  ];
  const setupReady = setupChecks.every((check) => check.status === 'ok');
  const setupStatusText = setupReady
    ? 'Setup looks good. Calibration can save this as your baseline.'
    : 'Fix the highlighted setup checks, then start calibration.';

  return (
    <div className="lm-page">
      {/* Header */}
      <div className="pg-header">
        <div>
          <h1 className="pg-title">Live Monitor</h1>
          <p className="pg-subtitle">Real-time posture analysis via your webcam</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {isMonitoring && (
            <div className="pg-live-pill">
              <span className="pg-live-dot" />
              Monitoring
            </div>
          )}
          {/* Camera toggle */}
          <label className="st-toggle" title={cameraAllowed ? 'Disable camera' : 'Enable camera'}>
            <input type="checkbox" checked={cameraAllowed} onChange={handleCameraToggle} />
            <span className="st-toggle-track">
              <span className="st-toggle-thumb" />
            </span>
          </label>
          <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
            {isSaving ? 'Saving…' : cameraAllowed ? 'Camera on' : 'Camera off'}
          </span>
        </div>
      </div>

      {error         && <div className="pg-alert pg-alert-error">{error}</div>}
      {recoveryMessage && <div className="pg-alert pg-alert-info">{recoveryMessage}</div>}

      {/* Main two-column layout */}
      <div className="lm-two-col">

        {/* LEFT — Camera feed */}
        <div className="lm-card">
          <div className="lm-card-header">
            <span className="lm-card-title">Webcam feed</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
              Video is processed locally — never uploaded
            </span>
          </div>
          <div className="lm-video-wrap">
            {cameraAllowed ? (
              <>
                <video ref={previewRef} autoPlay playsInline muted className="lm-video" />
                <div className="lm-posture-badge">
                  <span className="lm-posture-dot" style={{ background: displayColor }} />
                  <span style={{ color: displayColor, textTransform: 'capitalize' }}>{postureLabel}</span>
                </div>
              </>
            ) : (
              <div className="lm-video-overlay">
                <div className="lm-overlay-icon">📷</div>
                <div className="lm-overlay-text">
                  Camera is disabled.<br />Enable it using the toggle above.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Controls + stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Score + controls */}
          <div className="lm-card">
            <div className="lm-card-header">
              <span className="lm-card-title">Session controls</span>
              {remaining != null && isMonitoring && (
                <span className={`pg-badge ${remaining <= 60 ? 'pg-badge-bad' : 'pg-badge-good'}`}>
                  {fmt(remaining)} left
                </span>
              )}
            </div>
            <div className="lm-card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                <ScoreRing score={displayScore} />
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>
                    Posture score
                  </div>
                  {!monitoringDisplayActive && cameraAllowed && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 4 }}>
                      Camera setup checks are active. Press Start Monitoring to begin a session.
                    </div>
                  )}
                </div>
              </div>

              {sessionExpired && (
                <div className="pg-alert pg-alert-info" style={{ marginBottom: 14 }}>
                  Session ended — your privacy is protected. Start a new session anytime.
                </div>
              )}

              {!isMonitoring && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
                    Session duration
                  </div>
                  <div className="lm-duration-grid">
                    {SESSION_DURATIONS.map(d => (
                      <button key={d.label}
                        className={`lm-duration-chip${sessionLimit === d.value && d.value !== 'custom' ? ' lm-duration-active' : ''}${d.value === 'custom' && showCustom ? ' lm-duration-active' : ''}`}
                        onClick={() => handleDurationSelect(d.value)}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                  {showCustom && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <input type="number" min="1" placeholder="Minutes"
                        value={customMinutes} onChange={e => setCustomMinutes(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && applyCustom()}
                        className="lm-custom-input" />
                      <button className="lm-btn lm-btn-start" onClick={applyCustom}
                        disabled={!customMinutes || parseInt(customMinutes, 10) <= 0}>
                        Set
                      </button>
                    </div>
                  )}
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 6 }}>
                    {sessionLimit ? `Session will auto-stop after ${fmt(sessionLimit)} for your privacy.`
                      : 'No time limit — session runs until you stop it manually.'}
                  </div>
                </div>
              )}

              <div className="lm-controls">
                <button className="lm-btn lm-btn-start" onClick={handleStart}
                  disabled={!cameraAllowed || isInitializing || isMonitoring}>
                  ▶ Start
                </button>
                <button className="lm-btn lm-btn-stop" onClick={handleStop}
                  disabled={!isMonitoring}>
                  ■ Stop
                </button>
                <button className="lm-btn lm-btn-camera" onClick={handleCameraToggle}>
                  {cameraAllowed ? '🔴 Disable camera' : '📷 Enable camera'}
                </button>
              </div>
            </div>
          </div>

          {/* Live metrics */}
          <div className="lm-card">
            <div className="lm-card-header"><span className="lm-card-title">Live metrics</span></div>
            <div className="lm-card-body">
              <div className="lm-stats-grid">
                {[
                  { label: 'Shoulder tilt',  value: metrics?.shoulderTilt       ?? '—' },
                  { label: 'Head offset',    value: metrics?.headCenterOffset    ?? '—' },
                  { label: 'Neck ratio',     value: metrics?.neckHeightRatio     ?? '—' },
                  { label: 'Face balance',   value: metrics?.faceBalance         ?? '—' },
                ].map(m => (
                  <div key={m.label} className="lm-stat">
                    <div className="lm-stat-value">{m.value}</div>
                    <div className="lm-stat-label">{m.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Session stats */}
          {isMonitoring && (
            <div className="lm-card">
              <div className="lm-card-header"><span className="lm-card-title">Session stats</span></div>
              <div className="lm-card-body">
                <div className="lm-stats-grid">
                  <div className="lm-stat">
                    <div className="lm-stat-value" style={{ color: '#10b981' }}>{goodPct}%</div>
                    <div className="lm-stat-label">Good posture</div>
                  </div>
                  <div className="lm-stat">
                    <div className="lm-stat-value" style={{ color: '#ef4444' }}>{badPct}%</div>
                    <div className="lm-stat-label">Bad posture</div>
                  </div>
                  <div className="lm-stat">
                    <div className="lm-stat-value">{analysis.sessionDuration ? fmt(analysis.sessionDuration) : '—'}</div>
                    <div className="lm-stat-label">Duration</div>
                  </div>
                  <div className="lm-stat">
                    <div className="lm-stat-value">{analysis.alertCount || 0}</div>
                    <div className="lm-stat-label">Alerts</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="lm-two-col">

        {/* Calibration */}
        <div className="lm-card">
          <div className="lm-card-header">
            <span className="lm-card-title">Calibration setup assistant</span>
            <span className={`pg-badge ${calibrationBaseline ? 'pg-badge-good' : 'pg-badge-bad'}`}>
              {calibrationBaseline ? 'Active' : 'Not set'}
            </span>
          </div>
          <div className="lm-card-body">
            <div className={`lm-setup-banner ${setupReady ? 'ready' : ''}`}>
              <strong>{setupReady ? 'Ready for calibration' : 'Setup check'}</strong>
              <span>{setupStatusText}</span>
            </div>
            <div className="lm-setup-grid">
              {setupChecks.map((check) => (
                <SetupCheck key={check.label} {...check} />
              ))}
            </div>
            <p style={{ fontSize: '0.83rem', color: 'var(--muted)', marginBottom: 12, lineHeight: 1.6 }}>
              {calibrationMessage || 'Calibrate for your specific posture baseline to improve accuracy.'}
            </p>
            {calibrationBaseline && (
              <div className="lm-baseline-card">
                <span>Saved baseline</span>
                <strong>
                  Shoulder width {calibrationBaseline.shoulderWidth ?? '—'} · face frame {calibrationBaseline.faceFrameOffset ?? '—'}
                </strong>
              </div>
            )}
            {isCalibrating && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: '0.78rem', color: 'var(--muted)' }}>
                  <span>Collecting baseline…</span>
                  <span>{calibrationProgress}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 100, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${calibrationProgress}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent-2))', transition: 'width 0.3s ease', borderRadius: 100 }} />
                </div>
              </div>
            )}
            <div className="lm-controls">
              <button className="lm-btn lm-btn-start" onClick={startCalibration}
                disabled={!cameraAllowed || isInitializing || isCalibrating || !setupReady}>
                {isCalibrating ? 'Calibrating…' : 'Start calibration'}
              </button>
              <button className="lm-btn lm-btn-stop" onClick={clearCalibration}
                disabled={!calibrationBaseline && !isCalibrating}>
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Live feedback */}
        <div className="lm-card">
          <div className="lm-card-header">
            <span className="lm-card-title">Live feedback</span>
          </div>
          <div className="lm-card-body">
            {visibleIssues.length > 0 ? (
              <div className="lm-alert-list">
                {visibleIssues.slice(0, 4).map(issue => (
                  <div key={issue} className="lm-alert-item">
                    <span className="lm-alert-dot" />
                    <span style={{ flex: 1 }}>{issue}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="lm-tips-list">
                {TIPS.map((tip, i) => (
                  <div key={i} className="lm-tip">
                    <div className="lm-tip-num">{i + 1}</div>
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveMonitor;
