import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from './router';
import { useAuth } from './auth/AuthContext';

const EyeIcon = ({ open }) => open ? (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
) : (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, login, register, setAuthError } = useAuth();

  const [mode, setMode]         = useState('login');
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [info, setInfo]         = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { if (location.state?.signup) setMode('signup'); }, [location.state]);
  useEffect(() => {
    if (isAuthenticated) navigate(location.state?.from?.pathname || '/dashboard', { replace: true });
  }, [isAuthenticated, location.state, navigate]);

  const resetMessages = () => { setError(''); setInfo(''); setAuthError(''); };

  const switchMode = (m) => {
    setMode(m); resetMessages();
    if (m === 'login') { setName(''); setConfirm(''); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); resetMessages();
    if (mode === 'signup') {
      if (!name.trim() || !email.trim() || !password.trim() || !confirm.trim()) { setError('Please fill in all fields.'); return; }
      if (password !== confirm) { setError('Passwords do not match.'); return; }
    } else if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.'); return;
    }
    setIsSubmitting(true);
    try {
      await (mode === 'login' ? login : register)({ name, email, password });
      navigate(location.state?.from?.pathname || '/dashboard', { replace: true });
    } catch (err) {
      const details = err.response?.data?.details;
      setError(
        (details ? Object.values(details).join(' ') : null) ||
        err.response?.data?.error || err.message || 'Unable to complete your request.'
      );
    } finally { setIsSubmitting(false); }
  };

  const isLogin = mode === 'login';

  return (
    <div className="au-wrap">
      <div className="au-card">
        {/* Logo */}
        <div className="au-logo">
          <div className="au-logo-mark">PG</div>
          <span className="au-logo-name">PostureGuard</span>
        </div>

        {/* Heading */}
        <h2 className="au-heading">{isLogin ? 'Welcome back' : 'Create your account'}</h2>
        <p className="au-subheading">
          {isLogin
            ? 'Sign in to continue monitoring your posture.'
            : 'Start your posture health journey — it\'s free.'}
        </p>

        {error && <div className="au-alert au-alert-error" style={{ marginBottom: 14 }}>{error}</div>}
        {info  && <div className="au-alert au-alert-success" style={{ marginBottom: 14 }}>{info}</div>}

        <form className="au-form" onSubmit={handleSubmit} noValidate>
          {!isLogin && (
            <div className="au-field">
              <label className="au-label" htmlFor="au-name">Full name</label>
              <input id="au-name" className="au-input" type="text" placeholder="Ayesha Khan"
                value={name} onChange={e => setName(e.target.value)} autoComplete="name" />
            </div>
          )}

          <div className="au-field">
            <label className="au-label" htmlFor="au-email">Email address</label>
            <input id="au-email" className="au-input" type="email" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
          </div>

          <div className="au-field">
            <label className="au-label" htmlFor="au-pw">Password</label>
            <div className="au-input-wrap">
              <input id="au-pw" className="au-input" type={showPw ? 'text' : 'password'}
                placeholder={isLogin ? 'Enter your password' : 'At least 6 characters'}
                value={password} onChange={e => setPassword(e.target.value)}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                style={{ paddingRight: 40 }} />
              <button type="button" className="au-input-icon" onClick={() => setShowPw(p => !p)} tabIndex={-1}>
                <EyeIcon open={showPw} />
              </button>
            </div>
          </div>

          {isLogin && (
            <div className="au-forgot">
              <button type="button" className="au-link" onClick={() => navigate('/forgot-password')}>
                Forgot password?
              </button>
            </div>
          )}

          {!isLogin && (
            <div className="au-field">
              <label className="au-label" htmlFor="au-confirm">Confirm password</label>
              <input id="au-confirm" className="au-input" type="password" placeholder="Repeat your password"
                value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" />
            </div>
          )}

          <button type="submit" className="au-submit" disabled={isSubmitting}>
            {isSubmitting ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="au-footer">
          {isLogin ? (
            <>Don't have an account? <button type="button" className="au-link" onClick={() => switchMode('signup')}>Sign up free</button></>
          ) : (
            <>Already have an account? <button type="button" className="au-link" onClick={() => switchMode('login')}>Sign in</button></>
          )}
        </div>

        {!isLogin && (
          <p className="au-terms">
            By creating an account you agree to our Terms of Service and Privacy Policy.
          </p>
        )}
      </div>
    </div>
  );
};

export default Login;
