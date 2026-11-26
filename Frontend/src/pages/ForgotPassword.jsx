import { usePatientLanguage } from '../lib/patientLanguage';
import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Mail, ShieldCheck, Lock, Key, Eye, EyeOff } from 'lucide-react';
import { api } from '../lib/api';
import HospitalBrand from '../components/HospitalBrand';
import PatientLanguageSwitch from '../components/PatientLanguageSwitch';
import ResendOtp from '../components/ResendOtp';

export default function ForgotPassword() {
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
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequestOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/request-otp', { email: email.trim(), is_signup: false });
      if (res && res.status === 'success') {
        setStep(2);
      } else {
        setError(res.detail || res.message || "Failed to generate verification code.");
      }
    } catch (err) {
      setError(err.message || "Network error. Ensure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (password.trim().length < 8) {
      setError('Password must be at least 8 characters with uppercase, lowercase, number & special symbol.');
      return;
    }
    setLoading(true);

    try {
      const res = await api.post('/auth/reset-password', {
        email: email.trim(),
        new_password: password.trim(),
        otp_code: otpCode.trim()
      });
      if (res && res.status === 'success') {
        setIsSubmitted(true);
      } else {
        setError(res.detail || res.message || "Failed to reset password.");
      }
    } catch (err) {
      setError(err.message || "Invalid or expired verification code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="clinical-shell min-h-screen flex items-center justify-center p-4 py-10">
      <div className="max-w-md w-full">
        <div className="flex items-center justify-between gap-3 mb-5">
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/login'))}
            className="flex items-center text-sm font-semibold text-slate-600 hover:text-blue-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> {t("Back")}
          </button>
          <PatientLanguageSwitch compact />
        </div>

        <div className="auth-hospital-brand"><HospitalBrand /></div>
        <div className="clinical-card p-7 sm:p-8">
          <div className="w-12 h-12 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center mx-auto mb-5 text-blue-700">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-semibold text-center text-slate-900 mb-2">{t("Reset Password")}</h2>

          {!isSubmitted ? (
            <>
              {step === 1 ? (
                <>
                  <p className="text-slate-600 text-center mb-6 text-sm"> {t("Enter your registered email address to request a secure 10-minute verification code.")} </p>
                  {error && <div role="alert" className="p-3 mb-5 bg-red-50 text-red-800 border border-red-200 rounded-lg text-sm text-center font-medium">{t(error)}</div>}
                  <form onSubmit={handleRequestOTP} className="space-y-4">
                    <div>
                      <label htmlFor="reset-email" className="clinical-label">{t("Email Address")}</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <input
                          id="reset-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="clinical-input pl-10"
                          placeholder="name@example.com"
                          required
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="clinical-btn-primary w-full mt-2"
                    >
                      {loading ? t("Processing...") : t("Request Code")}
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <p className="text-slate-600 text-center mb-6 text-sm"> {t("Enter the code sent to your email and your new password.")} </p>
                  {error && <div role="alert" className="p-3 mb-5 bg-red-50 text-red-800 border border-red-200 rounded-lg text-sm text-center font-medium">{t(error)}</div>}
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <div>
                      <label htmlFor="reset-otp" className="clinical-label">{t("Verification Code (OTP)")}</label>
                      <div className="relative">
                        <Key className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <input
                          id="reset-otp"
                          type="text"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value)}
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          pattern="[0-9]{6}"
                          maxLength={6}
                          className="clinical-input pl-10"
                          placeholder={t("Enter 6-digit code")}
                          required
                        />
                      </div>
                    </div>
                     <div>
                       <label htmlFor="reset-password" className="clinical-label">{t("New Password")}</label>
                       <div className="relative">
                         <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                         <input
                           id="reset-password"
                           type={showPassword ? "text" : "password"}
                           value={password}
                           onChange={(e) => setPassword(e.target.value)}
                           className="clinical-input pl-10 pr-11"
                           placeholder={t("8+ chars with upper, lower, number & symbol")}
                           minLength={8}
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
                     </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="clinical-btn-primary w-full mt-2"
                    >
                      {loading ? 'Resetting Password...' : 'Verify & Reset Password'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="w-full text-center text-sm font-semibold text-slate-600 hover:text-blue-700 transition-colors mt-2"
                    > {t("Change Email Address")} </button>
                  </form>
                <ResendOtp email={email} isSignup={false} disabled={loading} onSent={() => { setOtpCode(''); setError(''); }} />
                </>
              )}
            </>
          ) : (
             <div className="text-center">
               <div className="bg-teal-50 text-teal-800 p-4 rounded-lg mb-6 text-sm font-medium border border-teal-200"> {t("Your password has been successfully reset. You can now log in securely.")} </div>
               <Link to="/login" className="text-blue-700 font-semibold hover:underline"> {t("Return to Login")} </Link>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
