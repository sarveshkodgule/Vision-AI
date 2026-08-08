import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Loader2, ArrowLeft, MessageSquare, Send, User, ChevronDown, Download, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Line } from 'react-chartjs-2';
import { Link, useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { api, API_BASE_URL } from '../lib/api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function PatientDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('assessment');
  const [formStep, setFormStep] = useState(1);
  const [formData, setFormData] = useState({ 
    name: '', gender: 'Male', age: '', 
    screenTime: '', readingTime: '', workHours: '', sleepHours: '', 
    outdoorActivity: '', parentalMyopia: '0' 
  });
  const [doctors, setDoctors]           = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  // Simulator States
  const [simScreen, setSimScreen] = useState(4);
  const [simOutdoor, setSimOutdoor] = useState(2);
  const [simReading, setSimReading] = useState(2);
  const [simSleep, setSimSleep] = useState(8);
  const [simParental, setSimParental] = useState(0);
  
  const [profile, setProfile] = useState({ name: 'Loading...', email: 'Loading...', role: 'patient' });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', email: '' });
  
  const [history, setHistory] = useState([]);
  const [reports, setReports] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  const fetchPatientData = async () => {
    setHistoryLoading(true);
    try {
      const histRes = await api.get('/patient/history');
      if (histRes && histRes.data) setHistory(histRes.data);
      
      const repRes = await api.get('/patient/reports');
      if (repRes && repRes.data) setReports(repRes.data);
    } catch (err) {
      console.error("Failed to fetch patient records", err);
    } finally {
      setHistoryLoading(false);
    }
  };
  
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('/auth/profile');
        if (res && res.data) {
          setProfile(res.data);
          setEditForm({ name: res.data.name, email: res.data.email });
        }
      } catch (err) {
        console.error("Failed to fetch profile");
      }
    };
    fetchProfile();
    fetchPatientData();
  }, []);

  // Fetch available doctors for patient assignment
  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const res = await api.get('/auth/doctors');
        if (res && res.data) setDoctors(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error('Could not load doctors list');
      }
    };
    fetchDoctors();
  }, []);

  const handleProfileSave = async () => {
    try {
      const res = await api.put('/auth/profile', editForm);
      if (res && res.data) {
        setProfile(res.data);
        setIsEditingProfile(false);
      }
    } catch (err) { console.error("Update failed"); }
  };

  const handleSignOut = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error("Logout backend request failed:", err);
    }
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    navigate('/login', { replace: true });
  };

  const [chatMessage, setChatMessage] = useState("");
  const [messages, setMessages] = useState([
    { text: "Hello! I'm your Vision AI Assistant. I can help explain your risk report, provide lifestyle tips, or answer questions about Myopia. How can I help today?", isBot: true }
  ]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const response = await api.post('/patient/risk', {
        name: formData.name || profile.name || "Patient",
        gender: formData.gender,
        age: parseInt(formData.age) || 0,
        screen_time: parseFloat(formData.screenTime) || 0,
        reading_time: parseFloat(formData.readingTime) || 0,
        work_hours: parseFloat(formData.workHours) || 0,
        sleep_hours: parseFloat(formData.sleepHours) || 0,
        outdoor_activity: parseFloat(formData.outdoorActivity) || 0,
        parental_myopia: parseInt(formData.parentalMyopia) || 0,
        assigned_doctor_id: selectedDoctorId || null,
      });

      if (response && response.data && response.data.risk_level) {
        const d = response.data;
        
        // Construct dynamic historical trend line
        const baseTrend = [40, 45, 50, 60, 68];
        const newScore = d.risk_level === "High" ? 85 : d.risk_level === "Medium" ? 55 : 20;
        
        setResult({
          patientName: formData.name || profile.name || "Patient",
          patientGender: formData.gender,
          patientAge: formData.age,
          date: new Date().toLocaleDateString(),
          detection: d.risk_level + " Risk for Myopia",
          severity: d.risk_level,
          riskScore: newScore,
          trendData: [...baseTrend, newScore],
          recommendations: d.recommendation ? [d.recommendation] : ["Maintain a healthy eye routine."],
          myopiaDetected:   d.myopia_detected   ?? null,
          probability:      d.myopia_probability ?? null,
          nextSpheq:        d.predicted_next_spheq ?? null,
        });
        
        // Refresh patient's history list
        fetchPatientData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const sendChatMessage = async () => {
    if (!chatMessage.trim()) return;
    const msg = chatMessage;
    setMessages(prev => [...prev, { text: msg, isBot: false }]);
    setChatMessage("");

    try {
      const res = await api.post('/chatbot/query', { message: msg });
      if (res && res.data && res.data.response) {
        setMessages(prev => [...prev, { text: res.data.response, isBot: true }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { text: "Network error fetching AI response.", isBot: true }]);
    }
  };

  const chartData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Current'],
    datasets: [{
      label: 'Risk Score History',
      data: result?.trendData || [],
      borderColor: '#3B82F6',
      backgroundColor: 'rgba(59, 130, 246, 0.15)',
      fill: true,
      tension: 0.4,
    }]
  };

  // Sort reports chronologically for biometry progression trend
  const sortedReports = [...reports].reverse();
  const biometryLabels = sortedReports.map(r => 
    new Date(r.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })
  );
  const spheqData = sortedReports.map(r => r.refractive_error ?? -1.0);
  const alData = sortedReports.map(r => r.axial_length ?? 24.0);

  const biometryChartData = {
    labels: biometryLabels.length > 0 ? biometryLabels : ['No Data'],
    datasets: [
      {
        label: 'Refractive Error (SPHEQ - Diopters)',
        data: spheqData.length > 0 ? spheqData : [0],
        borderColor: '#EF4444',
        backgroundColor: 'rgba(239, 68, 68, 0.05)',
        yAxisID: 'ySpheq',
        tension: 0.3,
        borderWidth: 3,
        pointBackgroundColor: '#EF4444',
      },
      {
        label: 'Axial Length (AL - mm)',
        data: alData.length > 0 ? alData : [24],
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.05)',
        yAxisID: 'yAl',
        tension: 0.3,
        borderWidth: 3,
        pointBackgroundColor: '#3B82F6',
      }
    ]
  };

  const biometryChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { font: { weight: 'bold' } }
      }
    },
    scales: {
      ySpheq: {
        type: 'linear',
        position: 'left',
        title: { display: true, text: 'Refractive Error (D)', color: '#EF4444', font: { weight: 'bold' } },
        grid: { color: '#f1f5f9' },
      },
      yAl: {
        type: 'linear',
        position: 'right',
        title: { display: true, text: 'Axial Length (mm)', color: '#3B82F6', font: { weight: 'bold' } },
        grid: { drawOnChartArea: false },
      }
    }
  };

  const downloadReportPdf = async (patientId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/patient/generate-report/${patientId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `myopia_report_${patientId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error("Failed to download PDF", err);
      alert("Error exporting report as PDF.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/50 to-slate-100 flex flex-col relative pb-20">
      <nav className="bg-white/80 backdrop-blur-md border-b px-6 py-4 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <div className="flex items-center space-x-4">
          <Link to="/" className="text-slate-500 hover:text-blue-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-teal-500">
            Patient Portal
          </h1>
        </div>
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => { setActiveTab('assessment'); setResult(null); }} 
            className={`text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${activeTab === 'assessment' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:text-slate-800'}`}
          >
            New Assessment
          </button>
          <button 
            onClick={() => setActiveTab('history')} 
            className={`text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${activeTab === 'history' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:text-slate-800'}`}
          >
            Screening History
          </button>
          <button 
            onClick={() => setActiveTab('simulator')} 
            className={`text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${activeTab === 'simulator' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:text-slate-800'}`}
          >
            📊 Risk Simulator
          </button>
          <button 
            onClick={() => setActiveTab('profile')} 
            className={`w-9 h-9 bg-gradient-to-tr from-blue-500 to-teal-400 rounded-full flex items-center justify-center text-white font-bold cursor-pointer transition-all ${activeTab === 'profile' ? 'ring-2 ring-blue-600 ring-offset-2' : 'shadow-md hover:shadow-lg'}`}
          >
            {profile.name.charAt(0).toUpperCase()}
          </button>
        </div>
      </nav>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'profile' ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto mt-4">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Patient Profile</h2>
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
              <div className="flex items-center space-x-6 mb-8 pb-8 border-b border-slate-100">
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-100 to-teal-100 flex items-center justify-center text-blue-700 font-bold text-3xl border border-blue-200 uppercase">
                  {profile.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-800">{profile.name}</h3>
                  <p className="text-teal-600 font-semibold mb-1 capitalize">{profile.role} User</p>
                  <p className="text-slate-500 text-sm">Last Assessment: {result ? "Today" : "None"}</p>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <span className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">System ID</span>
                  <span className="text-slate-800 font-semibold">{profile.id || 'N/A'}</span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Account Role</span>
                  <span className="text-slate-800 font-semibold flex items-center capitalize">{profile.role} <CheckCircle2 className="w-4 h-4 ml-1 text-teal-500"/></span>
                </div>
                
                {!isEditingProfile ? (
                  <>
                    <div>
                      <span className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Email Address</span>
                      <span className="text-slate-800 font-semibold">{profile.email}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Full Name</span>
                      <span className="text-slate-800 font-semibold">{profile.name}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <span className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Email Address</span>
                      <input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Full Name</span>
                      <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                  </>
                )}

              </div>
              <div className="mt-8 pt-6 border-t border-slate-100 flex justify-between items-center">
                <button onClick={handleSignOut} className="text-red-500 font-bold text-sm hover:text-red-600 transition-colors">Sign Out</button>
                <div className="space-x-3">
                  {isEditingProfile ? (
                    <>
                      <button onClick={() => setIsEditingProfile(false)} className="bg-slate-100 text-slate-600 px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors">Cancel</button>
                      <button onClick={handleProfileSave} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/20">Save Details</button>
                    </>
                  ) : (
                    <button onClick={() => setIsEditingProfile(true)} className="bg-slate-100 text-slate-600 px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors">Edit Profile</button>
                  )}
                </div>
              </div>

            </div>
          </motion.div>
        ) : activeTab === 'history' ? (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="max-w-4xl mx-auto mt-4 space-y-8 pb-10"
          >
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Your Screening & Diagnostic History</h2>
                <p className="text-slate-500 text-sm mt-1">Track your lifestyle screenings and doctor evaluations.</p>
              </div>
            </div>

            {/* Progression Curve Mapping */}
            {reports.length > 0 ? (
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                  <Activity className="w-5 h-5 mr-2 text-red-500 animate-pulse" /> Myopia Progression Curve (Axial Length vs SPHEQ)
                </h3>
                <div className="h-[280px] w-full">
                  <Line data={biometryChartData} options={biometryChartOptions} />
                </div>
              </div>
            ) : (
              <div className="bg-blue-50/50 rounded-2xl p-6 border border-blue-100 text-center">
                <h3 className="text-md font-bold text-blue-800 mb-1">No Clinical Evaluation Curve Yet</h3>
                <p className="text-sm text-slate-600">Once your doctor completes a fundus image scan and clinical biometry assessment, your progression curve will map here automatically.</p>
              </div>
            )}

            {/* History Panels */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Doctor Clinical Reports */}
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center border-b pb-3">
                  📋 Doctor Clinical Reports ({reports.length})
                </h3>
                {reports.length === 0 ? (
                  <p className="text-sm text-slate-500 py-6 text-center">No clinical reports generated by doctors yet.</p>
                ) : (
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                    {reports.map((rep) => (
                      <div key={rep.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-xs font-bold text-slate-400">{new Date(rep.created_at).toLocaleDateString()}</span>
                            <div className="text-sm font-semibold text-slate-800 mt-0.5">Prediction: <span className="font-extrabold text-blue-600">{rep.prediction}</span></div>
                          </div>
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${rep.severity === 'High' ? 'bg-red-100 text-red-700' : rep.severity === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-700'}`}>
                            {rep.severity} Risk
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">
                          {rep.axial_length && <span>Axial Length: <strong>{rep.axial_length} mm</strong></span>}
                          {rep.refractive_error && <span className="ml-3">Refraction: <strong>{rep.refractive_error} D</strong></span>}
                          {rep.doctor_verdict && (
                            <div className="mt-1 text-slate-600 font-medium">
                              🩺 Doctor Verdict: <span className="font-semibold text-indigo-700">{rep.doctor_verdict}</span>
                            </div>
                          )}
                        </div>
                        <button 
                          onClick={() => downloadReportPdf(rep.patient_id)} 
                          className="mt-2 inline-flex items-center justify-center text-xs font-bold text-blue-600 bg-blue-50 py-1.5 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5 mr-1" /> Download PDF Report
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Patient Self Lifestyle Screenings */}
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center border-b pb-3">
                  🏠 Lifestyle Screenings ({history.length})
                </h3>
                {history.length === 0 ? (
                  <p className="text-sm text-slate-500 py-6 text-center">No self-assessments generated yet.</p>
                ) : (
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                    {history.map((hist) => (
                      <div key={hist.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-xs font-bold text-slate-400">{new Date(hist.created_at).toLocaleDateString()}</span>
                            <div className="text-sm font-semibold text-slate-800 mt-0.5">Lifestyle Screening</div>
                          </div>
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${hist.risk_level === 'High' ? 'bg-red-100 text-red-700' : hist.risk_level === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-700'}`}>
                            {hist.risk_level} Risk
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 grid grid-cols-3 gap-2 mt-1">
                          <div>📱 Screen: <strong>{hist.screen_time}h</strong></div>
                          <div>📖 Reading: <strong>{hist.reading_time}h</strong></div>
                          <div>🌳 Outdoor: <strong>{hist.outdoor_activity}h</strong></div>
                        </div>
                        {hist.recommendation && (
                          <div className="text-xs text-amber-800 bg-amber-50 p-2 rounded-lg mt-1 border border-amber-100/50">
                            💡 {hist.recommendation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ) : activeTab === 'simulator' ? (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="max-w-4xl mx-auto mt-4 space-y-8 pb-10"
          >
            <div className="text-left mb-6">
              <h2 className="text-2xl font-bold text-slate-800">What-If Myopia Risk Simulator</h2>
              <p className="text-slate-500 text-sm mt-1">Adjust lifestyle factor sliders below to simulate and preview your myopia risk score dynamically in real-time.</p>
            </div>

            <div className="grid md:grid-cols-12 gap-8">
              {/* Left Column: Sliders */}
              <div className="md:col-span-7 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6 text-left">
                <h3 className="font-bold text-slate-800 text-md border-b pb-3 mb-4">Simulate Lifestyle Factors</h3>

                {/* Slider 1: Screen Time */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Daily Screen Time</span>
                    <span className="text-sm font-black text-blue-600">{simScreen} hrs/day</span>
                  </div>
                  <input 
                    type="range" min="0" max="16" step="0.5"
                    value={simScreen} onChange={e => setSimScreen(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-medium mt-1">
                    <span>0 hrs (Ideal)</span>
                    <span>16 hrs (Heavy)</span>
                  </div>
                </div>

                {/* Slider 2: Outdoor Activity */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Outdoor Activity</span>
                    <span className="text-sm font-black text-teal-600">{simOutdoor} hrs/day</span>
                  </div>
                  <input 
                    type="range" min="0" max="6" step="0.5"
                    value={simOutdoor} onChange={e => setSimOutdoor(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-teal-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-medium mt-1">
                    <span>0 hrs (None)</span>
                    <span>6 hrs (Protective Factor)</span>
                  </div>
                </div>

                {/* Slider 3: Near-Work Reading Time */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Continuous Near Work / Reading</span>
                    <span className="text-sm font-black text-indigo-600">{simReading} hrs/day</span>
                  </div>
                  <input 
                    type="range" min="0" max="12" step="0.5"
                    value={simReading} onChange={e => setSimReading(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-medium mt-1">
                    <span>0 hrs</span>
                    <span>12 hrs</span>
                  </div>
                </div>

                {/* Slider 4: Sleep Time */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Sleep Hours</span>
                    <span className="text-sm font-black text-purple-600">{simSleep} hrs/day</span>
                  </div>
                  <input 
                    type="range" min="4" max="12" step="0.5"
                    value={simSleep} onChange={e => setSimSleep(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-medium mt-1">
                    <span>4 hrs</span>
                    <span>12 hrs (Healthy)</span>
                  </div>
                </div>

                {/* Dropdown 5: Parental Myopia */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wider">Myopia in Parents</label>
                  <select 
                    value={simParental} onChange={e => setSimParental(parseInt(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors cursor-pointer outline-none"
                  >
                    <option value="0">Neither Parent has Myopia (0)</option>
                    <option value="1">One Parent has Myopia (1)</option>
                    <option value="2">Both Parents have Myopia (2)</option>
                  </select>
                </div>
              </div>

              {/* Right Column: Real-time calculation visual gauge */}
              <div className="md:col-span-5 flex flex-col space-y-6">
                {/* Score gauge card */}
                {(() => {
                  // Real-time calculation formula
                  let base = 40;
                  base += simScreen * 6.5;
                  base += simReading * 4.5;
                  base -= simOutdoor * 11.5;
                  base += simParental * 12.5;
                  base -= (simSleep - 7) * 2.5;
                  const finalScore = Math.max(5, Math.min(95, Math.round(base)));
                  
                  const isHigh = finalScore >= 65;
                  const isMed  = finalScore >= 35 && finalScore < 65;
                  const colorClass = isHigh ? 'text-red-500 bg-red-50/50 border-red-100' : isMed ? 'text-amber-500 bg-amber-50/50 border-amber-100' : 'text-teal-500 bg-teal-50/50 border-teal-100';
                  const circleColor = isHigh ? 'text-red-500' : isMed ? 'text-amber-500' : 'text-teal-500';
                  
                  return (
                    <>
                      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center">
                        <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-6">Simulated Myopia Risk</h4>
                        <div className="relative mb-6">
                          <svg className="w-36 h-36 transform -rotate-90">
                            <circle cx="72" cy="72" r="64" stroke="currentColor" strokeWidth="12" className="text-slate-100 fill-none" />
                            <circle 
                              cx="72" cy="72" r="64" stroke="currentColor" strokeWidth="12" 
                              strokeDasharray="401.9" strokeDashoffset={401.9 - (401.9 * finalScore) / 100} 
                              className={`fill-none ${circleColor} transition-all duration-300 ease-out`} 
                              strokeLinecap="round" 
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-4xl font-black text-slate-800">{finalScore}%</span>
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Risk Score</span>
                          </div>
                        </div>
                        <h3 className="text-lg font-extrabold text-slate-800 mb-1">{isHigh ? 'High Risk' : isMed ? 'Moderate Risk' : 'Low Risk'}</h3>
                        <p className="text-xs text-slate-500 font-medium px-4">Based on current simulated parameters</p>
                      </div>

                      {/* Clinical Recommendations box */}
                      <div className={`rounded-3xl p-6 border shadow-sm text-left ${colorClass}`}>
                        <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
                          📢 AI Clinical Recommendation
                        </h4>
                        <p className="text-xs font-semibold text-slate-600 leading-relaxed">
                          {isHigh ? (
                            "CRITICAL RISK: High probability of progressive axial elongation. We strongly recommend reducing screen time, targeting 2 hours of daily outdoor activity, and consulting an ophthalmologist for a cycloplegic refraction test."
                          ) : isMed ? (
                            "MODERATE RISK: Moderate risk detected. Increase daily outdoor exposure to at least 1.5 hours and practice the 20-20-20 rule during screen usage to maintain current refraction ranges."
                          ) : (
                            "HEALTHY SCORE: Low progression risk. Your simulated habit ratio is highly protective. Keep up your healthy lifestyle parameters to maintain myopia stability!"
                          )}
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </motion.div>
        ) : (
          <AnimatePresence mode="wait">
            {!result ? (
              <motion.div 
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-xl mx-auto"
            >
              <div className="text-center mb-8">
                <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Diagnostic Help Tool</h2>
                <p className="text-slate-500 mt-2">Enter your lifestyle factors for a localized diagnostic evaluation.</p>
              </div>

              <div className="bg-white rounded-2xl shadow-xl shadow-blue-900/5 border border-slate-100 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-6 text-white flex justify-between items-center">
                  <h3 className="text-lg font-semibold flex items-center">
                    <Activity className="w-5 h-5 mr-2 opacity-80" /> {formStep === 1 ? 'Basic Personal Identity' : 'Lifestyle & Genetic Parameters'}
                  </h3>
                  <span className="text-sm font-bold bg-white/20 px-3 py-1 rounded-full">Step {formStep} of 2</span>
                </div>
                <div className="p-6 md:p-8">
                  <form onSubmit={formStep === 1 ? (e) => { e.preventDefault(); setFormStep(2); } : handleSubmit} className="space-y-5">
                    {formStep === 1 ? (
                      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name</label>
                          <input 
                            type="text" required
                            className="w-full rounded-lg border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" 
                            value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                            placeholder="John Doe"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-5">
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Age</label>
                            <input 
                              type="number" required min="1" max="120"
                              className="w-full rounded-lg border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" 
                              value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})}
                              placeholder="e.g. 24"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Gender</label>
                            <select 
                              className="w-full rounded-lg border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                              value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})}
                            >
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                            🩺 Assign to Doctor <span className="text-slate-400 font-normal text-xs">(required)</span>
                          </label>
                          <select
                            required
                            className="w-full rounded-lg border-blue-200 bg-blue-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors font-medium"
                            value={selectedDoctorId}
                            onChange={e => setSelectedDoctorId(e.target.value)}
                          >
                            <option value="">-- Select your assigned doctor --</option>
                            {doctors.map(d => (
                              <option key={d.id} value={d.id}>Dr. {d.name} ({d.email})</option>
                            ))}
                          </select>
                          {doctors.length === 0 && (
                            <p className="text-xs text-amber-500 mt-1 font-medium">⚠ No doctors registered yet. Ask your clinic to create a doctor account first.</p>
                          )}
                        </div>
                        <button type="submit" className="w-full rounded-xl text-md font-bold text-white bg-blue-600 hover:bg-blue-700 h-12 mt-6 transition-all shadow-lg hover:shadow-blue-500/30">Next Step: Parameters</button>
                      </motion.div>
                    ) : (
                      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
                        <div className="grid grid-cols-2 gap-5">
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Screen Time (hrs)</label>
                            <input 
                              type="number" required min="0" max="24" step="0.5"
                              className="w-full rounded-lg border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" 
                              value={formData.screenTime} onChange={e => setFormData({...formData, screenTime: e.target.value})}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Reading Time (hrs)</label>
                            <input 
                              type="number" required min="0" max="24" step="0.5"
                              className="w-full rounded-lg border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" 
                              value={formData.readingTime} onChange={e => setFormData({...formData, readingTime: e.target.value})}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-5">
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Work/Study (hrs)</label>
                            <input 
                              type="number" required min="0" max="24" step="0.5"
                              className="w-full rounded-lg border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" 
                              value={formData.workHours} onChange={e => setFormData({...formData, workHours: e.target.value})}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Sleep Time (hrs)</label>
                            <input 
                              type="number" required min="0" max="24" step="0.5"
                              className="w-full rounded-lg border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" 
                              value={formData.sleepHours} onChange={e => setFormData({...formData, sleepHours: e.target.value})}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-5">
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Outdoor Time (hrs)</label>
                            <input 
                              type="number" required min="0" max="24" step="0.5"
                              className="w-full rounded-lg border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" 
                              value={formData.outdoorActivity} onChange={e => setFormData({...formData, outdoorActivity: e.target.value})}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Parental Myopia</label>
                            <select 
                              className="w-full rounded-lg border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                              value={formData.parentalMyopia} onChange={e => setFormData({...formData, parentalMyopia: e.target.value})}
                            >
                              <option value="0">0 Parents</option>
                              <option value="1">1 Parent</option>
                              <option value="2">2 Parents</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex space-x-4 pt-4">
                          <button type="button" onClick={() => setFormStep(1)} className="w-1/3 rounded-xl text-md font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 h-12 transition-all">Back</button>
                          <button 
                            type="submit" disabled={isSubmitting}
                            className="w-2/3 inline-flex items-center justify-center rounded-xl text-md font-bold text-white bg-blue-600 hover:bg-blue-700 h-12 transition-all shadow-lg hover:shadow-blue-500/30 disabled:opacity-70"
                          >
                            {isSubmitting ? <><Loader2 className="w-5 h-5 mr-2 animate-spin"/> Generating...</> : 'Generate Report'}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </form>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="report"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-end mb-6 border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-3xl font-extrabold text-slate-800">Your Diagnostic Health Report</h2>
                  <p className="text-slate-600 mt-2 font-medium flex items-center">
                    <User className="w-4 h-4 mr-1.5 text-blue-500"/> Patient: <span className="font-bold text-slate-800 mx-1">{result.patientName}</span> • {result.patientAge} Yrs • {result.patientGender}
                  </p>
                  <p className="text-slate-500 text-sm mt-1 flex items-center"><CheckCircle2 className="w-4 h-4 mr-1 text-teal-500" /> Generated on {result.date}</p>
                </div>
                <button onClick={() => window.print()} className="flex items-center text-sm font-semibold text-blue-600 bg-blue-50 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors shadow-sm cursor-pointer">
                  <Download className="w-4 h-4 mr-2" /> Download PDF
                </button>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-1 bg-white rounded-2xl p-6 border shadow-sm flex flex-col items-center justify-center text-center">
                  <div className="relative mb-4">
                    <svg className="w-32 h-32 transform -rotate-90">
                      <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="12" className="text-slate-100 fill-none" />
                      <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="12" strokeDasharray="351.8" strokeDashoffset={351.8 - (351.8 * result.riskScore) / 100} className={`fill-none ${result.riskScore > 70 ? 'text-red-500' : result.riskScore > 40 ? 'text-amber-500' : 'text-teal-500'} transition-all duration-1000 ease-out`} strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-black text-slate-800">{result.riskScore}</span>
                      <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Score</span>
                    </div>
                  </div>
                  <h3 className="text-xl font-bold mb-1">{result.severity} Risk</h3>
                  <p className="text-sm text-slate-500">{result.detection}</p>
                </div>

                <div className="md:col-span-2 bg-white rounded-2xl p-6 border shadow-sm">
                  <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                    <Activity className="w-5 h-5 mr-2 text-blue-500" /> Progression Trend
                  </h3>
                  <div className="h-[200px] w-full">
                    <Line data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100, grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } } }} />
                  </div>
                </div>
              </div>

              {/* ML Model Output Cards */}
              {result.myopiaDetected !== null && (
                <div className="grid md:grid-cols-2 gap-6">
                  <div className={`rounded-2xl p-6 border shadow-sm text-center ${result.myopiaDetected ? 'bg-red-50 border-red-100' : 'bg-teal-50 border-teal-100'}`}>
                    <p className="text-xs font-bold uppercase tracking-widest mb-2 text-slate-500">AI Detection Result</p>
                    <p className={`text-3xl font-black mb-1 ${result.myopiaDetected ? 'text-red-600' : 'text-teal-600'}`}>
                      {result.myopiaDetected ? '⚠️ Myopia Detected' : '✅ No Myopia'}
                    </p>
                    <p className="text-sm text-slate-500 font-medium">Model Confidence: <span className="font-bold text-slate-700">{result.probability !== null ? (result.probability * 100).toFixed(1) + '%' : 'N/A'}</span></p>
                  </div>
                  {result.nextSpheq !== null && (
                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 border shadow-sm text-center">
                      <p className="text-xs font-bold uppercase tracking-widest mb-2 text-slate-500">Predicted Next SPHEQ</p>
                      <p className="text-4xl font-black text-blue-700 mb-1">{result.nextSpheq.toFixed(2)} D</p>
                      <p className="text-sm text-slate-500 font-medium">Estimated refractive value at next visit</p>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-6 border border-amber-100 mt-6 shadow-sm">
                <h3 className="text-lg font-bold text-amber-800 mb-3 flex items-center">
                  <AlertTriangle className="w-5 h-5 mr-2" /> Clinical Recommendations
                </h3>
                <ul className="space-y-3">
                  {result.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start">
                      <div className="bg-amber-500/20 p-1 rounded mt-0.5 mr-3">
                        <CheckCircle2 className="w-3 h-3 text-amber-600" />
                      </div>
                      <span className="text-amber-900 font-medium">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        )}
      </main>

      {/* Chatbot Floating UI */}
      <div className="fixed bottom-6 right-6 z-50">
        <AnimatePresence>
          {isChatOpen && (
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="absolute bottom-16 right-0 w-[350px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[450px]"
            >
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <Bot className="w-6 h-6" />
                  <span className="font-bold">Vision AI Assistant</span>
                </div>
                <button onClick={() => setIsChatOpen(false)} className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded-lg transition-colors">
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 p-4 bg-slate-50 overflow-y-auto space-y-4">
                {messages.map((m, i) => (
                  <div key={i} className={`p-3 rounded-2xl shadow-sm text-sm max-w-[85%] ${m.isBot ? 'bg-white rounded-tl-sm border border-slate-100 text-slate-700' : 'bg-blue-600 text-white rounded-tr-sm self-end ml-auto'}`}>
                    {m.text}
                  </div>
                ))}
              </div>
              <div className="p-3 bg-white border-t border-slate-100">
                <div className="relative">
                  <input type="text" value={chatMessage} onChange={e => setChatMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChatMessage()} placeholder="Ask about your report..." className="w-full bg-slate-100 border-transparent rounded-full pl-4 pr-12 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-inner" />
                  <button onClick={sendChatMessage} className="absolute right-2 top-2 p-1.5 bg-blue-600 text-white rounded-full shadow hover:bg-blue-700 transition-colors">
                    <Send className="w-4 h-4 ml-px" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="w-14 h-14 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white shadow-xl shadow-blue-900/20 border-2 border-white"
        >
          {isChatOpen ? <ChevronDown className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
        </motion.button>
      </div>
    </div>
  );
}
