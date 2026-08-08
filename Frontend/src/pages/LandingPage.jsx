import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, Shield, Activity, ArrowRight, MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, API_BASE_URL } from '../lib/api';

export default function LandingPage() {
  const navigate = useNavigate();
  const features = [
    {
      icon: <Eye className="w-8 h-8 text-blue-600" />,
      title: "Diagnostic Evaluation",
      description: "Advanced computational models evaluate fundus images for accurate myopia risk assessment."
    },
    {
      icon: <Activity className="w-8 h-8 text-primary" />,
      title: "Risk Analysis",
      description: "Comprehensive severity grading and lifestyle risk scoring for proactive care."
    },
    {
      icon: <Shield className="w-8 h-8 text-primary" />,
      title: "Doctor Dashboard",
      description: "Detailed analytics and patient management tools for healthcare professionals."
    }
  ];

  // Chatbot State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { role: 'bot', text: 'Hello! I am the Vision AI Assistant. How can I help you understand our services today?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  // Session State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    if (token) {
      setIsLoggedIn(true);
      setUserRole(role);
      // Automatically redirect to their dashboard if they are already logged in
      navigate(role === 'doctor' ? '/doctor/dashboard' : '/patient/dashboard', { replace: true });
    }
  }, [navigate]);

  const handleSignOut = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error("Logout backend request failed:", err);
    }
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    setIsLoggedIn(false);
    setUserRole(null);
  };

  useEffect(() => {
    if (isChatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatOpen]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    const newMsg = { role: 'user', text: chatInput };
    setChatMessages(prev => [...prev, newMsg]);
    setChatInput('');
    setIsChatLoading(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/chatbot/general`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMsg.text })
      });
      const data = await response.json();
      if (data.status === 'success') {
        setChatMessages(prev => [...prev, { role: 'bot', text: data.data.response }]);
      } else {
        setChatMessages(prev => [...prev, { role: 'bot', text: "Sorry, I couldn't process that. Please try again." }]);
      }
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'bot', text: "Network error connecting to the AI system." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 flex flex-col relative overflow-hidden">
      {/* Background Decorative Blur Orbs */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-blue-300/10 to-indigo-300/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-br from-teal-200/10 to-blue-200/10 blur-[130px] pointer-events-none" />

      {/* Navbar */}
      <nav className="border-b border-slate-100 bg-white/70 backdrop-blur-xl sticky top-0 z-50 transition-all duration-300 shadow-sm shadow-slate-100/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform duration-300">
              <Eye className="w-5 h-5 text-white" />
            </div>
            <span className="font-extrabold text-2xl tracking-tight bg-gradient-to-r from-slate-800 to-slate-900 bg-clip-text text-transparent">Vision AI</span>
          </div>
          <div className="flex items-center space-x-6">
            {isLoggedIn ? (
              <>
                <Link 
                  to={userRole === 'doctor' ? '/doctor/dashboard' : '/patient/dashboard'} 
                  className="text-blue-600 font-extrabold hover:text-blue-700 transition-colors text-sm"
                >
                  Go to Dashboard
                </Link>
                <button 
                  onClick={handleSignOut} 
                  className="bg-red-500 text-white px-5 py-2.5 rounded-xl font-bold text-xs hover:bg-red-600 shadow-md shadow-red-500/10 hover:shadow-red-500/20 active:scale-95 transition-all cursor-pointer"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-slate-600 hover:text-blue-600 font-bold text-sm transition-colors">
                  Login
                </Link>
                <Link to="/signup" className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold text-xs hover:opacity-95 shadow-md shadow-blue-500/10 hover:shadow-blue-500/25 active:scale-95 transition-all cursor-pointer">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 grid lg:grid-cols-12 gap-16 items-center">
          <motion.div 
            className="lg:col-span-7 text-left"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <div className="inline-flex items-center rounded-full border border-blue-200/50 px-4 py-1.5 text-xs font-black bg-blue-50 text-blue-700 mb-8 uppercase tracking-widest">
              🧬 Clinical Decision Support Tool
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-800 mb-6 leading-[1.12]">
              Early Screening for <br />
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-teal-500 bg-clip-text text-transparent">Clearer Vision</span>
            </h1>
            <p className="text-lg text-slate-500 mb-10 max-w-xl leading-relaxed font-medium">
              Empowering eye care professionals with an advanced clinical screening and myopia risk assessment platform. Engineered for swift analysis, automated biometry compilation, and explainable AI overlays.
            </p>
            <div className="flex flex-wrap gap-4">
              {isLoggedIn ? (
                <Link 
                  to={userRole === 'doctor' ? '/doctor/dashboard' : '/patient/dashboard'} 
                  className="inline-flex items-center justify-center rounded-2xl text-sm font-extrabold transition-all shadow-lg shadow-blue-500/20 bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-xl hover:shadow-blue-500/30 hover:opacity-98 active:scale-95 h-14 px-8 group cursor-pointer"
                >
                  Go to Dashboard <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              ) : (
                <>
                  <Link to="/signup" className="inline-flex items-center justify-center rounded-2xl text-sm font-extrabold transition-all shadow-lg shadow-blue-500/20 bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-xl hover:shadow-blue-500/30 hover:opacity-98 active:scale-95 h-14 px-8 group cursor-pointer">
                    Start Evaluation <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <Link to="/login" className="inline-flex items-center justify-center rounded-2xl text-sm font-extrabold transition-all border-2 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800 h-14 px-8 active:scale-95 cursor-pointer">
                    Doctor Portal
                  </Link>
                </>
              )}
            </div>
          </motion.div>
          
          <motion.div 
            className="lg:col-span-5 relative"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {/* Soft background glow */}
            <div className="absolute -inset-4 bg-gradient-to-tr from-blue-500/20 to-indigo-500/20 rounded-[40px] blur-3xl pointer-events-none animate-pulse" />
            
            {/* Dark Clinical Glass console widget */}
            <div className="relative bg-slate-900 border border-slate-800 p-6 rounded-[32px] shadow-2xl overflow-hidden font-mono text-slate-300">
              {/* Header bar */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-ping" />
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">System Online: AI-V2</span>
                </div>
                <span className="text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded font-black">SCAN_READY</span>
              </div>

              {/* Scanning visual area using CSS and inline styles */}
              <div className="w-full aspect-[4/3] rounded-2xl bg-slate-950 border border-slate-800/80 flex flex-col items-center justify-center relative overflow-hidden my-4 group">
                {/* Simulated grid lines */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:1.5rem_1.5rem] opacity-30" />
                
                {/* Glowing crosshair */}
                <div className="absolute w-6 h-6 border-t-2 border-l-2 border-blue-500 top-4 left-4" />
                <div className="absolute w-6 h-6 border-t-2 border-r-2 border-blue-500 top-4 right-4" />
                <div className="absolute w-6 h-6 border-b-2 border-l-2 border-blue-500 bottom-4 left-4" />
                <div className="absolute w-6 h-6 border-b-2 border-r-2 border-blue-500 bottom-4 right-4" />

                {/* Animated Scanner Radar */}
                <div className="w-44 h-44 rounded-full border border-blue-500/20 flex items-center justify-center relative animate-[pulse_4s_infinite]">
                  <div className="w-32 h-32 rounded-full border border-indigo-500/30 flex items-center justify-center relative">
                    {/* Simulated retina scan heatmap using gradient */}
                    <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-600/40 via-indigo-600/30 to-rose-600/40 border border-blue-400/50 flex items-center justify-center relative shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                      <div className="w-6 h-6 rounded-full bg-blue-500/20 border-2 border-blue-400/80 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                    </div>
                  </div>
                  {/* Scanner line sweep */}
                  <div className="absolute inset-0 rounded-full border-t-2 border-blue-400/60 animate-spin" />
                </div>

                <div className="absolute bottom-3 left-4 text-[9px] text-slate-500 tracking-wider">CAM_MODE: ACTIVE</div>
                <div className="absolute bottom-3 right-4 text-[9px] text-teal-400 font-bold tracking-wider animate-pulse">94.2% FIT</div>
              </div>

              {/* Simulated parameters display */}
              <div className="grid grid-cols-2 gap-3 mt-4 pt-2 border-t border-slate-800">
                <div className="bg-slate-950/60 border border-slate-800/60 p-3 rounded-xl">
                  <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Axial Length</div>
                  <div className="text-sm font-black text-slate-200">23.45 mm</div>
                </div>
                <div className="bg-slate-950/60 border border-slate-800/60 p-3 rounded-xl">
                  <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Refractive Error</div>
                  <div className="text-sm font-black text-slate-200">-1.25 D</div>
                </div>
                <div className="bg-slate-950/60 border border-slate-800/60 p-3 rounded-xl col-span-2 flex justify-between items-center">
                  <div>
                    <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-0.5">Calculated Severity</div>
                    <div className="text-xs font-black text-emerald-400">Low Risk Myopia</div>
                  </div>
                  <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded-lg font-bold">CLEARED</span>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Features Section */}
        <section className="bg-slate-50/50 py-24 border-t border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-20">
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-800 mb-4">Advanced Risk Assessment</h2>
              <p className="text-slate-500 max-w-xl mx-auto text-md leading-relaxed font-semibold">
                Combining high-accuracy neural networks with multi-factor clinical variables to offer a holistic screening dashboard.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {features.map((feature, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1, duration: 0.5 }}
                  className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-blue-500/5 hover:-translate-y-1 transition-all duration-300 text-left"
                >
                  <div className="rounded-2xl bg-blue-50 w-14 h-14 flex items-center justify-center mb-6">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-3">{feature.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed font-medium">
                    {feature.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Clinical Value Section */}
        <section className="bg-white py-24 border-t border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-black tracking-tight text-slate-800 mb-4">Where Vision AI Helps Doctors</h2>
              <p className="text-slate-500 max-w-2xl mx-auto text-lg leading-relaxed font-medium">
                Built for real-world clinical environments to alleviate screening pressure, organize data, and enhance diagnostic consistency.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              
              <div className="bg-blue-50/50 p-8 rounded-3xl border border-blue-100 hover:shadow-lg hover:shadow-blue-500/5 transition-all group">
                <div className="w-12 h-12 bg-blue-100 group-hover:bg-blue-600 text-blue-700 group-hover:text-white transition-colors rounded-xl flex items-center justify-center font-black text-xl mb-6 shadow-sm">1</div>
                <h3 className="text-xl font-bold text-slate-800 mb-3">Saves Time in Routine Screening</h3>
                <p className="text-slate-600 text-sm leading-relaxed">Doctors see many patients daily. Our system pre-analyzes images and flags risky cases so professionals can focus energy on serious patients.</p>
              </div>

              <div className="bg-indigo-50/50 p-8 rounded-3xl border border-indigo-100 hover:shadow-lg hover:shadow-indigo-500/5 transition-all group">
                <div className="w-12 h-12 bg-indigo-100 group-hover:bg-indigo-600 text-indigo-700 group-hover:text-white transition-colors rounded-xl flex items-center justify-center font-black text-xl mb-6 shadow-sm">2</div>
                <h3 className="text-xl font-bold text-slate-800 mb-3">Handles Large-Scale Screening</h3>
                <p className="text-slate-600 text-sm leading-relaxed">In real life settings like schools, camps, and rural areas, one doctor cannot check thousands of people quickly. Vision AI enables mass screening.</p>
              </div>

              <div className="bg-teal-50/50 p-8 rounded-3xl border border-teal-100 hover:shadow-lg hover:shadow-teal-500/5 transition-all group">
                <div className="w-12 h-12 bg-teal-100 group-hover:bg-teal-600 text-teal-700 group-hover:text-white transition-colors rounded-xl flex items-center justify-center font-black text-xl mb-6 shadow-sm">3</div>
                <h3 className="text-xl font-bold text-slate-800 mb-3">Provides Structured Data</h3>
                <p className="text-slate-600 text-sm leading-relaxed">Instead of relying strictly on memory or paper notes, the system automatically stores patient history, shows long-term trends, and organizes reports.</p>
              </div>

              <div className="bg-purple-50/50 p-8 rounded-3xl border border-purple-100 hover:shadow-lg hover:shadow-purple-500/5 transition-all group">
                <div className="w-12 h-12 bg-purple-100 group-hover:bg-purple-600 text-purple-700 group-hover:text-white transition-colors rounded-xl flex items-center justify-center font-black text-xl mb-6 shadow-sm">4</div>
                <h3 className="text-xl font-bold text-slate-800 mb-3">Adds Diagnostic Consistency</h3>
                <p className="text-slate-600 text-sm leading-relaxed">Humans get tired and may miss small morphological patterns. AI gives consistent analysis every single time, drastically reducing human error.</p>
              </div>

              <div className="bg-amber-50/50 p-8 rounded-3xl border border-amber-100 hover:shadow-lg hover:shadow-amber-500/5 transition-all group md:col-span-2 lg:col-span-1">
                <div className="w-12 h-12 bg-amber-100 group-hover:bg-amber-600 text-amber-700 group-hover:text-white transition-colors rounded-xl flex items-center justify-center font-black text-xl mb-6 shadow-sm">5</div>
                <h3 className="text-xl font-bold text-slate-800 mb-3">Awareness & Prevention</h3>
                <p className="text-slate-600 text-sm leading-relaxed">Doctors usually see patients after severe problems occur. Our tool warns of early risk and suggests lifestyle changes for prevention, not just treatment.</p>
              </div>

            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t bg-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center text-slate-500 mb-6">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <Eye className="w-6 h-6 text-blue-600" />
              <span className="font-bold text-slate-800 tracking-tight">Vision AI &copy; {new Date().getFullYear()}</span>
            </div>
            <div className="flex space-x-6 text-sm font-semibold">
              <Link to="/about" className="hover:text-blue-600 transition-colors">About Us</Link>
              <Link to="/contact" className="hover:text-blue-600 transition-colors">Contact Us</Link>
              <Link to="/login" className="hover:text-blue-600 transition-colors">Doctor Portal</Link>
            </div>
          </div>
          <p className="text-sm text-center md:text-left text-slate-400">For investigational and diagnostic support purposes only.</p>
        </div>
      </footer>
      {/* Floating Chatbot Widget */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col z-50 h-[500px]"
          >
            <div className="bg-blue-600 p-4 flex justify-between items-center text-white">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <Eye className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Vision AI Assistant</h3>
                  <p className="text-[10px] text-blue-100 opacity-90 uppercase tracking-widest font-bold">Generative Support</p>
                </div>
              </div>
              <button onClick={() => setIsChatOpen(false)} className="text-blue-100 hover:text-white transition-colors bg-blue-700/50 hover:bg-blue-700 p-1.5 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 p-4 overflow-y-auto bg-slate-50 space-y-4">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-sm shadow-md' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm shadow-sm'}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 text-slate-500 p-3 rounded-2xl rounded-tl-sm flex items-center shadow-sm">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Typing...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            
            <div className="p-3 border-t border-slate-100 bg-white">
              <form onSubmit={handleSendMessage} className="flex relative items-center">
                <input 
                  type="text" 
                  placeholder="Ask about Myopia..." 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  disabled={isChatLoading}
                />
                <button type="submit" disabled={isChatLoading || !chatInput.trim()} className="absolute right-2 w-8 h-8 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg flex items-center justify-center transition-colors">
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button 
        onClick={() => setIsChatOpen(!isChatOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full shadow-xl shadow-blue-500/30 flex items-center justify-center hover:scale-105 transition-all z-50 border border-white/20"
      >
        <MessageCircle className="w-6 h-6" />
      </button>

    </div>
  );
}
