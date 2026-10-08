import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiAlertCircle, FiArrowRight, FiEye, FiEyeOff } from 'react-icons/fi';
import { useAuth } from './AuthContext';
import AuthShell from './AuthShell';
import { Spinner, useSlowFlag } from './components/ui';
import { apiError } from './finance';

const byteLength = (pw) => new TextEncoder().encode(pw).length;

function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const slow = useSlowFlag(busy);
  const { register } = useAuth();
  const navigate = useNavigate();

  const strength = password.length === 0 ? 0 : password.length < 8 ? 1 : /[^a-zA-Z]/.test(password) && password.length >= 10 ? 3 : 2;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Use at least 8 characters for your password.');
      return;
    }
    if (byteLength(password) > 72) {
      setError('Password is too long (max 72 bytes).');
      return;
    }
    setBusy(true);
    try {
      await register(email.trim(), password, fullName.trim());
      navigate('/home');
    } catch (err) {
      setError(apiError(err, 'Could not create your account.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Get started — it's free"
      title="Create your account"
      subtitle="Set up in under a minute. No card needed."
      footer={<>Already have an account? <Link to="/login">Sign in</Link></>}
    >
      {error && <div className="auth-error"><FiAlertCircle /><span>{error}</span></div>}
      <form onSubmit={handleSubmit}>
        <div className="auth-field">
          <label className="fb-label" htmlFor="name">Full name</label>
          <input id="name" className="fb-input" type="text" autoComplete="name" placeholder="Priya Sharma"
            value={fullName} onChange={(e) => setFullName(e.target.value)} required autoFocus />
        </div>
        <div className="auth-field">
          <label className="fb-label" htmlFor="email">Email</label>
          <input id="email" className="fb-input" type="email" autoComplete="email" placeholder="you@example.com"
            value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="auth-field">
          <label className="fb-label" htmlFor="password">Password</label>
          <div className="fb-input-wrap">
            <input id="password" className="fb-input" type={showPw ? 'text' : 'password'} autoComplete="new-password"
              placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required
              style={{ paddingRight: 48 }} />
            <button type="button" className="fb-icon-btn suffix-btn" onClick={() => setShowPw((s) => !s)}
              aria-label={showPw ? 'Hide password' : 'Show password'}>
              {showPw ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>
          <div className="d-flex gap-1 mt-2" aria-hidden="true">
            {[1, 2, 3].map((i) => (
              <div key={i} style={{
                flex: 1, height: 4, borderRadius: 4, transition: 'background .2s',
                background: strength >= i ? (strength === 1 ? 'var(--neg)' : strength === 2 ? 'var(--warn)' : 'var(--pos)') : 'rgba(255,255,255,0.08)',
              }} />
            ))}
          </div>
        </div>
        <button className="fb-btn fb-btn-lg fb-btn-block mt-2" type="submit" disabled={busy}>
          {busy ? <><Spinner /> Creating account…</> : <>Create account <FiArrowRight /></>}
        </button>
        {slow && <div className="auth-hint">Waking up the server — this can take up to a minute the first time.</div>}
      </form>
    </AuthShell>
  );
}

export default Register;
