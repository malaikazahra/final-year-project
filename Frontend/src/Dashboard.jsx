import React, { useEffect, useState } from 'react';
import { useNavigate } from './router';
import './Dashboard.css';
import { ErrorState, PageLoader } from './components/StateBlocks';
import { useMonitoring } from './monitoring/MonitoringContext';
import { appService } from './services/appService';
import { formatSeconds, getScoreMessage } from './utils/formatters';

/* ── Score ring ──────────────────────────────────────────────────── */
const ScoreRing = ({ score = 0, size = 160 }) => {
  const r = (size - 20) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth="10" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s' }} />
      <text x={size / 2} y={size / 2 - 6} textAnchor="middle"
        fontSize="32" fontWeight="700" fill="var(--text)">{score}</text>
      <text x={size / 2} y={size / 2 + 16} textAnchor="middle"
        fontSize="12" fill="var(--muted)">/ 100</text>
    </svg>
  );
};

/* ── Stat card ───────────────────────────────────────────────────── */
const StatCard = ({ icon, label, value, sub, accent }) => (
  <div className="db-stat-card">
    <div className="db-stat-icon" style={{ color: accent }}>{icon}</div>
    <div className="db-stat-body">
      <div className="db-stat-value">{value}</div>
      <div className="db-stat-label">{label}</div>
      {sub ? <div className="db-stat-sub">{sub}</div> : null}
    </div>
  </div>
);

/* ── SVG icons ───────────────────────────────────────────────────── */
const IconSessions = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const IconScore = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a10 10 0 1 0 10 10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const IconTime = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const IconAlerts = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const IconPlay = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
);

