import React, { useState, useRef, useEffect } from 'react';
import { Users, FileText, Activity, Search, Bell, Eye, LogOut, ChevronRight, UploadCloud, CheckCircle2, AlertTriangle, ArrowLeft, Loader2, Info, UserCog, ClipboardList, Download, UserCheck } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Line, Doughnut } from 'react-chartjs-2';
import { Link, useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, Filler
} from 'chart.js';
import { api, API_BASE_URL } from '../lib/api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, Filler);

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('patients');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [assessmentComplete, setAssessmentComplete] = useState(false);

  const [profile, setProfile] = useState({ name: 'Loading...', email: 'Loading...', role: 'doctor' });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', email: '' });

  const [screeningStats, setScreeningStats] = useState(null);
  const [timeFilter, setTimeFilter] = useState('today');
  
  useEffect(() => {
    if (activeTab === 'screening-reports') {
      const fetchStats = async () => {
        try {
          const res = await api.get('/doctor/screening-stats');
          if (res && res.data) setScreeningStats(res.data);
        } catch (err) { console.error(err); }
      };
      fetchStats();
    }
  }, [activeTab]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('/auth/profile');
        if (res && res.data) {
          setProfile(res.data);
          setEditForm({ name: res.data.name, email: res.data.email });
        }
      } catch (err) {
        console.error("Failed to fetch profile", err);
      }
    };
    fetchProfile();
  }, []);

  const handleProfileSave = async () => {
    try {
      const res = await api.put('/auth/profile', editForm);
      if (res && res.data) {
        setProfile(res.data);
        setIsEditingProfile(false);
      }
    } catch (err) { console.error("Update failed", err); }
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

  const [clinicalData, setClinicalData] = useState({
    sphericalEq: '',
    axialLength: '',
    acd: '',
    lt: '',
    vcd: '',
    iop: '',
    age: '',
    visitYear: new Date().getFullYear(),
    readingHours: '', screenTime: '', outdoorActivity: '', sleepHours: '', 
    parentalMyopia: '0',
    doctorVerdict: 'Low' // Default verdict
  });
  const [uploadedScan, setUploadedScan] = useState(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState("");
  const [predictionData, setPredictionData] = useState(null);
  const fileInputRef = useRef(null);

  // Live patient list from MongoDB via API
  const [patients, setPatients] = useState([]);
  const [patientsLoading, setPatientsLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'patients') {
      const fetchPatients = async () => {
        setPatientsLoading(true);
        try {
          const res = await api.get('/doctor/patients');
          if (res && res.data) {
            // Map MongoDB fields to our UI shape
            const mapped = res.data.map(p => ({
              id: p.id,
              name: p.name || 'Unknown Patient',
              age: p.age || 'N/A',
              gender: p.gender || 'N/A',
              probability: p.myopia_probability,
              riskLevel: p.risk_level || 'Low',
              status: p.risk_level === 'High' ? 'Needs Review' : p.risk_level === 'Medium' ? 'Monitoring' : 'Cleared',
              // Lifestyle factors — use real DB field names
              screen_time: p.screen_time,
              reading_time: p.reading_time,
              work_hours: p.work_hours,
              sleep_hours: p.sleep_hours,
              outdoor_activity: p.outdoor_activity,
              parental_myopia: p.parental_myopia,
              created_at: p.created_at,
              user_id: p.user_id,
              // Legacy fallback for old hardcoded shape
              factors: {
                screen: p.screen_time,
                outdoor: p.outdoor_activity,
                family: p.parental_myopia === 2 ? '2 Parents' : p.parental_myopia === 1 ? '1 Parent' : 'None'
              }
            }));
            setPatients(mapped);
          }
        } catch (err) {
          console.error('Failed to fetch patients', err);
        } finally {
          setPatientsLoading(false);
        }
      };
      fetchPatients();
    }
  }, [activeTab]);

  // Automatically pre-populate clinical form with selected patient's reported lifestyle factors
  useEffect(() => {
    if (selectedPatient) {
      setClinicalData(prev => ({
        ...prev,
        age: selectedPatient.age !== 'N/A' ? String(selectedPatient.age) : '',
        readingHours: selectedPatient.reading_time != null ? String(selectedPatient.reading_time) : '',
        screenTime: selectedPatient.screen_time != null ? String(selectedPatient.screen_time) : '',
        outdoorActivity: selectedPatient.outdoor_activity != null ? String(selectedPatient.outdoor_activity) : '',
        sleepHours: selectedPatient.sleep_hours != null ? String(selectedPatient.sleep_hours) : '',
        parentalMyopia: selectedPatient.parental_myopia != null ? String(selectedPatient.parental_myopia) : '0',
      }));
    } else {
      // Clear inputs if no patient selected
      setClinicalData({
        sphericalEq: '',
        axialLength: '',
        acd: '',
        lt: '',
        vcd: '',
        iop: '',
        age: '',
        visitYear: new Date().getFullYear(),
        readingHours: '', screenTime: '', outdoorActivity: '', sleepHours: '', 
        parentalMyopia: '0',
        doctorVerdict: 'Low'
      });
    }
  }, [selectedPatient]);

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadedImageUrl("");
      const reader = new FileReader();
      reader.onload = (event) => setUploadedScan(event.target.result);
      reader.readAsDataURL(file);

      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await api.post('/doctor/upload-image', formData, true);
        if (res && res.data) setUploadedImageUrl(res.data.image_url);
      } catch (err) {
        console.error(err);
        setUploadedScan(null);
        alert(err.message || 'Image upload failed');
      }
    }
  };

  const numberOr = (value, fallback) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const handleRunAssessment = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    
    try {
      const res = await api.post('/doctor/predict', {
        patient_id: selectedPatient.id,
        axial_length: numberOr(clinicalData.axialLength, undefined) ?? 24.0,
        refractive_error: numberOr(clinicalData.sphericalEq, undefined) ?? -1.0,
        acd: numberOr(clinicalData.acd, undefined) ?? undefined,
        lt: numberOr(clinicalData.lt, undefined) ?? undefined,
        vcd: numberOr(clinicalData.vcd, undefined) ?? undefined,
        age: numberOr(clinicalData.age, undefined) ?? selectedPatient.age ?? undefined,
        visit_year: numberOr(clinicalData.visitYear, undefined) ?? new Date().getFullYear(),
        reading_hours: numberOr(clinicalData.readingHours, undefined) ?? selectedPatient.reading_time ?? undefined,
        screen_time: numberOr(clinicalData.screenTime, undefined) ?? selectedPatient.screen_time ?? undefined,
        outdoor_activity: numberOr(clinicalData.outdoorActivity, undefined) ?? selectedPatient.outdoor_activity ?? undefined,
        sleep_hours: numberOr(clinicalData.sleepHours, undefined) ?? selectedPatient.sleep_hours ?? undefined,
        parental_myopia: numberOr(clinicalData.parentalMyopia, undefined) ?? selectedPatient.parental_myopia ?? 0,
        doctor_verdict: clinicalData.doctorVerdict,
        image_url: uploadedImageUrl || ""
      });
      
      // API returns { status, data: { severity, confidence, ... }, message }
      const result = res?.data?.data || res?.data || {};
      setPredictionData(result);
      setAssessmentComplete(true);
    } catch(err) {
      console.error('Assessment error:', err);
      alert('Assessment failed. Please check your inputs and try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const measuredPatients = patients.filter(p => Number.isFinite(p.probability));
  const trendData = {
    labels: measuredPatients.map((_, i) => `Screening ${i + 1}`),
    datasets: [{ label: 'Model myopia probability (%)', data: measuredPatients.map(p => p.probability * 100), borderColor: '#3B82F6' }]
  };
  const distributionData = {
    labels: ['Low', 'Medium', 'High'],
    datasets: [{ data: ['Low', 'Medium', 'High'].map(level => patients.filter(p => p.riskLevel === level).length), backgroundColor: ['#10B981', '#F59E0B', '#EF4444'] }]
  };

  const renderContent = () => {
    if (activeTab === 'profile') {
      return (
        <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-800 mb-6">Doctor Profile</h2>
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
            <div className="flex items-center space-x-6 mb-8 pb-8 border-b border-slate-100">
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-100 to-indigo-100 flex items-center justify-center text-blue-700 font-bold text-3xl border border-blue-200 uppercase">
                {profile.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-800">{profile.name.startsWith('Dr.') ? profile.name : `Dr. ${profile.name}`}</h3>
                <p className="text-blue-600 font-semibold mb-1 capitalize">{profile.role} Account</p>
                <p className="text-slate-500 text-sm">Vision Care Central Hospital</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <span className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">System ID</span>
                <span className="text-slate-800 font-semibold">{profile.id || 'N/A'}</span>
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Specialization</span>
                <span className="text-slate-800 font-semibold">Retinal Diagnostics & Myopia Mgmt</span>
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
            <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end space-x-3">
              {isEditingProfile ? (
                <>
                  <button onClick={() => setIsEditingProfile(false)} className="bg-slate-100 text-slate-600 px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors">Cancel</button>
                  <button onClick={handleProfileSave} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/20">Save Details</button>
                </>
              ) : (
                <button onClick={() => setIsEditingProfile(true)} className="bg-slate-100 text-slate-600 px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors">Edit Details</button>
              )}
            </div>
            </div>
        </Motion.div>
      );
    }

    if (activeTab === 'screening-reports') {
      const currentStats = screeningStats?.[timeFilter] || { total: 0, High: 0, Medium: 0, Low: 0 };
      const filterLabels = { today: "Today's Report", week: "Weekly Report", month: "Monthly Report", all_time: "All-Time Report" };

      const doughnutData = {
        labels: ['High Risk', 'Medium Risk', 'Low Risk'],
        datasets: [{ data: [currentStats.High, currentStats.Medium, currentStats.Low], backgroundColor: ['#EF4444', '#F59E0B', '#10B981'], borderWidth: 0, hoverOffset: 6 }]
      };

      return (
        <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-800">{filterLabels[timeFilter]}</h2>
              <p className="text-slate-500 text-sm mt-0.5">Patient screening summary — {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
                {[['today','Today'],['week','Weekly'],['month','Monthly'],['all_time','All Time']].map(([key, label]) => (
                  <button key={key} onClick={() => setTimeFilter(key)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${timeFilter === key ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{label}</button>
                ))}
              </div>
              <button onClick={() => window.print()} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/20">
                <Download className="w-4 h-4" /> Download PDF
              </button>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: 'Total Screened', value: currentStats.total, bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100' },
              { label: 'High Risk', value: currentStats.High, bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-100' },
              { label: 'Medium Risk', value: currentStats.Medium, bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100' },
              { label: 'Low Risk', value: currentStats.Low, bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-100' },
            ].map((card, i) => (
              <Motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                className={`${card.bg} ${card.border} border rounded-2xl p-5`}>
                <p className={`text-xs font-bold uppercase tracking-widest ${card.text} mb-2`}>{card.label}</p>
                <p className={`text-4xl font-black ${card.text}`}>{screeningStats ? card.value : '—'}</p>
              </Motion.div>
            ))}
            <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
              className="bg-indigo-50 border-indigo-100 border rounded-2xl p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-700 mb-2">AI Accuracy</p>
              <p className="text-4xl font-black text-indigo-700">{screeningStats ? (screeningStats.validation_accuracy || 0) + '%' : '—'}</p>
              <p className="text-[10px] text-indigo-500 font-bold mt-1">Validated vs Doctor</p>
            </Motion.div>
          </div>

          {/* Charts Row */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h3 className="text-base font-bold text-slate-800 mb-4">Risk Distribution</h3>
              {screeningStats && currentStats.total > 0 ? (
                <div className="h-[220px] flex items-center justify-center">
                  <Doughnut data={doughnutData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, cutout: '65%' }} />
                </div>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-slate-400 text-sm font-medium">No data for this period</div>
              )}
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h3 className="text-base font-bold text-slate-800 mb-1">Weekly Trend</h3>
              <p className="text-xs text-slate-400 mb-4">Total screenings this week vs previous days</p>
              <div className="h-[220px]">
                <Line data={{ labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], datasets: [{ label: 'Screenings', data: [screeningStats?.week?.total||0, 0, 0, 0, 0, 0, 0], borderColor: '#3B82F6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.4, pointBackgroundColor: '#3B82F6' }] }}
                  options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 0, ticks: { stepSize: 1 }, grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } } }} />
              </div>
            </div>
          </div>

          {/* Summary Table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-slate-800">Summary — All Timeframes</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 uppercase border-b border-slate-100">
                  <th className="px-6 py-3 text-left font-bold">Period</th>
                  <th className="px-6 py-3 text-center font-bold">Total</th>
                  <th className="px-6 py-3 text-center font-bold text-red-500">High</th>
                  <th className="px-6 py-3 text-center font-bold text-amber-500">Medium</th>
                  <th className="px-6 py-3 text-center font-bold text-teal-500">Low</th>
                </tr>
              </thead>
              <tbody>
                {[['Today', 'today'], ['This Week', 'week'], ['This Month', 'month'], ['All Time', 'all_time']].map(([label, key]) => {
                  const s = screeningStats?.[key] || { total: 0, High: 0, Medium: 0, Low: 0 };
                  return (
                    <tr key={key} className={`border-b border-slate-50 ${timeFilter === key ? 'bg-blue-50/40' : 'hover:bg-slate-50/50'} transition-colors`}>
                      <td className="px-6 py-4 font-bold text-slate-700">{label}</td>
                      <td className="px-6 py-4 text-center font-black text-slate-800">{screeningStats ? s.total : '—'}</td>
                      <td className="px-6 py-4 text-center font-bold text-red-500">{screeningStats ? s.High : '—'}</td>
                      <td className="px-6 py-4 text-center font-bold text-amber-500">{screeningStats ? s.Medium : '—'}</td>
                      <td className="px-6 py-4 text-center font-bold text-teal-500">{screeningStats ? s.Low : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Motion.div>
      );
    }

    if (activeTab === 'reports') {
      return (
        <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-800">Generated Clinical Reports</h2>
          <div className="bg-white p-12 rounded-2xl border border-slate-100 shadow-sm text-center">
            <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-700 mb-2">No Reports Generated Yet</h3>
            <p className="text-slate-500">Run diagnostic evaluations on patients to automatically generate downloadable PDF reports.</p>
          </div>
        </Motion.div>
      );
    }

    if (activeTab === 'analytics') {
      return (
        <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-800">Clinic Analytics Overview</h2>
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm"><h3 className="text-lg font-semibold mb-4">Recorded model probabilities</h3><div className="h-[250px]"><Line data={trendData} options={{ maintainAspectRatio: false }} /></div></div>
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm"><h3 className="text-lg font-semibold mb-4">Risk Distribution</h3><div className="h-[250px]"><Doughnut data={distributionData} options={{ maintainAspectRatio: false }} /></div></div>
          </div>
        </Motion.div>
      );
    }

    if (activeTab === 'patients' && selectedPatient) {
      return (
        <Motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <button onClick={() => { setSelectedPatient(null); setAssessmentComplete(false); setUploadedScan(null); }} className="flex items-center text-sm font-medium text-slate-500 hover:text-blue-600 mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Directory
          </button>

          <div className="grid lg:grid-cols-3 gap-6">

            {/* Left Column: Patient Profile & Reported Factors */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden text-center p-6">
                <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4 tracking-widest">{selectedPatient.name.charAt(0)}</div>
                <h2 className="text-xl font-bold text-slate-800">{selectedPatient.name}</h2>
                <p className="text-slate-500 text-sm mt-1">{selectedPatient.id} • {selectedPatient.age} yrs</p>
                <div className="mt-4 flex flex-col items-center gap-3">
                  <span className={`px-4 py-1.5 rounded-full text-sm font-bold ${selectedPatient.riskLevel === 'High' ? 'bg-red-50 text-red-600' : selectedPatient.riskLevel === 'Low' ? 'bg-teal-50 text-teal-600' : 'bg-amber-50 text-amber-600'}`}>
                    Prior Risk: {selectedPatient.riskLevel}
                  </span>
                  
                  <button 
                    onClick={async () => {
                      try {
                        const token = localStorage.getItem('token');
                        const response = await fetch(
                          `${API_BASE_URL}/doctor/generate-report/${selectedPatient.id}`,
                          {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${token}` }
                          }
                        );
                        if (!response.ok) {
                          alert('No clinical report has been generated for this patient yet. Please fill out the Deep Learning Clinical Diagnostic Form first.');
                          return;
                        }
                        const blob = await response.blob();
                        const url  = URL.createObjectURL(blob);
                        const a    = document.createElement('a');
                        a.href     = url;
                        a.download = `myopia_report_${selectedPatient.name.replace(/\s+/g, '_')}.pdf`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(url);
                      } catch (err) {
                        console.error('PDF download failed', err);
                        alert('Network error. Failed to download report PDF.');
                      }
                    }}
                    className="w-full mt-2 inline-flex items-center justify-center bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-bold py-2.5 px-4 rounded-xl transition-all border border-blue-100 shadow-sm active:scale-95"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" /> Download Report (PDF)
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <h3 className="font-bold text-slate-800 flex items-center mb-4"><FileText className="w-4 h-4 mr-2 text-blue-500" /> Patient Reported Lifestyle</h3>
                <ul className="space-y-2.5 text-sm">
                  {selectedPatient.age !== 'N/A' && <li className="flex justify-between items-center"><span className="text-slate-500">Age:</span> <span className="font-semibold text-slate-800">{selectedPatient.age} yrs</span></li>}
                  {selectedPatient.gender !== 'N/A' && <li className="flex justify-between items-center"><span className="text-slate-500">Gender:</span> <span className="font-semibold text-slate-800">{selectedPatient.gender}</span></li>}
                  {selectedPatient.screen_time != null && <li className="flex justify-between items-center"><span className="text-slate-500">Screen Time:</span> <span className="font-semibold text-slate-800">{selectedPatient.screen_time} hrs/day</span></li>}
                  {selectedPatient.reading_time != null && <li className="flex justify-between items-center"><span className="text-slate-500">Reading Time:</span> <span className="font-semibold text-slate-800">{selectedPatient.reading_time} hrs/day</span></li>}
                  {selectedPatient.work_hours != null && <li className="flex justify-between items-center"><span className="text-slate-500">Work/Study:</span> <span className="font-semibold text-slate-800">{selectedPatient.work_hours} hrs/day</span></li>}
                  {selectedPatient.sleep_hours != null && <li className="flex justify-between items-center"><span className="text-slate-500">Sleep:</span> <span className="font-semibold text-slate-800">{selectedPatient.sleep_hours} hrs/day</span></li>}
                  {selectedPatient.outdoor_activity != null && <li className="flex justify-between items-center"><span className="text-slate-500">Outdoor Time:</span> <span className="font-semibold text-slate-800">{selectedPatient.outdoor_activity} hrs/day</span></li>}
                  {selectedPatient.parental_myopia != null && <li className="flex justify-between items-center"><span className="text-slate-500">Parental Myopia:</span> <span className="font-semibold text-slate-800">{selectedPatient.parental_myopia === 0 ? 'None' : selectedPatient.parental_myopia === 1 ? '1 Parent' : '2 Parents'}</span></li>}
                  {selectedPatient.created_at && <li className="flex justify-between items-center pt-2 border-t border-slate-100"><span className="text-slate-400 text-xs">Submitted:</span> <span className="font-semibold text-slate-500 text-xs">{new Date(selectedPatient.created_at).toLocaleDateString()}</span></li>}
                </ul>
              </div>
            </div>

            {/* Right Column: Clinical Inputs & Assessment */}
            <div className="lg:col-span-2 space-y-6">

              {!assessmentComplete ? (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 relative overflow-hidden flex flex-col h-full">
                  <div className="absolute top-0 right-0 p-4 opacity-5"><Activity className="w-48 h-48 text-blue-600" /></div>
                  <div className="flex justify-between items-center mb-6 relative z-10">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center"><Eye className="w-5 h-5 mr-2 text-blue-600" /> Diagnostic Form</h3>

                  </div>

                  <form onSubmit={handleRunAssessment} className="relative z-10 flex-1 flex flex-col">
                    
                    <h4 className="text-sm font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2">Clinical Optical Biometry</h4>
                    <div className="grid md:grid-cols-3 gap-3 mb-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center">SPHEQ <Info className="w-3 h-3 ml-1 text-slate-400" /></label>
                        <input type="number" step="0.25" placeholder="-2.50 D" required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={clinicalData.sphericalEq} onChange={e => setClinicalData({ ...clinicalData, sphericalEq: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center">Axial Length <Info className="w-3 h-3 ml-1 text-slate-400" /></label>
                        <input type="number" step="0.01" placeholder="24.5 mm" required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={clinicalData.axialLength} onChange={e => setClinicalData({ ...clinicalData, axialLength: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 font-sans">Ant. Chamber (ACD)</label>
                        <input type="number" step="0.01" placeholder="3.5 mm" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={clinicalData.acd} onChange={e => setClinicalData({ ...clinicalData, acd: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 font-sans">Lens Thickness (LT)</label>
                        <input type="number" step="0.01" placeholder="4.0 mm" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={clinicalData.lt} onChange={e => setClinicalData({ ...clinicalData, lt: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 font-sans">Vitreous Chamber</label>
                        <input type="number" step="0.01" placeholder="16.5 mm" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={clinicalData.vcd} onChange={e => setClinicalData({ ...clinicalData, vcd: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">IOP (mmHg)</label>
                        <input type="number" step="0.1" placeholder="15 mmHg" required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={clinicalData.iop} onChange={e => setClinicalData({ ...clinicalData, iop: e.target.value })} />
                      </div>
                    </div>

                    <h4 className="text-sm font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2">Lifestyle Analytics Matrix</h4>
                    <div className="grid md:grid-cols-4 gap-3 mb-5">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 font-sans">Patient Age</label>
                        <input type="number" placeholder="24" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={clinicalData.age} onChange={e => setClinicalData({ ...clinicalData, age: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 font-sans">Reading (h/d)</label>
                        <input type="number" step="0.5" placeholder="4.5" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={clinicalData.readingHours} onChange={e => setClinicalData({ ...clinicalData, readingHours: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 font-sans">Screen (h/d)</label>
                        <input type="number" step="0.5" placeholder="6.0" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={clinicalData.screenTime} onChange={e => setClinicalData({ ...clinicalData, screenTime: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 font-sans">Outdoor (h/d)</label>
                        <input type="number" step="0.5" placeholder="1.5" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={clinicalData.outdoorActivity} onChange={e => setClinicalData({ ...clinicalData, outdoorActivity: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 font-sans">Sleep (h/d)</label>
                        <input type="number" step="0.5" placeholder="7.0" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={clinicalData.sleepHours} onChange={e => setClinicalData({ ...clinicalData, sleepHours: e.target.value })} />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Parental History</label>
                        <select className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none block" value={clinicalData.parentalMyopia} onChange={e => setClinicalData({ ...clinicalData, parentalMyopia: e.target.value })}>
                          <option value="0">0 Myopic Parents</option>
                          <option value="1">1 Myopic Parent</option>
                          <option value="2">2 Myopic Parents</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 font-sans">Visit Year</label>
                        <input type="number" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={clinicalData.visitYear} onChange={e => setClinicalData({ ...clinicalData, visitYear: e.target.value })} />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 mb-6 pt-4 border-t border-slate-100 items-start">
                      <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                        <label className="block text-xs font-bold text-blue-700 uppercase tracking-widest mb-2 flex items-center">
                          <UserCheck className="w-4 h-4 mr-2" /> Doctor's Final Diagnosis
                        </label>
                        <select 
                          className="w-full bg-white border border-blue-200 rounded-lg px-3 py-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                          value={clinicalData.doctorVerdict} 
                          onChange={e => setClinicalData({ ...clinicalData, doctorVerdict: e.target.value })}
                        >
                          <option value="Low">Low Risk (Normal)</option>
                          <option value="Medium">Medium Risk</option>
                          <option value="High">High Risk (Urgent)</option>
                        </select>
                        <p className="text-[10px] text-blue-600 mt-2 font-medium italic">* This will be used to validate the AI model accuracy</p>
                      </div>

                      <div className="flex-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Fundus Scan Upload</label>
                        <div className={`border-2 border-dashed rounded-xl p-6 min-h-[120px] flex flex-col justify-center text-center transition-colors cursor-pointer ${uploadedScan ? 'border-blue-500 bg-blue-50/50' : 'border-slate-300 hover:border-blue-400 bg-slate-50'}`} onClick={() => fileInputRef.current.click()}>
                          {uploadedScan ? (
                            <div className="flex flex-col items-center">
                              <span className="text-sm font-semibold text-blue-700 flex items-center mb-1"><CheckCircle2 className="w-4 h-4 mr-2" /> Image Imported</span>
                              <span className="text-[10px] text-blue-500 font-bold uppercase tracking-widest hover:underline">Replace</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center pointer-events-none">
                              <UploadCloud className="w-8 h-8 text-slate-400 mb-2" />
                              <p className="text-[10px] font-semibold text-slate-600">Upload Fundus Image</p>
                            </div>
                          )}
                          <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end mt-auto pt-4 border-t border-slate-100">
                      {!uploadedScan && (
                        <p className="text-xs text-amber-500 mr-4 self-center font-medium">⚠️ Fundus image optional — evaluation will use biometry only</p>
                      )}
                      <button type="submit" disabled={isProcessing} className="bg-blue-600 text-white px-8 py-3.5 rounded-xl font-bold text-md hover:bg-blue-700 shadow-lg shadow-blue-500/20 disabled:opacity-50 transition-all flex items-center">
                        {isProcessing ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processing Diagnostic Analysis...</> : 'Synthesize Factors & Evaluate'}
                      </button>
                    </div>
                  </form>

                </div>
              ) : (
                <Motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
                  <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg shadow-blue-900/10">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="text-xl font-bold flex items-center"><CheckCircle2 className="w-6 h-6 mr-2 text-green-400" /> Model Evaluation Complete</h3>
                        <p className="text-blue-100 text-sm mt-1">Clinical XGBoost prediction and optional fundus image classification.</p>
                      </div>
                      <div className="flex space-x-3">
                        <div className="bg-white/10 px-4 py-2 rounded-xl backdrop-blur-md border border-white/10 text-center flex flex-col justify-center">
                          <span className="text-[10px] uppercase tracking-widest block opacity-90 mb-0.5 font-bold">Myopia probability</span>
                          <span className="text-lg font-black text-green-300">{predictionData?.confidence != null ? (predictionData.confidence * 100).toFixed(1) + '%' : 'Unavailable'}</span>
                        </div>
                        <div className="bg-white/20 px-4 py-2 rounded-xl backdrop-blur-md border border-white/20 text-center">
                          <span className="text-[10px] uppercase tracking-widest block opacity-90 mb-0.5 font-bold">Severity Risk</span>
                          <span className="text-xl font-black">{predictionData?.severity ?? 'Unavailable'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                      <div className="bg-white/10 rounded-xl p-3 border border-white/10 flex items-center col-span-2">
                        <div className="flex-1">
                          <p className="text-[10px] opacity-80 uppercase tracking-widest mb-0.5 font-bold">Clinical model result</p>
                          <p className="font-bold text-red-300 text-xs flex items-center"><Activity className="w-3 h-3 mr-1.5" /> {predictionData?.prediction ?? 'Unavailable'}</p>
                        </div>
                      </div>
                      <div className="bg-white/10 rounded-xl p-3 border border-white/10 flex items-center col-span-2">
                        <div className="flex-1">
                          <p className="text-[10px] opacity-80 uppercase tracking-widest mb-0.5 font-bold">Progression Risk</p>
                          <p className="font-bold flex items-center text-amber-300 text-xs"><AlertTriangle className="w-3 h-3 mr-1.5" /> {predictionData?.progression_rate ?? 'Unavailable'}</p>
                        </div>
                      </div>
                      <div className="bg-blue-900/40 rounded-xl p-3 border border-blue-400/20 flex flex-col items-center justify-center text-center col-span-2">
                        <p className="text-[10px] text-blue-200 uppercase tracking-widest mb-0.5 font-bold">Predicted Next SPHEQ</p>
                        <p className="text-xl font-black text-white">{predictionData?.predicted_next_spheq != null ? predictionData.predicted_next_spheq.toFixed(2) + ' D' : 'Unavailable'}</p>
                      </div>
                      <div className="bg-indigo-900/40 rounded-xl p-3 border border-indigo-400/20 flex flex-col items-center justify-center text-center col-span-2">
                        <p className="text-[10px] text-indigo-200 uppercase tracking-widest mb-0.5 font-bold">Model progression category</p>
                        <p className="text-xl font-black text-white">{predictionData?.progression_rate ?? 'Unavailable'}</p>
                      </div>
                    </div>
                  </div>

                  {/* ── PALM EfficientNet-B0 Fundus DL Result ── */}
                  {predictionData?.fundus_pm_prediction && predictionData.fundus_pm_prediction !== 'No Image' && (
                    <div className={`rounded-2xl border p-5 ${
                      predictionData.fundus_pm_prediction === 'PM'
                        ? 'bg-red-50 border-red-200'
                        : predictionData.fundus_pm_prediction === 'Service Unavailable'
                        ? 'bg-slate-50 border-slate-200'
                        : 'bg-emerald-50 border-emerald-200'
                    }`}>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1">
                            Fundus DL Analysis · EfficientNet-B0 (PALM Dataset)
                          </span>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${
                              predictionData.fundus_pm_prediction === 'PM'
                                ? 'bg-red-100 text-red-700'
                                : predictionData.fundus_pm_prediction === 'Service Unavailable'
                                ? 'bg-slate-100 text-slate-500'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {predictionData.fundus_pm_prediction === 'PM'
                                ? '⚠ Pathologic Myopia Detected'
                                : predictionData.fundus_pm_prediction === 'Service Unavailable'
                                ? '⚡ DL Service Offline'
                                : '✓ Non-Pathologic'}
                            </span>
                            {predictionData.fundus_pm_prediction !== 'Service Unavailable' && (
                              <span className="text-slate-600 text-sm font-semibold">
                                Confidence: <strong className={predictionData.fundus_pm_prediction === 'PM' ? 'text-red-600' : 'text-emerald-600'}>
                                  {(predictionData.fundus_pm_confidence * 100).toFixed(1)}%
                                </strong>
                              </span>
                            )}
                          </div>
                        </div>
                        {predictionData.fundus_pm_prediction === 'Service Unavailable' && (
                          <span className="text-xs text-slate-400 font-medium text-right max-w-[160px]">
                            Start the inference service on port 8001
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium">
                        ⚠ Trained on PALM dataset (1,200 fundus images) · Binary pathologic myopia classification only · Clinical validation pending · Not a substitute for clinical diagnosis
                      </p>
                    </div>
                  )}

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-2xl p-6 border">
                      <h3 className="font-bold mb-3">Model progression estimate</h3>
                      <p className="text-xs text-slate-500 mb-3">Measured refraction and experimental next-visit estimate. This is not a measured historical trend.</p>
                      {predictionData?.current_spheq != null && predictionData?.predicted_next_spheq != null ? (
                        <div className="h-52"><Line data={{
                          labels: ['Current measurement', 'Predicted next visit'],
                          datasets: [{ label: 'SPHEQ (D)', data: [predictionData.current_spheq, predictionData.predicted_next_spheq], borderColor: '#6366f1', borderDash: [6, 4], tension: 0 }]
                        }} options={{ maintainAspectRatio: false }} /></div>
                      ) : <p>No progression estimate available.</p>}
                    </div>
                    <div className="bg-white rounded-2xl p-6 border">
                      <h3 className="font-bold mb-3">Grad-CAM heatmap</h3>
                      {predictionData?.gradcam ? <>
                        <p className="text-xs text-slate-500 mb-3">Evidence for {predictionData.gradcam.target_label} on the cropped model input. This is not a lesion boundary.</p>
                        <div className="grid grid-cols-2 gap-2">
                          <figure><img src={predictionData.gradcam.model_input} alt="Preprocessed model input" /><figcaption className="text-xs">Model input</figcaption></figure>
                          <figure><img src={predictionData.gradcam.overlay} alt={`Grad-CAM for ${predictionData.gradcam.target_label}`} /><figcaption className="text-xs">Gradient attribution</figcaption></figure>
                        </div>
                        {!predictionData.gradcam.has_positive_attribution && <p className="text-xs mt-2">No positive attribution at this layer.</p>}
                      </> : <p className="text-sm text-slate-500">Upload a fundus image to generate a model explanation.</p>}
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3">
                    <button onClick={() => { setAssessmentComplete(false); setUploadedScan(null); }} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">New Assessment</button>
                    <button onClick={async () => {
                      try {
                        const token = localStorage.getItem('token');
                        const response = await fetch(
                          `${API_BASE_URL}/doctor/generate-report/${selectedPatient.id}`,
                          {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${token}` }
                          }
                        );
                        if (!response.ok) {
                          const err = await response.json().catch(() => ({}));
                          alert(err.detail || 'PDF generation failed — run evaluation first');
                          return;
                        }
                        const blob = await response.blob();
                        const url  = URL.createObjectURL(blob);
                        const a    = document.createElement('a');
                        a.href     = url;
                        a.download = `myopia_report_${selectedPatient.id}.pdf`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      } catch (err) {
                        console.error('PDF download error:', err);
                        alert('PDF download failed. Make sure an evaluation was run first.');
                      }
                    }} className="px-5 py-2.5 rounded-xl font-bold text-blue-600 bg-blue-50 border border-blue-100 shadow-sm hover:bg-blue-100 transition-colors flex items-center">
                      <FileText className="w-5 h-5 mr-2" /> Download PDF Report
                    </button>
                    <button onClick={() => {
                      setAssessmentComplete(false);
                      setUploadedScan(null);
                      setUploadedImageUrl('');
                      setActiveTab('patients');
                    }} className="px-5 py-2.5 rounded-xl font-bold text-white bg-green-600 hover:bg-green-700 shadow-md shadow-green-500/20 transition-colors">Done - Assessment Saved</button>
                  </div>
                </Motion.div>
              )}

            </div>
          </div>
        </Motion.div>
      );
    }

    return (
      <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {patientsLoading && <p role="status" className="p-3 text-sm text-slate-500">Loading records...</p>}
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="relative w-80">
            <Search className="w-5 h-5 absolute left-3.5 top-2.5 text-slate-400" />
            <input type="text" placeholder="Search ID or Patient Name" className="w-full bg-white border border-slate-200 rounded-xl pl-11 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm font-medium" />
          </div>
        </div>
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-5 font-bold tracking-wider">Patient Details</th>
              <th className="px-6 py-5 font-bold tracking-wider">Historical Risk</th>
              <th className="px-6 py-5 font-bold tracking-wider">Registered On</th>
              <th className="px-6 py-5 font-bold tracking-wider">Action Needed</th>
              <th className="px-6 py-5 font-bold tracking-wider text-right">Perform Eval</th>
            </tr>
          </thead>
          <tbody>
            {patients.map(p => (
              <tr
                key={p.id}
                onClick={() => setSelectedPatient(p)}
                className="border-b border-slate-50 hover:bg-blue-50/50 transition-colors cursor-pointer group"
              >
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-800 text-base">{p.name}</div>
                  <div className="text-slate-400 text-xs font-semibold">{p.id}</div>
                </td>
                <td className="px-6 py-4 font-bold text-slate-700">{Number.isFinite(p.probability) ? (p.probability * 100).toFixed(1) + '%' : 'Unavailable'}</td>
                <td className="px-6 py-4 text-slate-500 font-semibold text-xs">
                  {p.created_at ? new Date(p.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Unavailable'}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${p.status === 'Needs Review' ? 'bg-red-50 text-red-600' : p.status === 'Monitoring' ? 'bg-amber-50 text-amber-600' : 'bg-teal-50 text-teal-600'}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="text-blue-600 hover:text-white bg-blue-50 group-hover:bg-blue-600 group-hover:text-white px-4 py-2 rounded-xl font-bold transition-all duration-300 inline-flex items-center">
                    Evaluate <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm z-20 sticky top-0 md:h-screen transition-all">
        <div className="p-6 border-b border-slate-100 flex items-center space-x-2">
          <Eye className="w-8 h-8 text-blue-600" />
          <span className="font-black text-xl tracking-tight text-slate-800">Vision AI</span>
        </div>
        <div className="flex-1 py-6 px-4 space-y-2">
          <button onClick={() => { setActiveTab('patients'); setSelectedPatient(null); }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'patients' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600'}`}>
            <Users className="w-5 h-5" /> <span>Patient Registry</span>
          </button>
          <button onClick={() => { setActiveTab('screening-reports'); setSelectedPatient(null); }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'screening-reports' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600'}`}>
            <ClipboardList className="w-5 h-5" /> <span>Screening Reports</span>
          </button>
          <button onClick={() => { setActiveTab('reports'); setSelectedPatient(null); }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'reports' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600'}`}>
            <FileText className="w-5 h-5" /> <span>Generated PDFs</span>
          </button>
          <button onClick={() => { setActiveTab('analytics'); setSelectedPatient(null); }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'analytics' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600'}`}>
            <Activity className="w-5 h-5" /> <span>Analytics</span>
          </button>
          <button onClick={() => { setActiveTab('profile'); setSelectedPatient(null); }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'profile' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600'}`}>
            <UserCog className="w-5 h-5" /> <span>Profile Settings</span>
          </button>
        </div>
        <div className="p-4 border-t border-slate-100">
          <button onClick={handleSignOut} className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors">
            <LogOut className="w-5 h-5" /> <span>Sign Out</span>
          </button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col min-h-screen">
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 h-16 flex items-center justify-between px-8 sticky top-0 z-10 shadow-sm">
          <h1 className="font-extrabold text-slate-800 capitalize tracking-tight text-lg">{activeTab === 'patients' ? 'Patient Management' : activeTab === 'screening-reports' ? 'Screening Reports' : activeTab === 'analytics' ? 'Clinic Analytics' : activeTab === 'reports' ? 'Reports' : 'Profile Settings'}</h1>
          <div className="flex items-center space-x-5">
            <button className="text-slate-400 hover:text-blue-600 transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <button onClick={() => { setActiveTab('profile'); setSelectedPatient(null); }} className={`w-10 h-10 rounded-full bg-gradient-to-tr from-blue-50 to-indigo-50 flex items-center justify-center text-blue-700 font-bold border cursor-pointer transition-all ${activeTab === 'profile' ? 'border-blue-500 ring-2 ring-blue-200' : 'border-blue-100 shadow-sm hover:shadow-md'}`}>
              Dr.
            </button>
          </div>
        </header>
        <div className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            <AnimatePresence mode="wait">
              {renderContent()}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
