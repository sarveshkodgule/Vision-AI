import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, ArrowLeft, Key } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';

export default function Signup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1 = Enter Details, 2 = Verify OTP & Register
  const [role, setRole] = useState('patient');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSentCode, setOtpSentCode] = useState(''); // For demo mode
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequestOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await api.post('/auth/request-otp', { email, is_signup: true });
      if (res && res.status === 'success') {
        setStep(2);
        if (res.data && res.data.code) {
          setOtpSentCode(res.data.code);
        }
      } else {
        setError(res.detail || res.message || "Failed to generate verification code.");
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Network error or email already registered.");
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
      const data = await api.post('/auth/signup', {
        name,
        email,
        password,
        role,
        otp_code: otpCode
      });
      
      if (data.status === 'success') {
        setSuccess("Account Successfully created! Redirecting to Login...");
        setTimeout(() => {
            navigate('/login');
        }, 1500);
      } else {
        setError(data.detail || data.message || "Registration failed.");
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid or expired verification code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50/50 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full relative"
      >
        <button 
          onClick={() => navigate(-1)} 
          className="absolute -top-12 left-0 flex items-center text-sm font-semibold text-slate-500 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </button>

        <Link to="/" className="flex items-center justify-center mb-8 space-x-2 text-slate-800 hover:text-blue-600 transition-colors">
          <Eye className="w-8 h-8 text-blue-600" />
          <span className="font-extrabold text-3xl tracking-tight">Vision AI</span>
        </Link>
        <div className="bg-white p-8 rounded-3xl shadow-xl shadow-blue-900/5 border border-slate-100">
          <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">Create an account</h2>
          <p className="text-slate-500 text-center mb-6 text-sm">Join Vision AI diagnostics</p>

          {error && <div className="p-3 mb-6 bg-red-50 text-red-600 rounded-lg text-sm text-center font-semibold">{error}</div>}
          {success && <div className="p-3 mb-6 bg-green-50 text-green-600 rounded-lg text-sm text-center font-semibold">{success}</div>}

          {step === 1 ? (
            <>
              <div className="flex p-1.5 mb-8 space-x-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${role === 'patient' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                  onClick={() => setRole('patient')}
                >
                  Patient
                </button>
                <button
                  type="button"
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${role === 'doctor' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                  onClick={() => setRole('doctor')}
                >
                  Doctor
                </button>
              </div>

              <form onSubmit={handleRequestOTP} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name</label>
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
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
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
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 h-5 w-5 text-slate-400" />
                    <input 
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
                  {loading ? 'Sending OTP...' : 'Register'}
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="text-slate-500 text-center mb-6 text-sm">
                A 10-minute temporary verification code has been generated.
              </p>
              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Verification Code (OTP)</label>
                  <div className="relative">
                    <Key className="absolute left-3.5 top-3 h-5 w-5 text-slate-400" />
                    <input 
                      type="text" 
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      className="w-full rounded-xl border-slate-200 bg-slate-50 pl-11 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" 
                      placeholder="Enter 6-digit code" 
                      required
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  disabled={loading}
                  className={`w-full inline-flex items-center justify-center rounded-xl text-md font-bold text-white bg-blue-600 hover:bg-blue-700 h-12 mt-4 transition-all shadow-lg hover:shadow-blue-500/30 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {loading ? 'Verifying...' : 'Verify & Create Account'}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-full text-center text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors mt-2"
                >
                  Go Back & Change Details
                </button>
              </form>
            </>
          )}

          <p className="text-center text-sm text-slate-500 mt-8 font-medium">
            Already have an account? <Link to="/login" className="text-blue-600 font-bold hover:underline">Log in</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
