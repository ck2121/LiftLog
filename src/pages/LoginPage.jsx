import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, register } from '../services/auth';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [tab, setTab] = useState('login'); // 'login' | 'signup'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (tab === 'login') {
        const result = await login(username, password);
        if (!result.success) {
          setError('Invalid username or password.');
        } else {
          setUser(result.user);
          navigate('/');
        }
      } else {
        if (password !== confirm) {
          setError('Passwords do not match.');
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters.');
          setLoading(false);
          return;
        }
        const result = await register(username, password);
        if (!result.success) {
          if (result.error === 'username_taken') {
            setError('That username is already taken.');
          } else {
            setError('Please enter a username and password.');
          }
        } else {
          setUser(result.user);
          navigate('/');
        }
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
      console.error(err);
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
          <button
            className={`login-tab${tab === 'login' ? ' active' : ''}`}
            onClick={() => switchTab('login')}
          >
            Sign In
          </button>
          <button
            className={`login-tab${tab === 'signup' ? ' active' : ''}`}
            onClick={() => switchTab('signup')}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} autoComplete="off">
          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              autoCapitalize="none"
              autoCorrect="off"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
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
                required
              />
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={loading}>
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
          🔒 All data stays on your device. No accounts sent anywhere.
        </p>
      </div>
    </div>
  );
}
