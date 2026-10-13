import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { api } from '../lib/api';

export default function PasswordSignIn() {
  const navigate = useNavigate();
  const [role, setRole] = useState('patient');
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
      const payload = response.data || response;
      const access_token = payload.access_token || response.access_token;
      const user = payload.user || response.user;
      if (!access_token || !user?.role) {
        throw new Error('Unable to open your portal. Please check your credentials and try again.');
      }
      const userRole = String(user.role).toLowerCase();
      if (!['patient', 'doctor'].includes(userRole)) {
        throw new Error('Invalid account role. Please contact hospital administration.');
      }
      localStorage.setItem('token', access_token);
      localStorage.setItem('role', userRole);
      navigate(userRole === 'doctor' ? '/doctor/dashboard' : '/patient/dashboard', { replace: true });
    } catch (err) { setError(err.message || 'Sign-in failed. Please try again.'); }
    finally { setBusy(false); }
  }
  return <form className="password-signin" onSubmit={signIn} aria-busy={busy}>
    <div className="login-role-select" role="tablist" style={{ display: 'flex', gap: '6px', background: '#eef3f8', padding: '4px', borderRadius: '8px', marginBottom: '18px' }}>
      <button
        type="button"
        role="tab"
        aria-selected={role === 'patient'}
        className={`role-tab ${role === 'patient' ? 'active' : ''}`}
        style={{
          flex: 1,
          padding: '8px 12px',
          fontSize: '13px',
          fontWeight: '600',
          borderRadius: '6px',
          border: 'none',
          cursor: 'pointer',
          background: role === 'patient' ? '#ffffff' : 'transparent',
          color: role === 'patient' ? '#17365d' : '#64748b',
          boxShadow: role === 'patient' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          transition: 'all 0.15s ease'
        }}
        onClick={() => { setRole('patient'); setError(''); }}
      >
        Patient
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={role === 'doctor'}
        className={`role-tab ${role === 'doctor' ? 'active' : ''}`}
        style={{
          flex: 1,
          padding: '8px 12px',
          fontSize: '13px',
          fontWeight: '600',
          borderRadius: '6px',
          border: 'none',
          cursor: 'pointer',
          background: role === 'doctor' ? '#ffffff' : 'transparent',
          color: role === 'doctor' ? '#17365d' : '#64748b',
          boxShadow: role === 'doctor' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          transition: 'all 0.15s ease'
        }}
        onClick={() => { setRole('doctor'); setError(''); }}
      >
        Doctor
      </button>
    </div>

    {role === 'doctor' && <p className="doctor-signin-note">Use your registered doctor email and your own password. The hospital registration code is only for creating a staff account. You can also continue with Google below using the same registered email.</p>}
    <label htmlFor="login-email">{role === 'doctor' ? 'Doctor email address' : 'Patient email address'}</label>
    <input id="login-email" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} placeholder={role === 'doctor' ? 'doctor@example.com' : 'patient@example.com'} />
    <div className="password-label"><label htmlFor="login-password">Password</label><Link to="/forgot-password">Forgot password?</Link></div>
    <div className="password-input"><input id="login-password" type={visible ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)}/><button type="button" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} onClick={() => setVisible(value => !value)}>{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>
    {error && <p className="patient-feedback" role="alert">{error}</p>}
    <button type="submit" className="password-submit" disabled={busy}>{busy && <Loader2 size={18} className="animate-spin"/>}{busy ? 'Signing in…' : `Sign in as ${role === 'doctor' ? 'Doctor' : 'Patient'}`}</button>
  </form>;
}
