import { usePatientLanguage } from '../lib/patientLanguage';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function ResendOtp({ email, isSignup, disabled, onSent }) {
  const { t, language } = usePatientLanguage();
  const [seconds, setSeconds] = useState(60);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const timer = setInterval(() => setSeconds(value => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, []);
  async function resend() {
    setSending(true);
    setMessage('');
    try {
      await api.post('/auth/request-otp', { email, is_signup: isSignup });
      setSeconds(60);
      setMessage('New code sent. Check your inbox and spam folder; use the latest code.');
      onSent();
    } catch (error) {
      setMessage(error.message || 'Unable to send a new code. Please try again.');
    } finally {
      setSending(false);
    }
  }
  return <div className="text-center mt-4 text-sm">
    <button type="button" onClick={resend} disabled={disabled || sending || seconds > 0}
      className="font-semibold text-blue-600 disabled:text-slate-400 disabled:cursor-not-allowed">
      {sending ? t("Sending…") : seconds > 0 ? (language === "mr" ? `${seconds} सेकंदांनी पुन्हा पाठवा` : `Resend code in ${seconds}s`) : t("Resend verification code")}
    </button>
    <p role="status" className="text-slate-500 mt-2">{t(message)}</p>
  </div>;
}
