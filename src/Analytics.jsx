import React, { useEffect, useState } from 'react';
import { EmptyState, ErrorState, PageLoader } from './components/StateBlocks';
import { useMonitoring } from './monitoring/MonitoringContext';
import { appService } from './services/appService';
import { formatSeconds } from './utils/formatters';

const ScoreBar = ({ good, bad }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <div style={{ display: 'flex', height: 6, borderRadius: 100, overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
      <div style={{ width: `${good}%`, background: '#10b981', transition: 'width 0.6s ease' }} />
      <div style={{ width: `${bad}%`,  background: '#ef4444', transition: 'width 0.6s ease' }} />
    </div>
    <div style={{ display: 'flex', gap: 12, fontSize: '0.72rem' }}>
      <span style={{ color: '#10b981' }}>● {good}% good</span>
      <span style={{ color: '#ef4444' }}>● {bad}% bad</span>
    </div>
  </div>
);

const Analytics = () => {
  const { isMonitoring } = useMonitoring();
  const [timeRange, setTimeRange]   = useState('week');
  const [data, setData]             = useState(null);
  const [error, setError]           = useState('');
  const [isLoading, setIsLoading]   = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadAnalytics = async (range, { silent = false } = {}) => {
    silent ? setIsRefreshing(true) : setIsLoading(true);
    setError('');
    try {
      setData(await appService.getAnalyticsData(range));
    } catch (e) {
      setError(e.message || 'Unable to load analytics.');
    } finally {
      silent ? setIsRefreshing(false) : setIsLoading(false);
    }
  };

  useEffect(() => { loadAnalytics(timeRange); }, [timeRange]);
  useEffect(() => {
    if (!isMonitoring) return undefined;
    const id = setInterval(() => loadAnalytics(timeRange, { silent: true }), 4000);
    return () => clearInterval(id);
  }, [isMonitoring, timeRange]);

  if (isLoading) return <PageLoader message="Loading posture analytics..." />;
  if (error)     return <ErrorState message={error} onRetry={() => loadAnalytics(timeRange)} />;
  if (!data?.chartData?.length) return (
    <EmptyState title="No analytics yet" message="Complete a few posture sessions and your analytics will appear here." />
  );

  const summary = data.summary || {};
  const avgScore = summary.averageScore ?? Math.round(data.chartData.reduce((s, i) => s + i.score, 0) / data.chartData.length);
  const avgGood  = summary.averageGood  ?? Math.round(data.chartData.reduce((s, i) => s + i.good,  0) / data.chartData.length);
  const avgBad   = summary.averageBad   ?? Math.round(data.chartData.reduce((s, i) => s + i.bad,   0) / data.chartData.length);
  const scoreColor = avgScore >= 75 ? '#10b981' : avgScore >= 50 ? '#f59e0b' : '#ef4444';

  /* SVG line chart */
  const pts = data.chartData;
  const W = 300, H = 80, pad = 8;
  const xStep = pts.length > 1 ? (W - pad * 2) / (pts.length - 1) : 0;
  const yScale = (v) => H - pad - ((v / 100) * (H - pad * 2));
  const polyline = pts.map((p, i) => `${pad + i * xStep},${yScale(p.score)}`).join(' ');
  const area = `${pad},${H - pad} ` + pts.map((p, i) => `${pad + i * xStep},${yScale(p.score)}`).join(' ') + ` ${pad + (pts.length - 1) * xStep},${H - pad}`;

  return (
    <div className="pg-page">
      {/* Header */}
      <div className="pg-header">
        <div>
          <h1 className="pg-title">Posture Analytics</h1>
          <p className="pg-subtitle">Detailed posture reports and trends</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isMonitoring && (
            <div className="pg-live-pill">
              <span className="pg-live-dot" />
              Live{isRefreshing ? ' · updating' : ''}
            </div>
          )}
          <div className="pg-range-tabs">
            {['week', 'month'].map(r => (
              <button key={r} className={`pg-range-btn${timeRange === r ? ' pg-range-active' : ''}`}
                onClick={() => setTimeRange(r)}>
                {r === 'week' ? 'Weekly' : 'Monthly'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="pg-stats-row">
        {[
          { label: 'Average score',       value: avgScore,   unit: '/ 100',            color: scoreColor },
          { label: 'Avg good posture',     value: `${avgGood}%`, unit: 'per session',  color: '#10b981'  },
          { label: 'Avg bad posture',      value: `${avgBad}%`,  unit: 'per session',  color: '#ef4444'  },
          { label: 'Sessions in range',    value: summary.sessionCount || 0, unit: 'completed', color: '#2563eb' },
          { label: 'Best score',           value: summary.bestScore || 0, unit: 'highest',    color: '#06b6d4' },
          { label: 'Monitored time',       value: formatSeconds(summary.totalMonitoredSeconds || 0), unit: `${summary.alertCount || 0} alerts`, color: '#8b5cf6' },
        ].map(s => (
          <div key={s.label} className="pg-stat-card">
            <div className="pg-stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="pg-stat-label">{s.label}</div>
            <div className="pg-stat-unit">{s.unit}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="pg-two-col">
        {/* Bar chart */}
        <div className="pg-card">
          <div className="pg-card-header"><span className="pg-card-title">Good vs Bad Posture</span></div>
          <div className="pg-card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {data.chartData.map(item => (
                <div key={item.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--muted)' }}>{item.label}</span>
                    <span style={{ color: 'var(--text)', fontWeight: 600 }}>{item.score}/100</span>
                  </div>
                  <ScoreBar good={item.good} bad={item.bad} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Line chart */}
        <div className="pg-card">
          <div className="pg-card-header"><span className="pg-card-title">Posture score trend</span></div>
          <div className="pg-card-body">
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 120, overflow: 'visible' }}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#2563eb" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon points={area} fill="url(#areaGrad)" />
              <polyline points={polyline} fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {pts.map((p, i) => (
                <circle key={p.label} cx={pad + i * xStep} cy={yScale(p.score)} r="3" fill="#06b6d4" stroke="var(--bg-900)" strokeWidth="1.5" />
              ))}
            </svg>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 8 }}>
              {pts.map(p => (
                <span key={p.label} style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                  {p.label}: <strong style={{ color: 'var(--text)' }}>{p.score}</strong>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Session history table */}
      <div className="pg-card">
        <div className="pg-card-header"><span className="pg-card-title">Session history</span></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="pg-table">
            <thead>
              <tr>
                {['Date', 'Duration', 'Good time', 'Bad time', 'Score'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.sessions.map(s => {
                const sc = Number(s.score) || 0;
                const c  = sc >= 75 ? '#10b981' : sc >= 50 ? '#f59e0b' : '#ef4444';
                return (
                  <tr key={s.id}>
                    <td>{s.date}</td>
                    <td>{s.duration}</td>
                    <td><span className="pg-badge pg-badge-good">{s.goodTime}</span></td>
                    <td><span className="pg-badge pg-badge-bad">{s.badTime}</span></td>
                    <td><span style={{ fontWeight: 700, color: c }}>{s.score}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Insights */}
      <div className="pg-card">
        <div className="pg-card-header"><span className="pg-card-title">Insights &amp; recommendations</span></div>
        <div className="pg-card-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {data.insights.map(ins => (
              <div key={ins.id} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div className="pg-insight-num">{ins.id}</div>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>{ins.title}</div>
                  <div style={{ fontSize: '0.81rem', color: 'var(--muted)', lineHeight: 1.6 }}>{ins.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
