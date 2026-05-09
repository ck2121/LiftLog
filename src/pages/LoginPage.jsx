import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, register, checkRateLimit, validateUsername, passwordStrength } from '../services/auth';
import { useAuth } from '../context/AuthContext';

function StrengthBar({ password }) {
  if (!password) return null;
  const { score, label, color } = passwordStrength(password);
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 3 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              flex: 1, height: 4, borderRadius: 2,
              background: i < score ? color : 'var(--border)',
              transition: 'background 0.2s',
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: '0.72rem', color }}>{label}</span>
    </div>
  );
}

export default function LoginPage() {
  const [tab, setTab]         = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [lockoutMsg, setLockoutMsg] = useState('');
  const { setUser } = useAuth();
  const navigate = useNavigate();

  // Poll lockout status so the UI updates when the timer expires
  useEffect(() => {
    const tick = () => {
      const rate = checkRateLimit();
      setLockoutMsg(rate.locked ? rate.message : '');
    };
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // Recheck lockout on submit in case timer just expired
    const rate = checkRateLimit();
    if (rate.locked) { setLockoutMsg(rate.message); return; }

    setLoading(true);
    try {
      if (tab === 'login') {
        const result = await login(username, password);
        if (result.error === 'rate_limited') {
          setLockoutMsg(result.message);
        } else if (!result.success) {
          const rate2 = checkRateLimit();
          const hint = rate2.attemptsLeft > 0
            ? ` (${rate2.attemptsLeft} attempt${rate2.attemptsLeft !== 1 ? 's' : ''} left)`
            : '';
          setError(`Invalid username or password.${hint}`);
        } else {
          setUser(result.user);
          navigate('/');
        }
      } else {
        // Signup validation
        const usernameErr = validateUsername(username);
        if (usernameErr) { setError(usernameErr); setLoading(false); return; }

        const strength = passwordStrength(password);
        if (strength.score === 0) {
          setError('Password must be at least 8 characters.');
          setLoading(false); return;
        }
        if (password !== confirm) {
          setError('Passwords do not match.');
          setLoading(false); return;
        }

        const result = await register(username, password);
        if (!result.success) {
          if (result.error === 'username_taken')    setError('That username is already taken.');
          else if (result.error === 'invalid_username') setError(result.message);
          else if (result.error === 'weak_password') setError('Password must be at least 8 characters.');
          else setError('Something went wrong. Please try again.');
        } else {
          setUser(result.user);
          navigate('/');
        }
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
      if (import.meta.env.DEV) console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function switchTab(t) {
    setTab(t);
    setError('');
    setPassword('');
    setConfirm('');
  }

  return (
    <div className="login-page">
      <div className="login-logo">
        <h1>Lift<span>Log</span></h1>
        <p>Your personal gym companion</p>
      </div>

      <div className="login-card">
        <div className="login-tabs">
          <button className={`login-tab${tab === 'login'  ? ' active' : ''}`} onClick={() => switchTab('login')}>Sign In</button>
          <button className={`login-tab${tab === 'signup' ? ' active' : ''}`} onClick={() => switchTab('signup')}>Sign Up</button>
        </div>

        {lockoutMsg && (
          <div className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            🔒 {lockoutMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} autoComplete={tab === 'signup' ? 'off' : 'on'}>
          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="3–32 chars, letters/numbers/_/-"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              maxLength={32}
              required
              disabled={!!lockoutMsg}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={tab === 'signup' ? 'At least 8 characters' : 'Enter password'}
              autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
              required
              disabled={!!lockoutMsg}
            />
            {tab === 'signup' && <StrengthBar password={password} />}
          </div>

          {tab === 'signup' && (
            <div className="form-group">
              <label htmlFor="confirm">Confirm Password</label>
              <input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter password"
                autoComplete="new-password"
                required
              />
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={loading || !!lockoutMsg}>
            {loading ? 'Please wait…' : tab === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-muted mt-3" style={{ fontSize: '0.8rem' }}>
          {tab === 'login' ? 'No account yet? ' : 'Already have an account? '}
          <button
            onClick={() => switchTab(tab === 'login' ? 'signup' : 'login')}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}
          >
            {tab === 'login' ? 'Sign Up' : 'Sign In'}
          </button>
        </p>

        <p className="text-center text-muted mt-2" style={{ fontSize: '0.72rem' }}>
          🔒 All data stays on your device. Nothing is sent anywhere.
        </p>
      </div>
    </div>
  );
}
