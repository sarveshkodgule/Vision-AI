import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, Mail, Lock, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';

export default function Login() {
  const navigate = useNavigate();
  const [role, setRole] = useState('patient');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // FastAPI automated UI endpoints typically require OAuth2 Form Data for security
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const data = await api.post('/auth/login', formData, true);
      
      if (data.access_token) {
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('role', role);
        
        if (role === 'doctor') {
          navigate('/doctor/dashboard', { replace: true });
        } else {
          navigate('/patient/dashboard', { replace: true });
        }
      } else {
        setError(data.detail || data.message || "Failed to login. Please check your credentials.");
      }
    } catch (err) {
      setError("Server error. Ensure the FastAPI backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white overflow-hidden relative">
      {/* Back Button floating */}
      <button 
        onClick={() => navigate(-1)} 
        className="absolute top-6 left-6 z-50 inline-flex items-center gap-1.5 text-xs font-black text-slate-500 hover:text-blue-600 bg-white/80 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-100 hover:border-slate-200 shadow-sm transition-all active:scale-95 cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back
      </button>

      {/* Left Panel: High Fidelity Graphic & Insights Panel (Hidden on Mobile) */}
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-tr from-slate-900 via-indigo-950 to-blue-900 relative p-12 flex-col justify-between overflow-hidden">
        {/* Glowing Background Radial Blur */}
        <div className="absolute top-[-10%] right-[-10%] w-[350px] h-[350px] rounded-full bg-blue-500/20 blur-[80px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[350px] h-[350px] rounded-full bg-teal-500/20 blur-[80px]" />
        
        {/* Brand Header */}
        <Link to="/" className="flex items-center space-x-2 text-white relative z-10">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/30">
            <Eye className="w-5 h-5 text-white" />
          </div>
          <span className="font-extrabold text-xl tracking-tight">VisionAssistant</span>
        </Link>

        {/* Feature Highlights */}
        <div className="relative z-10 max-w-md my-auto text-left">
          <h2 className="text-3xl font-black text-white leading-tight mb-4">
            Securing Diagnostics for Better Patient Outcomes
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed mb-8">
            Access your secure portal to manage diagnostics, view live clinical analytics, and analyze retinal scans with explainable AI markers.
          </p>

          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs mt-0.5">✓</div>
              <p className="text-slate-300 text-xs font-semibold leading-relaxed">Integrated PyTorch FundusCNN model inference with Grad-CAM overlays.</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs mt-0.5">✓</div>
              <p className="text-slate-300 text-xs font-semibold leading-relaxed">Interactive time-series progression curves for refractive indicators.</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs mt-0.5">✓</div>
              <p className="text-slate-300 text-xs font-semibold leading-relaxed">Advanced input sanitization & rate limit protection.</p>
            </div>
          </div>
        </div>

        {/* Footer Warning */}
        <p className="text-[10px] text-slate-400 relative z-10 tracking-wider">
          VisionCare Diagnostic System &copy; {new Date().getFullYear()}
        </p>
      </div>

      {/* Right Panel: Clean Centered Login Form */}
      <div className="w-full lg:w-[55%] flex items-center justify-center p-6 sm:p-12 bg-slate-50/50">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-md w-full"
        >
          {/* Logo showing only on mobile */}
          <Link to="/" className="flex lg:hidden items-center justify-center mb-8 space-x-2 text-slate-800">
            <Eye className="w-7 h-7 text-blue-600" />
            <span className="font-extrabold text-2xl tracking-tight">VisionAssistant</span>
          </Link>

          <div className="bg-white p-8 sm:p-10 rounded-3xl shadow-xl shadow-slate-900/5 border border-slate-100/50 text-left">
            <h3 className="text-2xl font-black text-slate-800 mb-1">Welcome Back</h3>
            <p className="text-slate-500 text-xs font-semibold mb-6">Sign in safely to access clinical records</p>

            {error && <div className="p-3 mb-6 bg-red-50 text-red-600 rounded-xl text-xs text-center font-bold border border-red-100">{error}</div>}

            <div className="flex p-1.5 mb-6 bg-slate-100 rounded-xl">
              <button
                type="button"
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${role === 'patient' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                onClick={() => setRole('patient')}
              >
                Patient Portal
              </button>
              <button
                type="button"
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${role === 'doctor' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                onClick={() => setRole('doctor')}
              >
                Doctor Portal
              </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-11 pr-4 py-3 text-xs font-semibold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none" 
                    placeholder="name@example.com" 
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-11 pr-4 py-3 text-xs font-semibold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none" 
                    placeholder="••••••••" 
                    required
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-between text-xs py-1.5">
                <label className="flex items-center space-x-2 cursor-pointer select-none">
                  <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-600" />
                  <span className="text-slate-500 font-semibold">Keep me signed in</span>
                </label>
                <Link to="/forgot-password" className="text-blue-600 hover:underline font-extrabold transition-colors">Forgot Password?</Link>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className={`w-full inline-flex items-center justify-center rounded-xl text-xs font-black text-white bg-blue-600 hover:bg-blue-700 h-12 mt-2 transition-all shadow-md shadow-blue-500/10 hover:shadow-blue-500/25 active:scale-95 cursor-pointer ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {loading ? 'Verifying Account...' : 'Sign In'}
              </button>
            </form>
            
            <p className="text-center text-xs text-slate-500 mt-8 font-semibold">
              Don't have a portal account? <Link to="/signup" className="text-blue-600 font-extrabold hover:underline">Get Started</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
