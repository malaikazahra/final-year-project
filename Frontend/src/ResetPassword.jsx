import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from './router';
import { authService } from './services/appService';

const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const token = useMemo(() => new URLSearchParams(location.search).get('token') || '', [location.search]);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!token) {
      setError('Reset token is missing. Please request a new reset link.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      const response = await authService.resetPassword({ token, password });
      setSuccess(response.message || 'Password reset successfully. You can sign in now.');
      setPassword('');
      setConfirm('');
    } catch (resetError) {
      setError(resetError.response?.data?.error || resetError.message || 'Unable to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="auth-card" style={{ width: '100%', maxWidth: 520, padding: 26, borderRadius: 12, background: 'var(--card-bg)', color: 'var(--text)', border: '1px solid rgba(148,163,184,0.12)' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 22, color: 'var(--text)' }}>Reset password</h2>
        <p style={{ margin: '0 0 16px', color: 'var(--muted)' }}>
          Enter your new password. Reset links expire after 15 minutes.
        </p>

        <form onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}

          <div className="auth-field" style={{ marginTop: 12 }}>
            <label htmlFor="rp-password">New password</label>
            <input
              id="rp-password"
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
            />
          </div>

          <div className="auth-field" style={{ marginTop: 12 }}>
            <label htmlFor="rp-confirm">Confirm password</label>
            <input
              id="rp-confirm"
              type="password"
              placeholder="Repeat new password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="new-password"
            />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button type="submit" className="auth-button" disabled={loading}>
              {loading ? 'Resetting...' : 'Reset password'}
            </button>
            <button
              type="button"
              className="auth-button"
              style={{ background: 'transparent', color: 'var(--muted)', border: '1px solid rgba(148,163,184,0.15)' }}
              onClick={() => navigate('/login')}
            >
              Back to sign in
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
