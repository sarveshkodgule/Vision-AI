import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { api } from '../lib/api';

export default function PasswordSignIn() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function signIn(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const body = new URLSearchParams({ username: email.trim(), password });
      const response = await api.post('/auth/login', body, true);
      const { access_token, user } = response.data;
      if (!access_token || !['patient', 'doctor'].includes(user?.role)) throw new Error('Unable to open your portal. Please try again.');
      localStorage.setItem('token', access_token);
      localStorage.setItem('role', user.role);
      navigate(user.role === 'doctor' ? '/doctor/dashboard' : '/patient/dashboard', { replace: true });
    } catch (err) { setError(err.message || 'Sign-in failed. Please try again.'); }
    finally { setBusy(false); }
  }
  return <form className="password-signin" onSubmit={signIn} aria-busy={busy}>
    <label htmlFor="login-email">Email address</label>
    <input id="login-email" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" />
    <div className="password-label"><label htmlFor="login-password">Password</label><Link to="/forgot-password">Forgot password?</Link></div>
    <div className="password-input"><input id="login-password" type={visible ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)}/><button type="button" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} onClick={() => setVisible(value => !value)}>{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>
    {error && <p className="patient-feedback" role="alert">{error}</p>}
    <button type="submit" className="password-submit" disabled={busy}>{busy && <Loader2 size={18} className="animate-spin"/>}{busy ? 'Signing in…' : 'Sign in'}</button>
  </form>;
}
