import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from './router';
import { useAuth } from './auth/AuthContext';
import { useMonitoring } from './monitoring/MonitoringContext';
import './Sidebar.css';

const icons = {
  dashboard: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  analytics:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  exercises:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 6.5l-3 3a1 1 0 0 0 0 1.4l9.6 9.6a1 1 0 0 0 1.4 0l3-3a1 1 0 0 0 0-1.4L8.9 6.5a1 1 0 0 0-1.4 0z"/><path d="M2 22l4-4"/><path d="M17.5 6.5l1-1a2 2 0 0 1 2.8 2.8l-1 1"/><path d="M14 3l1 1"/></svg>,
  live:       <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M5.7 5.7a9 9 0 0 0 0 12.6M18.3 5.7a9 9 0 0 1 0 12.6"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7"/></svg>,
  profile:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>,
  settings:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  admin:      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
  logout:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  menu:       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  close:      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
};

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard',    icon: 'dashboard' },
  { to: '/analytics', label: 'Analytics',    icon: 'analytics' },
  { to: '/exercises', label: 'Exercises',    icon: 'exercises' },
  { to: '/live',      label: 'Live Monitor', icon: 'live'      },
  { to: '/profile',   label: 'Profile',      icon: 'profile'   },
  { to: '/settings',  label: 'Settings',     icon: 'settings'  },
];

const postureColors = {
  good:              '#34d399',
  bad:               '#f87171',
  unclear:           '#fbbf24',
  camera_misaligned: '#fbbf24',
  out_of_position:   '#fbbf24',
  idle:              '#64748b',
};

const Layout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const { user, isAdmin, logout } = useAuth();
  const { isMonitoring, analysis } = useMonitoring();

  const navItems = isAdmin
    ? [...NAV_ITEMS, { to: '/admin', label: 'Admin', icon: 'admin' }]
    : NAV_ITEMS;

  const handleLogout = async () => {
    setMobileOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setMobileOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  const liveColor = postureColors[analysis.posture] || postureColors.idle;
  const liveLabel = (analysis.posture || 'idle').replaceAll('_', ' ');
  const initials  = (user?.name || 'U').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="tn-shell">

      {/* ── Top nav ── */}
      <header className="tn-bar">
        <div className="tn-bar-inner">

          {/* Logo */}
          <button className="tn-logo" onClick={() => navigate('/dashboard')} aria-label="Go to dashboard">
            <div className="tn-logo-mark">PG</div>
            <span className="tn-logo-name">PostureGuard</span>
          </button>

          {/* Nav links — desktop */}
          <nav className="tn-nav" aria-label="Main navigation">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `tn-link${isActive ? ' tn-link-active' : ''}`}
              >
                <span className="tn-link-icon">{icons[item.icon]}</span>
                <span className="tn-link-label">{item.label}</span>
                {item.to === '/live' && isMonitoring && (
                  <span className="tn-live-dot" style={{ background: liveColor }} />
                )}
              </NavLink>
            ))}
          </nav>

          {/* Right side */}
          <div className="tn-right">
            {isMonitoring && (
              <div className="tn-monitor-pill" style={{ '--lc': liveColor }}>
                <span className="tn-monitor-dot" />
                <span>{liveLabel}</span>
              </div>
            )}

            {/* User avatar + logout */}
            <div className="tn-user-group">
              <div className="tn-avatar" title={user?.name}>{initials}</div>
              <span className="tn-username">{user?.name?.split(' ')[0]}</span>
              <button className="tn-logout" onClick={handleLogout} title="Logout" aria-label="Logout">
                {icons.logout}
                <span>Logout</span>
              </button>
            </div>

            {/* Mobile hamburger */}
            <button className="tn-hamburger" onClick={() => setMobileOpen(p => !p)}
              aria-label="Open menu" aria-expanded={mobileOpen}>
              {mobileOpen ? icons.close : icons.menu}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <nav className="tn-mobile-menu" aria-label="Mobile navigation">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `tn-mobile-link${isActive ? ' tn-link-active' : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                <span className="tn-link-icon">{icons[item.icon]}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
            <button className="tn-mobile-logout" onClick={handleLogout}>
              {icons.logout} Logout
            </button>
          </nav>
        )}
      </header>

      {/* ── Page content ── */}
      <main className="tn-main">
        <Outlet />
      </main>

    </div>
  );
};

export default Layout;
