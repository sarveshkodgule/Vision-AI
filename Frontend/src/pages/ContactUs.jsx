import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, Mail, MapPin, Phone, ArrowLeft, Send, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ContactUs() {
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

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

      <main className="flex-1 max-w-6xl mx-auto px-6 py-16 w-full">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-16">
          <div className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold transition-colors border-transparent bg-indigo-100 text-indigo-700 uppercase tracking-wider mb-6">Get in Touch</div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">Contact Our Team</h1>
          <p className="text-lg text-slate-500 max-w-xl mx-auto font-medium">Have inquiries regarding enterprise clinic deployments or academic research collaboration? We'd love to hear from you.</p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-12 bg-white rounded-3xl border border-slate-200 shadow-xl shadow-blue-900/5 p-4 sm:p-8 overflow-hidden">
          {/* Left Panel */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-8 text-white flex flex-col justify-between relative shadow-inner">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none"><Eye className="w-48 h-48" /></div>
            
            <div className="relative z-10">
              <h2 className="text-2xl font-bold mb-2">Contact Information</h2>
              <p className="text-blue-100 mb-12 text-sm">Fill out the form and our team will get back to you within 24 hours.</p>

              <div className="space-y-8">
                <div className="flex items-start">
                  <Phone className="w-5 h-5 mr-4 text-blue-300" />
                  <div>
                    <h3 className="font-bold text-sm">Phone</h3>
                    <p className="text-blue-100 text-sm mt-1">+1 (800) 123-4567</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <Mail className="w-5 h-5 mr-4 text-blue-300" />
                  <div>
                    <h3 className="font-bold text-sm">Email Support</h3>
                    <p className="text-blue-100 text-sm mt-1">clinical@visionai.com</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <MapPin className="w-5 h-5 mr-4 text-blue-300" />
                  <div>
                    <h3 className="font-bold text-sm">Headquarters</h3>
                    <p className="text-blue-100 text-sm mt-1 leading-relaxed">123 HealthTech Valley<br/>Innovation District, CA 94000</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-12 text-xs font-medium text-blue-200 relative z-10">
              Operating Hours: Mon - Fri, 9:00 AM - 5:00 PM PST
            </div>
          </div>

          {/* Right Panel (Form) */}
          <div className="lg:col-span-2 p-4 sm:p-8">
            {submitted ? (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="h-full flex flex-col items-center justify-center text-center space-y-4 min-h-[400px]">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-green-600" />
                </div>
                <h3 className="text-3xl font-black text-slate-800">Message Sent!</h3>
                <p className="text-slate-500 max-w-md">Thank you for reaching out. A representative from our clinical routing team will follow up via email shortly.</p>
                <button onClick={() => setSubmitted(false)} className="mt-6 text-sm font-bold text-blue-600 hover:text-blue-800 hover:underline">Send another message</button>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">First Name</label>
                    <input type="text" required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all focus:bg-white shadow-sm" placeholder="Dr. John" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Last Name</label>
                    <input type="text" required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all focus:bg-white shadow-sm" placeholder="Doe" />
                  </div>
                </div>
                
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Email Address</label>
                    <input type="email" required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all focus:bg-white shadow-sm" placeholder="name@clinic.com" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Subject</label>
                    <select required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all focus:bg-white shadow-sm">
                      <option>General Inquiry</option>
                      <option>Enterprise Deployment</option>
                      <option>Research Collaboration</option>
                      <option>Technical Support</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Message</label>
                  <textarea required rows="6" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all focus:bg-white shadow-sm resize-none" placeholder="How can we help you?"></textarea>
                </div>

                <div className="flex justify-end pt-4">
                  <button type="submit" className="bg-blue-600 text-white px-8 py-3.5 rounded-xl font-bold text-md hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all flex items-center">
                    Send Message <Send className="w-4 h-4 ml-2" />
                  </button>
                </div>
              </form>
            )}
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