const Dashboard = () => {
  const { isMonitoring } = useMonitoring();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadDashboard = async ({ silent = false } = {}) => {
    silent ? setIsRefreshing(true) : setIsLoading(true);
    setError('');
    try {
      setData(await appService.getDashboardData());
    } catch (e) {
      setError(e.message || 'Unable to load dashboard data.');
    } finally {
      silent ? setIsRefreshing(false) : setIsLoading(false);
    }
  };

  useEffect(() => { loadDashboard(); }, []);

  useEffect(() => {
    if (!isMonitoring) return undefined;
    const id = setInterval(() => loadDashboard({ silent: true }), 3000);
    return () => clearInterval(id);
  }, [isMonitoring]);

  if (isLoading) return <PageLoader message="Loading your dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={loadDashboard} />;

  const postureData = data?.postureData || {};
  const summary    = data?.summary    || {};
  const recentSessions = data?.recentSessions || [];
  const alerts = data?.alerts || [];
  const tips   = data?.tips   || [];

  const totalTime =
    (postureData.goodPostureTime       || 0) +
    (postureData.badPostureTime        || 0) +
    (postureData.unclearTime           || 0) +
    (postureData.cameraMisalignedTime  || 0) +
    (postureData.outOfPositionTime     || 0);

  const goodPct = totalTime ? Math.round((postureData.goodPostureTime / totalTime) * 100) : 0;
  const badPct  = totalTime ? Math.round((postureData.badPostureTime  / totalTime) * 100) : 0;
  const score   = postureData.postureScore || 0;
  const isActive = postureData.status === 'active';

  const scoreColor = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  const postureLabel = (postureData.currentPosture || 'idle').replaceAll('_', ' ');

  return (
    <div className="db-root">

      {/* ── Header ── */}
      <div className="db-header">
        <div>
          <h1 className="db-title">Posture Dashboard</h1>
          <p className="db-subtitle">Your posture health at a glance</p>
        </div>
        <div className="db-header-right">
          {isMonitoring ? (
            <div className="db-live-pill">
              <span className="db-live-dot" />
              Live{isRefreshing ? ' · updating' : ''}
            </div>
          ) : null}
          <button className="db-start-btn" onClick={() => navigate('/live')}>
            <IconPlay /> Start monitoring
          </button>
        </div>
      </div>

      {/* ── Stat strip ── */}
      <div className="db-stats-row">
        <StatCard icon={<IconSessions />} label="Total sessions" value={summary.totalSessions || 0}
          sub={summary.activeSessions ? `${summary.activeSessions} active now` : null}
          accent="#2563eb" />
        <StatCard icon={<IconScore />} label="Average score" value={`${summary.averageScore || 0}`}
          sub={`Latest: ${summary.latestCompletedScore || 0}/100`} accent="#06b6d4" />
        <StatCard icon={<IconTime />} label="Total monitored" value={formatSeconds(summary.totalMonitoredSeconds || 0)}
          accent="#8b5cf6" />
        <StatCard icon={<IconAlerts />} label="Alerts recorded" value={summary.alertCount || 0}
          accent="#f59e0b" />
      </div>

      {/* ── Main grid ── */}
      <div className="db-main-grid">

        {/* Left column */}
        <div className="db-col-left">

          {/* Score card */}
          <div className="db-card db-score-card">
            <div className="db-card-header">
              <span className="db-card-title">Posture health score</span>
              <span className="db-status-badge" style={{
                background: isActive ? 'rgba(16,185,129,0.12)' : 'rgba(148,163,184,0.12)',
                color: isActive ? '#34d399' : 'var(--muted)',
              }}>
                {isActive ? '● Live' : postureLabel}
              </span>
            </div>
            <div className="db-score-body">
              <ScoreRing score={score} />
              <div className="db-score-meta">
                <div className="db-score-msg" style={{ color: scoreColor }}>
                  {getScoreMessage(score)}
                </div>
                <div className="db-score-detail">
                  {isActive ? 'Monitoring in progress' : 'From your last session'}
                </div>
              </div>
            </div>
          </div>

          {/* Time breakdown */}
          <div className="db-card">
            <div className="db-card-header">
              <span className="db-card-title">Session breakdown</span>
            </div>
            <div className="db-breakdown">
              <div className="db-breakdown-bar">
                <div className="db-bar-fill db-bar-good" style={{ width: `${goodPct}%` }} />
                <div className="db-bar-fill db-bar-bad"  style={{ width: `${badPct}%`  }} />
              </div>
              <div className="db-breakdown-legend">
                <span className="db-legend-dot db-dot-good" /><span>{goodPct}% good</span>
                <span className="db-legend-dot db-dot-bad"  /><span>{badPct}% bad</span>
              </div>
              <div className="db-metrics-list">
                {[
                  { label: 'Good posture',     value: formatSeconds(postureData.goodPostureTime      || 0), cls: 'good' },
                  { label: 'Bad posture',      value: formatSeconds(postureData.badPostureTime       || 0), cls: 'bad'  },
                  { label: 'Unclear',          value: formatSeconds(postureData.unclearTime          || 0), cls: ''     },
                  { label: 'Camera warnings',  value: formatSeconds(postureData.cameraMisalignedTime || 0), cls: ''     },
                  { label: 'Session duration', value: formatSeconds(postureData.totalDuration        || 0), cls: ''     },
                ].map((m) => (
                  <div key={m.label} className="db-metric-row">
                    <span className="db-metric-label">{m.label}</span>
                    <span className={`db-metric-val ${m.cls}`}>{m.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="db-col-right">

          {/* Recent sessions */}
          <div className="db-card">
            <div className="db-card-header">
              <span className="db-card-title">Recent sessions</span>
            </div>
            {recentSessions.length ? (
              <div className="db-sessions-list">
                {recentSessions.map((s) => {
                  const sc = s.score || 0;
                  const c  = sc >= 75 ? '#10b981' : sc >= 50 ? '#f59e0b' : '#ef4444';
                  return (
                    <div key={s.id} className="db-session-row">
                      <div className="db-session-score-ring">
                        <svg width="44" height="44" viewBox="0 0 44 44">
                          <circle cx="22" cy="22" r="17" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4"/>
                          <circle cx="22" cy="22" r="17" fill="none" stroke={c} strokeWidth="4"
                            strokeLinecap="round"
                            strokeDasharray={2 * Math.PI * 17}
                            strokeDashoffset={2 * Math.PI * 17 * (1 - sc / 100)}
                            transform="rotate(-90 22 22)" />
                          <text x="22" y="26" textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--text)">{sc}</text>
                        </svg>
                      </div>
                      <div className="db-session-info">
                        <div className="db-session-date">{s.date}</div>
                        <div className="db-session-dur">{s.duration} monitored{s.status === 'active' ? ' · active' : ''}</div>
                      </div>
                      <div className="db-session-badge" style={{ color: c, background: `${c}18` }}>
                        {sc >= 75 ? 'Good' : sc >= 50 ? 'Fair' : 'Poor'}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="db-empty">No sessions yet. Start monitoring to build your history.</div>
            )}
          </div>

          {/* Alerts */}
          <div className="db-card">
            <div className="db-card-header">
              <span className="db-card-title">Live alerts</span>
              {alerts.length ? <span className="db-count-badge">{alerts.length}</span> : null}
            </div>
            {alerts.length ? (
              <div className="db-alerts-list">
                {alerts.map((a) => (
                  <div key={a.id} className={`db-alert db-alert-${a.type}`}>
                    <span className="db-alert-dot" />
                    <span className="db-alert-msg">{a.message}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="db-empty db-empty-good">
                <span>All clear — no alerts right now.</span>
              </div>
            )}
          </div>

          {/* Tips */}
          {tips.length ? (
            <div className="db-card">
              <div className="db-card-header">
                <span className="db-card-title">Posture tips</span>
              </div>
              <div className="db-tips-list">
                {tips.map((tip) => (
                  <div key={tip.id} className="db-tip-row">
                    <div className="db-tip-num">{tip.id}</div>
                    <div>
                      <div className="db-tip-title">{tip.title}</div>
                      <div className="db-tip-text">{tip.text}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

        </div>
      </div>
    </div>
  );
};

export default Dashboard;
