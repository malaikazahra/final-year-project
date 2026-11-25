import React, { useState } from 'react';
import { useNavigate } from './router';
import { authService } from './services/appService';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim()) {
      setError('Please enter your email.');
      return;
    }

    // very small email format check
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    try {
      setLoading(true);
      await authService.forgotPassword(email.trim());
      setLoading(false);
      setSuccess(
        "If an account with that email exists, we've sent password reset instructions. Check your inbox."
      );
    } catch (requestError) {
      setLoading(false);
      setError(requestError.response?.data?.error || requestError.message || 'Unable to send reset instructions.');
    }
  };

  return (
    <div
      className="auth-page"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        className="auth-card"
        style={{
          width: '100%',
          maxWidth: 520,
          padding: 26,
          borderRadius: 12,
          background: 'var(--card-bg)',
          color: 'var(--text)',
          border: '1px solid rgba(148,163,184,0.12)',
        }}
      >
        <h2 style={{ margin: '0 0 8px', fontSize: 22, color: 'var(--text)' }}>Forgot password</h2>
        <p style={{ margin: '0 0 16px', color: 'var(--muted)' }}>
          Enter the email associated with your account and we'll send instructions to reset your
          password.
        </p>

        <form onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}

          <div className="auth-field" style={{ marginTop: 12 }}>
            <label htmlFor="fp-email">Email</label>
            <input
              id="fp-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button type="submit" className="auth-button" disabled={loading}>
              {loading ? 'Sending...' : 'Send reset link'}
            </button>

            <button
              type="button"
              className="auth-button"
              style={{
                background: 'transparent',
                color: 'var(--muted)',
                border: '1px solid rgba(148,163,184,0.15)',
              }}
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

export default ForgotPassword;
