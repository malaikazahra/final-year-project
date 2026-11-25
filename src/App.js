import React, { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from './router';
import Admin from './Admin';
import Analytics from './Analytics';
import Landing from './Landing';
import { AuthProvider } from './auth/AuthContext';
import { AdminRoute, ProtectedRoute } from './components/RouteGuards';
import Dashboard from './Dashboard';
import Exercises from './Exercises';
import ForgotPassword from './ForgotPassword.jsx';
import Layout from './Layout';
import LiveMonitor from './LiveMonitor';
import Login from './Login';
import { MonitoringProvider } from './monitoring/MonitoringContext';
import Profile from './Profile';
import ResetPassword from './ResetPassword';
import Settings from './Settings';
import Splash from './Splash';

function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const handler = (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const ripple = document.createElement('span');
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      ripple.className = 'ripple';
      ripple.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px`;
      btn.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove());
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  useEffect(() => {
    const timerId = setTimeout(() => setShowSplash(false), 1200);
    return () => clearTimeout(timerId);
  }, []);

  if (showSplash) return <Splash />;

  return (
    <AuthProvider>
      <MonitoringProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/exercises" element={<Exercises />} />
                <Route path="/live" element={<LiveMonitor />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/profile" element={<Profile />} />
              </Route>
            </Route>

            <Route element={<AdminRoute />}>
              <Route element={<Layout />}>
                <Route path="/admin" element={<Admin />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </MonitoringProvider>
    </AuthProvider>
  );
}

export default App;
