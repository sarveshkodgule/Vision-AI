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
          <span className="font-extrabold text-3xl tracking-tight">VisionAssistant</span>
        </Link>
        <div className="bg-white p-8 rounded-3xl shadow-xl shadow-blue-900/5 border border-slate-100">
          <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">Welcome back</h2>
          <p className="text-slate-500 text-center mb-6 text-sm">Sign in safely to your account</p>

          {error && <div className="p-3 mb-6 bg-red-50 text-red-600 rounded-lg text-sm text-center font-semibold">{error}</div>}

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

          <form onSubmit={handleLogin} className="space-y-4">
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
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border-slate-200 bg-slate-50 pl-11 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" 
                  placeholder="••••••••" 
                  required
                />
              </div>
            </div>
            <div className="flex items-center justify-between text-sm py-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-600" />
                <span className="text-slate-600 font-medium">Remember me</span>
              </label>
              <Link to="/forgot-password" className="text-blue-600 hover:underline font-bold transition-colors">Forgot password?</Link>
            </div>
            <button 
              type="submit"
              disabled={loading}
              className={`w-full inline-flex items-center justify-center rounded-xl text-md font-bold text-white bg-blue-600 hover:bg-blue-700 h-12 mt-2 transition-all shadow-lg hover:shadow-blue-500/30 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
          <p className="text-center text-sm text-slate-500 mt-8 font-medium">
            Don't have an account? <Link to="/signup" className="text-blue-600 font-bold hover:underline">Sign up</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
