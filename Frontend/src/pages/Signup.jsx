import { usePatientLanguage } from '../lib/patientLanguage';
import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, ArrowLeft, Key } from 'lucide-react';
import { api } from '../lib/api';
import HospitalBrand from '../components/HospitalBrand';
import PatientLanguageSwitch from '../components/PatientLanguageSwitch';
import ResendOtp from '../components/ResendOtp';

export default function Signup() {
  const { t } = usePatientLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const step = searchParams.get('step') === '2' ? 2 : 1;
  const setStep = (nextStep) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (nextStep === 2) next.set('step', '2');
      else next.delete('step');
      return next;
    });
  };
  const role = searchParams.get('role') === 'doctor' ? 'doctor' : 'patient';
  const setRole = (nextRole) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (nextRole === 'doctor') next.set('role', 'doctor');
      else next.delete('role');
      return next;
    }, { replace: true });
  };
  const [doctorPasscode, setDoctorPasscode] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [consentDataProcessing, setConsentDataProcessing] = useState(false);
  const [consentAiAnalysis, setConsentAiAnalysis] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequestOTP = async (e) => {
    e.preventDefault();
    if (role === 'doctor' && !doctorPasscode.trim()) {
      setError('Hospital doctor security code is required.');
      return;
    }
    if (!consentDataProcessing || !consentAiAnalysis) {
      setError('Please agree to both medical data processing and AI analysis consent.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await api.post('/auth/request-otp', { email, is_signup: true });
      if (res && res.status === 'success') {
        setStep(2);
      } else {
        setError(res.detail || res.message || "Failed to generate verification code.");
      }
    } catch (err) {
      setError(err.message || "Unable to send the email code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        name,
        email,
        password,
        role,
        otp_code: otpCode,
        consent_data_processing: consentDataProcessing,
        consent_ai_analysis: consentAiAnalysis,
      };
      if (role === 'doctor') {
        payload.doctor_passcode = doctorPasscode.trim();
      }
      const data = await api.post('/auth/signup', payload);

      if (data.status === 'success') {
        setSuccess(`${role === 'doctor' ? 'Doctor' : 'Patient'} account successfully created! Redirecting to Login...`);
        setTimeout(() => {
            navigate('/login');
        }, 1500);
      } else {
        setError(data.detail || data.message || "Registration failed.");
      }
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="clinical-shell min-h-screen flex items-center justify-center p-4 py-10">
      <div className="max-w-md w-full relative">
        <div className="flex items-center justify-between gap-3 mb-4">
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/login'))}
            className="inline-flex items-center text-sm font-semibold text-slate-600 hover:text-blue-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> {t("Back")}
          </button>
          <PatientLanguageSwitch compact />
        </div>

        <div className="auth-hospital-brand"><HospitalBrand /></div>
        <div className="clinical-card p-7 sm:p-8">
          <h2 className="text-2xl font-semibold text-center text-slate-900 mb-1.5">{t("Create an account")}</h2>
          <p className="text-slate-600 text-center mb-6 text-sm">{t("Your Shri Sarveshwar Netralaya care portal")}</p>

          {error && <div role="alert" className="p-3 mb-5 bg-red-50 text-red-800 border border-red-200 rounded-lg text-sm text-center font-medium">{t(error)}{step === 2 && role === 'doctor' && <button type="button" className="block underline mx-auto mt-2 font-semibold" onClick={() => { setStep(1); setError(''); }}>{t("Check hospital registration code")}</button>}</div>}
          {success && <div className="p-3 mb-5 bg-teal-50 text-teal-800 border border-teal-200 rounded-lg text-sm text-center font-medium">{t(success)}</div>}

          {step === 1 ? (
            <>
              <fieldset className="mb-5">
                <legend className="clinical-label mb-2">{t("Account type")}</legend>
                <div className="flex p-1 space-x-1 bg-slate-100 rounded-lg border border-slate-200">
                  <label className="flex-1 cursor-pointer">
                    <input
                      type="radio"
                      name="role"
                      value="patient"
                      checked={role === 'patient'}
                      onChange={() => { setRole('patient'); setError(''); }}
                      className="sr-only peer"
                    />
                    <span className={`block text-center py-2 text-sm font-semibold rounded-md transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-blue-700 ${role === 'patient' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-600 hover:text-slate-800'}`}>
                      {t("Patient")}
                    </span>
                  </label>
                  <label className="flex-1 cursor-pointer">
                    <input
                      type="radio"
                      name="role"
                      value="doctor"
                      checked={role === 'doctor'}
                      onChange={() => { setRole('doctor'); setError(''); }}
                      className="sr-only peer"
                    />
                    <span className={`block text-center py-2 text-sm font-semibold rounded-md transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-blue-700 ${role === 'doctor' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-600 hover:text-slate-800'}`}>
                      {t("Doctor (Staff)")}
                    </span>
                  </label>
                </div>
              </fieldset>

              <form onSubmit={handleRequestOTP} className="space-y-4">
                {role === 'doctor' && (
                  <div>
                    <label htmlFor="hospital-registration-code" className="clinical-label">{t("Hospital registration code")}</label>
                    <div className="relative">
                      <Key className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <input
                        id="hospital-registration-code"
                        type="password"
                        autoComplete="off"
                        maxLength={256}
                        value={doctorPasscode}
                        onChange={(e) => setDoctorPasscode(e.target.value)}
                        className="clinical-input pl-10 font-mono"
                        placeholder={t("Enter hospital authorization passcode")}
                        required
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5">{t("For staff registration only. Ask hospital administration for this code. Already registered? Sign in with your own email and password or Google.")}</p>
                  </div>
                )}

                <div>
                  <label htmlFor="signup-name" className="clinical-label">{t("Full Name")}</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <input
                      id="signup-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="clinical-input pl-10"
                      placeholder="Full name"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="signup-email" className="clinical-label">{t("Email")}</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <input
                      id="signup-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="clinical-input pl-10"
                      placeholder="name@example.com"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="signup-password" className="clinical-label">{t("Password")}</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <input
                      id="signup-password"
                      minLength={8}
                      maxLength={128}
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="clinical-input pl-10 pr-11"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? t("Hide password") : t("Show password")}
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-700"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">
                    {t("Use 8+ chars with uppercase, lowercase, number & special symbol.")}
                  </p>
                </div>
                <div className="space-y-2.5 pt-1 text-xs text-slate-700">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consentDataProcessing}
                      onChange={(e) => setConsentDataProcessing(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-blue-700 focus:ring-blue-700"
                      required
                    />
                    <span>
                      {t("I consent to the secure processing of my clinical & health data under the ")}{' '}
                      <Link to="/privacy" className="text-blue-700 font-semibold hover:underline">{t("Privacy Policy")}</Link>.
                    </span>
                  </label>
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consentAiAnalysis}
                      onChange={(e) => setConsentAiAnalysis(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-blue-700 focus:ring-blue-700"
                      required
                    />
                    <span>
                      {t("I understand AI outputs are clinical decision support and agree to the ")}{' '}
                      <Link to="/terms" className="text-blue-700 font-semibold hover:underline">{t("Terms & Conditions")}</Link>.
                    </span>
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="clinical-btn-primary w-full mt-3"
                >
                  {loading ? t("Sending OTP...") : t("Register")}
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="text-slate-600 text-center mb-6 text-sm"> {t("We sent a one-time code to")} {email}{t(". Check your inbox and spam folder. The code expires in 10 minutes.")} </p>
              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <label htmlFor="signup-otp" className="clinical-label">{t("Verification Code (OTP)")}</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <input
                      id="signup-otp"
                      type="text"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      className="clinical-input pl-10"
                      placeholder={t("Enter 6-digit code")}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="clinical-btn-primary w-full mt-3"
                >
                  {loading ? t("Verifying...") : t("Verify & Create Account")}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-full text-center text-sm font-semibold text-slate-600 hover:text-blue-700 transition-colors mt-2"
                > {t("Go Back & Change Details")} </button>
              </form>
              <ResendOtp email={email} isSignup={true} disabled={loading} onSent={() => { setOtpCode(''); setError(''); }} />
            </>
          )}

          <p className="text-center text-sm text-slate-600 mt-6 pt-5 border-t border-slate-200"> {t("Already have an account?")} <Link to="/login" className="text-blue-700 font-semibold hover:underline">{t("Log in")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
