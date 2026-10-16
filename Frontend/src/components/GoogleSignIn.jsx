import { usePatientLanguage } from '../lib/patientLanguage';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

let scriptPromise;
function loadGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(fail, 15000);
    function fail() { clearTimeout(timer); script.remove(); scriptPromise = null; reject(new Error('Google sign-in could not load. Check your connection and try again.')); }
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => { clearTimeout(timer); resolve(); };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export default function GoogleSignIn() {
  const { language, t } = usePatientLanguage();
  const target = useRef(null);
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState('loading');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const button = target.current;
    async function setup() {
      try {
        const response = await api.get('/auth/google/config');
        await loadGoogle();
        if (!active) return;
        const { client_id, nonce, challenge } = response.data;
        window.google.accounts.id.initialize({ client_id, nonce, auto_select: false, callback: async ({ credential }) => {
          if (!active) return;
          setPhase('verifying');
          setError('');
          try {
            const signed = await api.post('/auth/google', { credential, challenge });
            if (!active) return;
            const payload = signed.data || signed;
            const access_token = payload.access_token || signed.access_token;
            const user = payload.user || signed.user;
            if (!access_token || !['patient', 'doctor'].includes(user?.role?.toLowerCase())) {
              throw new Error('Unable to open your portal. Please try again.');
            }
            const userRole = String(user.role).toLowerCase();
            localStorage.setItem('token', access_token);
            localStorage.setItem('role', userRole);
            navigate(userRole === 'doctor' ? '/doctor/dashboard' : '/patient/dashboard', { replace: true });
          } catch (err) { if (active) { setError(err.message); setPhase('error'); } }
        } });
        button.replaceChildren();
        window.google.accounts.id.renderButton(button, { locale: language, theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', width: Math.min(360, button.clientWidth) });
        setPhase('ready');
      } catch (err) { if (active) { setError(err.message); setPhase('error'); } }
    }
    setup();
    return () => { active = false; button?.replaceChildren(); };
  }, [attempt, navigate, language]);
  return <div className="google-signin" aria-busy={phase === 'loading' || phase === 'verifying'}>
    <div ref={target} className={phase === 'ready' ? 'google-button' : 'google-button google-button-hidden'} />
    {(phase === 'loading' || phase === 'verifying') && <p role="status">{phase === 'loading' ? t("Preparing secure Google sign-in…") : t("Verifying your account and opening your portal…")}</p>}
    {error && <div className="patient-feedback" role="alert"><p>{t(error)}</p><button type="button" onClick={() => { setError(''); setPhase('loading'); setAttempt(value => value + 1); }}>{t("Retry Google sign-in")}</button></div>}
  </div>;
}
