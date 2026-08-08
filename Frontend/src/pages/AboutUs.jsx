import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, Shield, Target, Users, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AboutUs() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      <nav className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2">
            <Eye className="w-8 h-8 text-blue-600" />
            <span className="font-extrabold text-xl tracking-tight text-slate-800">Vision AI</span>
          </Link>
          <button onClick={() => navigate(-1)} className="text-sm font-bold text-slate-500 hover:text-blue-600 flex items-center transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </button>
        </div>
      </nav>

      <main className="flex-1 max-w-5xl mx-auto px-6 py-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-16">
          <div className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold transition-colors border-transparent bg-teal-100 text-teal-700 uppercase tracking-wider mb-6">Our Mission</div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-6 leading-tight">Empowering Global Eye Care<br />Through Accessible Technologies</h1>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto font-medium leading-relaxed">Vision AI is a diagnostic enablement platform aimed at making progressive myopia risk assessment rapid, reliable, and accessible worldwide.</p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-12 mb-20 items-center">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
            <img src="https://images.unsplash.com/photo-1551076805-e1869033e561?w=800&q=80" alt="Team Research" className="rounded-3xl shadow-xl shadow-blue-900/10 border border-slate-200 object-cover aspect-[4/3]" />
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="space-y-6">
            <h2 className="text-3xl font-bold tracking-tight text-slate-800">The Problem We Solve</h2>
            <p className="text-slate-600 leading-relaxed text-sm">Myopia is rapidly becoming a global epidemic, leading to severe morphological complications if left unchecked. Unfortunately, the traditional 1-to-1 doctor-to-patient screening ratios make it impossible for widespread clinical interventions in developing environments or rural deployments.</p>
            <p className="text-slate-600 leading-relaxed text-sm">Vision AI utilizes advanced diagnostic computation to act as a preliminary screening partner for ophthalmologists. By automating risk synthesis and pattern detection, we effectively multiply the reach of qualified medical practitioners.</p>
          </motion.div>
        </div>

        <div className="grid sm:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm text-center">
            <Shield className="w-10 h-10 text-blue-600 mx-auto mb-4" />
            <h3 className="font-bold text-lg mb-2">Clinical Safety</h3>
            <p className="text-sm text-slate-500">Built securely on regulated medical standards, designed always as an assistant—not a replacement.</p>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm text-center">
            <Target className="w-10 h-10 text-blue-600 mx-auto mb-4" />
            <h3 className="font-bold text-lg mb-2">Precision Analysis</h3>
            <p className="text-sm text-slate-500">Integrating demographic factors alongside algorithmic fundus topography mapped grading.</p>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm text-center">
            <Users className="w-10 h-10 text-blue-600 mx-auto mb-4" />
            <h3 className="font-bold text-lg mb-2">Patient First</h3>
            <p className="text-sm text-slate-500">Ensuring clear communication of proactive lifestyle intervention directly to those at risk.</p>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white py-12">
        <div className="max-w-7xl mx-auto px-6 text-center text-slate-500 text-sm font-semibold">
          &copy; {new Date().getFullYear()} Vision AI Diagnostic Systems. For informational purposes only.
        </div>
      </footer>
    </div>
  );
}
