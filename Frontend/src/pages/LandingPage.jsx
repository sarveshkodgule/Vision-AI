import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, Shield, Activity, ArrowRight, MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
    { role: 'bot', text: 'Hello! I am the VisionAssistant AI. How can I help you understand our services today?' }
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

  const handleSignOut = () => {
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
      const response = await fetch('http://127.0.0.1:8000/chatbot/general', {
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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navbar */}
      <nav className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Eye className="w-8 h-8 text-blue-600" />
            <span className="font-extrabold text-xl tracking-tight text-slate-800">VisionAssistant</span>
          </div>
          <div className="flex items-center space-x-4">
            {isLoggedIn ? (
              <>
                <Link 
                  to={userRole === 'doctor' ? '/doctor/dashboard' : '/patient/dashboard'} 
                  className="text-blue-600 font-bold hover:underline transition-all"
                >
                  Dashboard
                </Link>
                <button 
                  onClick={handleSignOut} 
                  className="bg-red-500 text-white px-4 py-2 rounded-md font-medium hover:bg-red-600 transition-colors"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-muted-foreground hover:text-foreground font-medium transition-colors">
                  Login
                </Link>
                <Link to="/signup" className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium hover:bg-primary/90 transition-colors">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32 grid md:grid-cols-2 gap-12 items-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-blue-100 text-blue-700 hover:bg-blue-200 mb-6 uppercase tracking-wider">
              Diagnostic Help Tool
            </div>
            <h1 className="text-4xl lg:text-6xl font-black tracking-tight text-slate-800 mb-6 leading-tight">
              Early Evaluation for <span className="text-blue-600">Clearer Vision</span>
            </h1>
            <p className="text-xl text-slate-500 mb-8 max-w-lg leading-relaxed font-medium">
              Empowering eye care with a precise Myopia Diagnostic and Risk Assessment Tool. Designed for rapid evaluation and actionable clinical insights.
            </p>
            <div className="flex space-x-4">
              {isLoggedIn ? (
                <Link 
                  to={userRole === 'doctor' ? '/doctor/dashboard' : '/patient/dashboard'} 
                  className="inline-flex items-center justify-center rounded-xl text-sm font-bold transition-colors shadow hover:shadow-md bg-blue-600 text-white hover:bg-blue-700 h-12 px-8"
                >
                  Go to Dashboard <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              ) : (
                <>
                  <Link to="/signup" className="inline-flex items-center justify-center rounded-xl text-sm font-bold transition-colors shadow hover:shadow-md bg-blue-600 text-white hover:bg-blue-700 h-12 px-8">
                    Start Evaluation <ArrowRight className="ml-2 w-4 h-4" />
                  </Link>
                  <Link to="/login" className="inline-flex items-center justify-center rounded-xl text-sm font-bold transition-colors border-2 border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 h-12 px-8">
                    Doctor Portal
                  </Link>
                </>
              )}
            </div>
          </motion.div>
          <motion.div 
            className="relative"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="aspect-square rounded-full bg-primary/10 absolute -inset-4 blur-3xl" />
            <img 
              src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" 
              alt="Medical Eye Examination" 
              className="relative rounded-2xl shadow-soft border border-border/50 object-cover w-full h-[400px]"
            />
          </motion.div>
        </section>

        {/* Features Section */}
        <section className="bg-muted/50 py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight mb-4">Advanced Risk Assessment</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Our platform combines cutting-edge deep learning with clinical risk factors to provide a holistic view of patient eye health.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {features.map((feature, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-card p-6 rounded-2xl border border-border shadow-sm hover:shadow-soft transition-all"
                >
                  <div className="rounded-xl bg-primary/10 w-16 h-16 flex items-center justify-center mb-6">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
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
              <h2 className="text-3xl font-black tracking-tight text-slate-800 mb-4">Where VisionAssistant Helps Doctors</h2>
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
                <p className="text-slate-600 text-sm leading-relaxed">In real life settings like schools, camps, and rural areas, one doctor cannot check thousands of people quickly. VisionAssistant enables mass screening.</p>
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
              <span className="font-bold text-slate-800 tracking-tight">VisionAssistant &copy; {new Date().getFullYear()}</span>
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
                  <h3 className="font-bold text-sm">VisionAssistant AI</h3>
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
