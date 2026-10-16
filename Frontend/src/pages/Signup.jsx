import { usePatientLanguage } from '../lib/patientLanguage';
import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, ArrowLeft, Key } from 'lucide-react';
import { motion as Motion } from 'framer-motion';
import { api } from '../lib/api';
import HospitalBrand from '../components/HospitalBrand';
import ResendOtp from '../components/ResendOtp';

export default function Signup() {
  const { t } = usePatientLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1); // 1 = Enter Details, 2 = Verify OTP & Register
  const [role, setRole] = useState(searchParams.get('role') === 'doctor' ? 'doctor' : 'patient');
  const [doctorPasscode, setDoctorPasscode] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
        otp_code: otpCode
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50/50 p-4">
      <Motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full relative"
      >
        <button 
          onClick={() => navigate(-1)} 
          className="absolute -top-12 left-0 flex items-center text-sm font-semibold text-slate-500 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> {t("Back")} </button>

        <div className="auth-hospital-brand"><HospitalBrand /></div>
        <div className="bg-white p-8 rounded-3xl shadow-xl shadow-blue-900/5 border border-slate-100">
          <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">{t("Create an account")}</h2>
          <p className="text-slate-500 text-center mb-6 text-sm">{t("Your Shri Sarveshwar Netralaya care portal")}</p>

          {error && <div role="alert" className="p-3 mb-6 bg-red-50 text-red-600 rounded-lg text-sm text-center font-semibold">{t(error)}{step === 2 && role === 'doctor' && <button type="button" className="block underline mx-auto mt-2" onClick={() => { setStep(1); setError(''); }}>{t("Check hospital registration code")}</button>}</div>}
          {success && <div className="p-3 mb-6 bg-green-50 text-green-600 rounded-lg text-sm text-center font-semibold">{t(success)}</div>}

          {step === 1 ? (
            <>
              <div className="flex p-1.5 mb-5 space-x-1 bg-slate-100 rounded-xl" role="tablist">
                <button
                  type="button"
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${role === 'patient' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                  onClick={() => { setRole('patient'); setError(''); }}
                > {t("Patient")} </button>
                <button
                  type="button"
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${role === 'doctor' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                  onClick={() => { setRole('doctor'); setError(''); }}
                > {t("Doctor (Staff)")} </button>
              </div>

              <form onSubmit={handleRequestOTP} className="space-y-4">
                {role === 'doctor' && (
                  <div>
                    <label htmlFor="hospital-registration-code" className="block text-sm font-semibold text-slate-700 mb-1.5">{t("Hospital registration code")}</label>
                    <div className="relative">
                      <Key className="absolute left-3.5 top-3 h-5 w-5 text-slate-400" />
                      <input 
                        id="hospital-registration-code"
                        type="password"
                        autoComplete="off"
                        maxLength={256}
                        value={doctorPasscode}
                        onChange={(e) => setDoctorPasscode(e.target.value)}
                        className="w-full rounded-xl border-slate-200 bg-slate-50 pl-11 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors font-mono" 
                        placeholder={t("Enter hospital authorization passcode")} 
                        required
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">{t("For staff registration only. Ask hospital administration for this code. Already registered? Sign in with your own email and password or Google.")}</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t("Full Name")}</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3 h-5 w-5 text-slate-400" />
                    <input 
                      type="text" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-xl border-slate-200 bg-slate-50 pl-11 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" 
                      placeholder="John Doe" 
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t("Email")}</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 h-5 w-5 text-slate-400" />
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl border-slate-200 bg-slate-50 pl-11 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" 
                      placeholder="name@example.com" 
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t("Password")}</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 h-5 w-5 text-slate-400" />
                    <input 
                      minLength={6}
                      maxLength={128}
                      type={showPassword ? "text" : "password"} 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border-slate-200 bg-slate-50 pl-11 pr-12 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" 
                      placeholder="••••••••" 
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button 
                  type="submit"
                  disabled={loading}
                  className={`w-full inline-flex items-center justify-center rounded-xl text-md font-bold text-white bg-blue-600 hover:bg-blue-700 h-12 mt-4 transition-all shadow-lg hover:shadow-blue-500/30 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {loading ? t("Sending OTP...") : t("Register")}
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="text-slate-500 text-center mb-6 text-sm"> {t("We sent a one-time code to")} {email}{t(". Check your inbox and spam folder. The code expires in 10 minutes.")} </p>
              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t("Verification Code (OTP)")}</label>
                  <div className="relative">
                    <Key className="absolute left-3.5 top-3 h-5 w-5 text-slate-400" />
                    <input 
                      type="text" 
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      className="w-full rounded-xl border-slate-200 bg-slate-50 pl-11 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" 
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
                  className={`w-full inline-flex items-center justify-center rounded-xl text-md font-bold text-white bg-blue-600 hover:bg-blue-700 h-12 mt-4 transition-all shadow-lg hover:shadow-blue-500/30 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {loading ? t("Verifying...") : t("Verify & Create Account")}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-full text-center text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors mt-2"
                > {t("Go Back & Change Details")} </button>
              </form>
                <ResendOtp email={email} isSignup={true} disabled={loading} onSent={() => { setOtpCode(''); setError(''); }} />
            </>
          )}

          <p className="text-center text-sm text-slate-500 mt-8 font-medium"> {t("Already have an account?")} <Link to="/login" className="text-blue-600 font-bold hover:underline">{t("Log in")}</Link>
          </p>
        </div>
      </Motion.div>
    </div>
  );
}
