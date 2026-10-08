import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiAlertCircle, FiArrowRight, FiEye, FiEyeOff } from 'react-icons/fi';
import { useAuth } from './AuthContext';
import AuthShell from './AuthShell';
import { Spinner, useSlowFlag } from './components/ui';
import { apiError } from './finance';

const tooLong = (pw) => new TextEncoder().encode(pw).length > 72;

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const slow = useSlowFlag(busy);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (tooLong(password)) {
      setError('Password is too long (max 72 bytes).');
      return;
    }
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate('/home');
    } catch (err) {
      setError(err.response?.status === 401 ? 'Incorrect email or password.' : apiError(err, 'Sign in failed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in"
      subtitle="Pick up right where you left off."
      footer={<>New to FinBuddy? <Link to="/register">Create an account</Link></>}
    >
      {error && <div className="auth-error"><FiAlertCircle /><span>{error}</span></div>}
      <form onSubmit={handleSubmit} noValidate={false}>
        <div className="auth-field">
          <label className="fb-label" htmlFor="email">Email</label>
          <input id="email" className="fb-input" type="email" autoComplete="email" placeholder="you@example.com"
            value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        <div className="auth-field">
          <label className="fb-label" htmlFor="password">Password</label>
          <div className="fb-input-wrap">
            <input id="password" className="fb-input" type={showPw ? 'text' : 'password'} autoComplete="current-password"
              placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required
              style={{ paddingRight: 48 }} />
            <button type="button" className="fb-icon-btn suffix-btn" onClick={() => setShowPw((s) => !s)}
              aria-label={showPw ? 'Hide password' : 'Show password'}>
              {showPw ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>
        </div>
        <button className="fb-btn fb-btn-lg fb-btn-block mt-2" type="submit" disabled={busy}>
          {busy ? <><Spinner /> Signing in…</> : <>Sign in <FiArrowRight /></>}
        </button>
        {slow && <div className="auth-hint">Waking up the server — the first sign-in can take up to a minute.</div>}
      </form>
    </AuthShell>
  );
}

export default Login;
