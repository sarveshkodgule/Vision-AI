import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Loader2, ArrowLeft, MessageSquare, Send, User, ChevronDown, Download, Bot } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Line } from 'react-chartjs-2';
import { Link, useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { api, API_BASE_URL } from '../lib/api';
import PatientReportDelivery from '../components/PatientReportDelivery';
import HospitalBrand from '../components/HospitalBrand';
import PatientLanguageSwitch from '../components/PatientLanguageSwitch';
import ScreeningSummary from '../components/ScreeningSummary';
import { usePatientLanguage } from '../lib/patientLanguage';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function PatientDashboard() {
  const navigate = useNavigate();
  const { language, t } = usePatientLanguage();
  const [submitError, setSubmitError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [profileError, setProfileError] = useState('');
  const [doctorsError, setDoctorsError] = useState('');
  const [doctorsLoading, setDoctorsLoading] = useState(true);
  const [profileBusy, setProfileBusy] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [downloadingId, setDownloadingId] = useState('');
  const [simRetry, setSimRetry] = useState(0);
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
  const [simResult, setSimResult] = useState(null);
  const [simError, setSimError] = useState('');
  const simulationAge = Number(formData.age || history[0]?.age);
  const simulationGender = formData.gender || history[0]?.gender;
  useEffect(() => {
    if (activeTab !== 'simulator') return;
    let current = true;
    const timer = setTimeout(async () => {
      setSimResult(null);
      setSimError('');
      if (!Number.isFinite(simulationAge) || simulationAge <= 0) {
        setSimError('Enter your age in the assessment form before using the model simulator.');
        return;
      }
      try {
        const response = await api.post('/patient/preview', {
          name: 'What-if preview', age: simulationAge, gender: simulationGender,
          screen_time: simScreen, reading_time: simReading, outdoor_activity: simOutdoor,
          sleep_hours: simSleep, parental_myopia: simParental, work_hours: 0,
        });
        if (current) setSimResult(response.data);
      } catch (error) {
        if (current) setSimError(error.message || 'Model unavailable');
      }
    }, 400);
    return () => { current = false; clearTimeout(timer); };
  }, [activeTab, simulationAge, simulationGender, simScreen, simReading, simOutdoor, simSleep, simParental, simRetry]);

  const [historyLoading, setHistoryLoading] = useState(true);
  
  const fetchPatientData = async () => {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const [histRes, repRes] = await Promise.all([api.get('/patient/history'), api.get('/patient/reports')]);
      if (!Array.isArray(histRes.data) || !Array.isArray(repRes.data)) throw new Error('Invalid records response');
      setHistory(histRes.data);
      setReports(repRes.data);
    } catch {
      setHistoryError('Your records could not be loaded. Please check your connection and retry.');
    } finally { setHistoryLoading(false); }
  };

  const fetchProfile = async () => {
    setProfileError('');
    try {
      const res = await api.get('/auth/profile');
      if (!res.data?.email) throw new Error('Profile unavailable');
      setProfile(res.data);
      setEditForm({ name: res.data.name, email: res.data.email });
    } catch { setProfileError('Your account details could not be loaded. Retry, or sign in again if your session expired.'); }
  };

  const fetchDoctors = async () => {
    setDoctorsLoading(true);
    setDoctorsError('');
    try {
      const res = await api.get('/auth/doctors');
      if (!Array.isArray(res.data)) throw new Error('Doctors unavailable');
      setDoctors(res.data);
    } catch { setDoctorsError('The doctor list could not be loaded. Please retry.'); }
    finally { setDoctorsLoading(false); }
  };

  useEffect(() => {
    fetchProfile();
    fetchPatientData();
    fetchDoctors();
  }, []);

  const handleProfileSave = async () => {
    setProfileBusy(true);
    setProfileError('');
    try {
      const res = await api.put('/auth/profile', { name: editForm.name });
      if (res?.data) { setProfile(res.data); setIsEditingProfile(false); }
    } catch { setProfileError('Your changes were not saved. Please try Save Details again.'); }
    finally { setProfileBusy(false); }
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
    setSubmitError('');
    
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

      if (response?.data && ['Low', 'Medium', 'Moderate', 'High'].includes(response.data.risk_level) && Number.isFinite(response.data.myopia_probability) && response.data.myopia_probability >= 0 && response.data.myopia_probability <= 1) {
        const d = response.data;
        
        // Construct dynamic historical trend line
        const prior = [...history].reverse().filter(item => Number.isFinite(item.myopia_probability));
        const baseTrend = prior.map(item => Number((item.myopia_probability * 100).toFixed(1)));
        const newScore = Number((d.myopia_probability * 100).toFixed(1));
        
        setResult({
          screeningId: d.screening_id,
          reportEmail: d.report_email,
          careGuidance: d.care_guidance,
          patientName: formData.name || profile.name || "Patient",
          patientGender: formData.gender,
          patientAge: formData.age,
          date: new Date().toLocaleDateString(),
          detection: d.risk_level + " Risk for Myopia",
          severity: d.risk_level,
          riskScore: newScore,
          trendData: [...baseTrend, newScore],
          trendLabels: [...prior.map(item => new Date(item.created_at).toLocaleDateString()), "Current"],
          recommendations: d.recommendation ? [d.recommendation] : [],
          myopiaDetected:   d.myopia_detected   ?? null,
          probability:      d.myopia_probability ?? null,
          nextSpheq:        d.predicted_next_spheq ?? null,
        });
        
        // Refresh patient's history list
        fetchPatientData();
      } else { throw new Error('The server did not return a valid model result. Please try again.'); }
    } catch (err) {
      setSubmitError(err.message || 'We could not generate your screening. Your entries are still here; please try again.');
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
      const res = await api.post('/chatbot/query', { message: msg, language });
      if (res && res.data && res.data.response) {
        setMessages(prev => [...prev, { text: res.data.response, isBot: true }]);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { text: err.message || "Network error fetching AI response.", isBot: true }]);
    }
  };

  const chartData = {
    labels: result?.trendLabels || [],
    datasets: [{
      label: 'Risk Score History',
      data: result?.trendData || [],
      borderColor: '#254e7a',
      backgroundColor: 'rgba(37, 78, 122, 0.15)',
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
        borderColor: '#254e7a',
        backgroundColor: 'rgba(37, 78, 122, 0.05)',
        yAxisID: 'yAl',
        tension: 0.3,
        borderWidth: 3,
        pointBackgroundColor: '#254e7a',
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
        title: { display: true, text: 'Axial Length (mm)', color: '#254e7a', font: { weight: 'bold' } },
        grid: { drawOnChartArea: false },
      }
    }
  };

  const downloadReportPdf = async (patientId) => {
    setDownloadError('');
    setDownloadingId(patientId);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/patient/generate-report/${patientId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok || !response.headers.get('content-type')?.includes('application/pdf')) {
        throw new Error('Report download failed. Please try again.');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `myopia_report_${patientId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error("Failed to download PDF", err);
      setDownloadError("The clinical report could not be downloaded. Please try Download PDF Report again.");
    } finally { setDownloadingId(''); }
  };

  return (
    <div className="care-workspace min-h-screen bg-gradient-to-br from-blue-50/50 to-slate-100 flex flex-col relative pb-20">

      <nav className="patient-hospital-nav bg-white/95 backdrop-blur-md border-b px-6 py-4 flex items-center justify-between sticky top-0 z-40 shadow-sm" aria-label={t("Patient portal navigation")}>
        <div className="flex items-center space-x-4">
          <HospitalBrand compact />
          <h1 className="hidden lg:block text-sm font-semibold text-slate-500 border-l pl-4">{t("Patient portal")}</h1>
          <button className="mobile-portal-help" aria-label={t("Open patient assistant")} onClick={() => setIsChatOpen(!isChatOpen)}><MessageSquare size={20}/></button>
        </div>
        <div className="patient-tabs flex items-center space-x-4">
          <button 
            onClick={() => { setActiveTab('assessment'); setResult(null); }} 
            className={`text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${activeTab === 'assessment' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:text-slate-800'}`}
          > {t("New Assessment")} </button>
          <button 
            onClick={() => setActiveTab('history')} 
            className={`text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${activeTab === 'history' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:text-slate-800'}`}
          > {t("Screening History")} </button>
          <button 
            onClick={() => setActiveTab('simulator')} 
            className={`text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${activeTab === 'simulator' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:text-slate-800'}`}
          > {t("Risk Simulator")} </button>
          <button 
            aria-label={t("Patient profile")}
            onClick={() => setActiveTab('profile')} 
            className={`w-9 h-9 bg-gradient-to-tr from-blue-500 to-blue-400 rounded-full flex items-center justify-center text-white font-bold cursor-pointer transition-all ${activeTab === 'profile' ? 'ring-2 ring-blue-600 ring-offset-2' : 'shadow-md hover:shadow-lg'}`}
          >
            {profile.name.charAt(0).toUpperCase()}
          </button>
        </div>
      </nav>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <PatientLanguageSwitch />
        {profileError && <div role="alert" className="patient-feedback"><p>{profileError}</p><button onClick={fetchProfile}>{t("Retry account details")}</button><button onClick={handleSignOut}>{t("Sign in again")}</button></div>}
        {historyError && <div role="alert" className="patient-feedback"><p>{historyError}</p><button onClick={fetchPatientData}>{t("Retry records")}</button></div>}
        {downloadError && <p role="alert" className="patient-feedback">{downloadError}</p>}
        {activeTab === 'assessment' && !result && <p className="patient-language-note" lang={language}>{t('Enter your details, then your daily routine. Your report includes a model estimate and guidance for your next visit.', 'प्रथम तुमची माहिती आणि नंतर दैनंदिन सवयी भरा. अहवालात मॉडेलचा अंदाज आणि पुढील भेटीसाठी मार्गदर्शन मिळेल.')}</p>}
        {activeTab === 'profile' ? (
          <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto mt-4">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">{t("Patient Profile")}</h2>
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
              <div className="flex items-center space-x-6 mb-8 pb-8 border-b border-slate-100">
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-100 to-blue-50 flex items-center justify-center text-blue-700 font-bold text-3xl border border-blue-200 uppercase">
                  {profile.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-800">{profile.name}</h3>
                  <p className="text-blue-600 font-semibold mb-1 capitalize">{t(profile.role)} {t("User")}</p>
                  <p className="text-slate-500 text-sm">{t("Last Assessment:")} {result ? t("Today") : "None"}</p>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <span className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{t("System ID")}</span>
                  <span className="text-slate-800 font-semibold">{profile.id || 'N/A'}</span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{t("Account Role")}</span>
                  <span className="text-slate-800 font-semibold flex items-center capitalize">{t(profile.role)} <CheckCircle2 className="w-4 h-4 ml-1 text-teal-500"/></span>
                </div>
                
                {!isEditingProfile ? (
                  <>
                    <div>
                      <span className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{t("Email Address")}</span>
                      <span className="text-slate-800 font-semibold">{profile.email}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{t("Full Name")}</span>
                      <span className="text-slate-800 font-semibold">{profile.name}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <span className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{t("Email Address")}</span>
                      <input type="email" value={editForm.email} readOnly aria-label={t("Email linked to your sign-in account")} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{t("Full Name")}</span>
                      <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                  </>
                )}

              </div>
              <div className="mt-8 pt-6 border-t border-slate-100 flex justify-between items-center">
                <button onClick={handleSignOut} className="text-red-500 font-bold text-sm hover:text-red-600 transition-colors">{t("Sign Out")}</button>
                <div className="space-x-3">
                  {isEditingProfile ? (
                    <>
                      <button onClick={() => setIsEditingProfile(false)} className="bg-slate-100 text-slate-600 px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors">{t("Cancel")}</button>
                      <button onClick={handleProfileSave} disabled={profileBusy} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/20">{profileBusy ? 'Saving…' : t("Save Details")}</button>
                    </>
                  ) : (
                    <button onClick={() => setIsEditingProfile(true)} className="bg-slate-100 text-slate-600 px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors">{t("Edit Profile")}</button>
                  )}
                </div>
              </div>

            </div>
          </Motion.div>
        ) : activeTab === 'history' ? (
          <Motion.div
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="max-w-4xl mx-auto mt-4 space-y-8 pb-10"
          >
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">{t("Your Screening & Diagnostic History")}</h2>
                <p className="text-slate-500 text-sm mt-1">{t("Track your lifestyle screenings and doctor evaluations.")}</p>
              </div>
            </div>

            {historyLoading ? <div className="patient-loading" role="status"><Loader2 className="animate-spin" size={22}/>{t("Loading your screening history and doctor reports…")}</div> : historyError ? null : <>
            {/* Progression Curve Mapping */}
            {reports.length > 0 ? (
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                  <Activity className="w-5 h-5 mr-2 text-red-500 animate-pulse" /> {t("Myopia Progression Curve (Axial Length vs SPHEQ)")} </h3>
                <div className="h-[280px] w-full">
                  <Line data={biometryChartData} options={biometryChartOptions} />
                </div>
              </div>
            ) : (
              <div className="bg-blue-50/50 rounded-2xl p-6 border border-blue-100 text-center">
                <h3 className="text-md font-bold text-blue-800 mb-1">{t("No Clinical Evaluation Curve Yet")}</h3>
                <p className="text-sm text-slate-600">{t("Once your doctor completes a fundus image scan and clinical biometry assessment, your progression curve will map here automatically.")}</p>
              </div>
            )}

            {/* History Panels */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Doctor Clinical Reports */}
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center border-b pb-3"> {t("📋 Doctor Clinical Reports (")}{reports.length})
                </h3>
                {reports.length === 0 ? (
                  <p className="text-sm text-slate-500 py-6 text-center">{t("No clinical reports generated by doctors yet.")}</p>
                ) : (
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                    {reports.map((rep) => (
                      <div key={rep.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-xs font-bold text-slate-400">{new Date(rep.created_at).toLocaleDateString()}</span>
                            <div className="text-sm font-semibold text-slate-800 mt-0.5">{t("Prediction:")} <span className="font-extrabold text-blue-600">{rep.prediction}</span></div>
                          </div>
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${rep.severity === 'High' ? 'bg-red-100 text-red-700' : rep.severity === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-700'}`}>
                            {rep.severity} {t("Risk")} </span>
                        </div>
                        <div className="text-xs text-slate-500">
                          {rep.axial_length && <span>{t("Axial Length:")} <strong>{rep.axial_length} mm</strong></span>}
                          {rep.refractive_error && <span className="ml-3">{t("Refraction:")} <strong>{rep.refractive_error} D</strong></span>}
                          {rep.doctor_verdict && (
                            <div className="mt-1 text-slate-600 font-medium"> {t("🩺 Doctor Verdict:")} <span className="font-semibold text-indigo-700">{rep.doctor_verdict}</span>
                            </div>
                          )}
                        </div>
                        <button 
                          onClick={() => downloadReportPdf(rep.patient_id)} disabled={!!downloadingId} 
                          className="mt-2 inline-flex items-center justify-center text-xs font-bold text-blue-600 bg-blue-50 py-1.5 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5 mr-1" /> {downloadingId === rep.patient_id ? 'Preparing PDF…' : t("Download PDF Report")}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Patient Self Lifestyle Screenings */}
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center border-b pb-3"> {t("🏠 Lifestyle Screenings (")}{history.length})
                </h3>
                {history.length === 0 ? (
                  <p className="text-sm text-slate-500 py-6 text-center">{t("No self-assessments generated yet.")}</p>
                ) : (
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                    {history.map((hist) => (
                      <div key={hist.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-xs font-bold text-slate-400">{new Date(hist.created_at).toLocaleDateString()}</span>
                            <div className="text-sm font-semibold text-slate-800 mt-0.5">{t("Lifestyle Screening")}</div>
                          </div>
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${hist.risk_level === 'High' ? 'bg-red-100 text-red-700' : hist.risk_level === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-700'}`}>
                            {hist.risk_level} {t("Risk")} </span>
                        </div>
                        <div className="text-xs text-slate-500 grid grid-cols-3 gap-2 mt-1">
                          <div>{t("📱 Screen:")} <strong>{hist.screen_time}h</strong></div>
                          <div>{t("📖 Reading:")} <strong>{hist.reading_time}h</strong></div>
                          <div>{t("🌳 Outdoor:")} <strong>{hist.outdoor_activity}h</strong></div>
                        </div>
                        {hist.recommendation && (
                          <div className="text-xs text-amber-800 bg-amber-50 p-2 rounded-lg mt-1 border border-amber-100/50">
                            💡 {hist.recommendation}
                          </div>
                        )}
                        <PatientReportDelivery screeningId={hist.id} initialState={hist.report_email} registeredEmail={profile.email} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            </>}
          </Motion.div>
        ) : activeTab === 'simulator' ? (
          <Motion.div
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="max-w-4xl mx-auto mt-4 space-y-8 pb-10"
          >
            <div className="text-left mb-6">
              <h2 className="text-2xl font-bold text-slate-800">{t("What-If Myopia Risk Simulator")}</h2>
              <p className="text-slate-500 text-sm mt-1">{t("Adjust lifestyle factor sliders below to simulate and preview your myopia risk score dynamically in real-time.")}</p>
            </div>

            <div className="grid md:grid-cols-12 gap-8">
              {/* Left Column: Sliders */}
              <div className="md:col-span-7 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6 text-left">
                <h3 className="font-bold text-slate-800 text-md border-b pb-3 mb-4">{t("Simulate Lifestyle Factors")}</h3>

                {/* Slider 1: Screen Time */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{t("Daily Screen Time")}</span>
                    <span className="text-sm font-black text-blue-600">{simScreen} {t("hrs/day")}</span>
                  </div>
                  <input 
                    type="range" min="0" max="16" step="0.5"
                    value={simScreen} onChange={e => setSimScreen(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-medium mt-1">
                    <span>{t("0 hrs (Ideal)")}</span>
                    <span>{t("16 hrs (Heavy)")}</span>
                  </div>
                </div>

                {/* Slider 2: Outdoor Activity */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{t("Outdoor Activity")}</span>
                    <span className="text-sm font-black text-blue-600">{simOutdoor} {t("hrs/day")}</span>
                  </div>
                  <input 
                    type="range" min="0" max="6" step="0.5"
                    value={simOutdoor} onChange={e => setSimOutdoor(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-medium mt-1">
                    <span>{t("0 hrs (None)")}</span>
                    <span>{t("6 hrs (Protective Factor)")}</span>
                  </div>
                </div>

                {/* Slider 3: Near-Work Reading Time */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{t("Continuous Near Work / Reading")}</span>
                    <span className="text-sm font-black text-indigo-600">{simReading} {t("hrs/day")}</span>
                  </div>
                  <input 
                    type="range" min="0" max="12" step="0.5"
                    value={simReading} onChange={e => setSimReading(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-medium mt-1">
                    <span>{t("0 hrs")}</span>
                    <span>{t("12 hrs")}</span>
                  </div>
                </div>

                {/* Slider 4: Sleep Time */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{t("Sleep Hours")}</span>
                    <span className="text-sm font-black text-purple-600">{simSleep} {t("hrs/day")}</span>
                  </div>
                  <input 
                    type="range" min="4" max="12" step="0.5"
                    value={simSleep} onChange={e => setSimSleep(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-medium mt-1">
                    <span>{t("4 hrs")}</span>
                    <span>{t("12 hrs (Healthy)")}</span>
                  </div>
                </div>

                {/* Dropdown 5: Parental Myopia */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wider">{t("Myopia in Parents")}</label>
                  <select 
                    value={simParental} onChange={e => setSimParental(parseInt(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors cursor-pointer outline-none"
                  >
                    <option value="0">{t("Neither Parent has Myopia (0)")}</option>
                    <option value="1">{t("One Parent has Myopia (1)")}</option>
                    <option value="2">{t("Both Parents have Myopia (2)")}</option>
                  </select>
                </div>
              </div>

              {/* Right Column: Real-time calculation visual gauge */}
              <div className="md:col-span-5 flex flex-col space-y-6">
                {/* Score gauge card */}
                {(() => {
                  if (simError) return <div role="alert" className="patient-feedback"><p>{simError}</p><button onClick={() => setSimRetry(value => value + 1)}>{t("Retry model preview")}</button></div>;
                  if (!simResult) return <p role="status" className="patient-loading"><Loader2 size={18} className="animate-spin"/>{t("Requesting model prediction…")}</p>;
                  const finalScore = Number((simResult.myopia_probability * 100).toFixed(1));
                  const isHigh = simResult.risk_level === 'High';
                  const isMed = simResult.risk_level === 'Medium';
                  const colorClass = isHigh ? 'text-red-500 bg-red-50/50 border-red-100' : isMed ? 'text-amber-500 bg-amber-50/50 border-amber-100' : 'text-teal-500 bg-teal-50/50 border-teal-100';
                  const circleColor = isHigh ? 'text-red-500' : isMed ? 'text-amber-500' : 'text-teal-500';
                  
                  return (
                    <>
                      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center">
                        <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-6">{t("Model-predicted Myopia Risk")}</h4>
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
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{t("Risk Score")}</span>
                          </div>
                        </div>
                        <h3 className="text-lg font-extrabold text-slate-800 mb-1">{isHigh ? 'High Risk' : isMed ? 'Moderate Risk' : 'Low Risk'}</h3>
                        <p className="text-xs text-slate-500 font-medium px-4">{t("Based on current simulated parameters")}</p>
                      </div>

                      {/* Clinical Recommendations box */}
                      <div className={`rounded-3xl p-6 border shadow-sm text-left ${colorClass}`}>
                        <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5"> {t("📢 AI Clinical Recommendation")} </h4>
                        <p className="text-xs font-semibold text-slate-600 leading-relaxed">
                          {simResult.recommendation}
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </Motion.div>
        ) : (
          <AnimatePresence mode="wait">
            {!result ? (
              <Motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-xl mx-auto"
            >
              <div className="text-center mb-8">
                <p className="screening-kicker">{t("SHRI SARVESHWAR NETRALAYA · PATIENT CARE")}</p>
                <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">{t("Your eye-health screening")}</h2>
                <p className="text-slate-500 mt-2">{t("Understand your screening risk and prepare for your eye examination.")}</p>
              </div>
              <ol className="screening-progress" aria-label={t("Screening progress")}><li className={formStep === 1 ? 'current-step' : 'completed-step'} aria-current={formStep === 1 ? 'step' : undefined}><span>{formStep > 1 ? '✓' : '1'}</span>{t("Your details")}</li><li className={formStep === 2 ? 'current-step' : ''} aria-current={formStep === 2 ? 'step' : undefined}><span>2</span>{t("Daily routine")}</li><li><span>3</span>{t("Your report")}</li></ol>
              <div className="bg-white rounded-2xl shadow-xl shadow-blue-900/5 border border-slate-100 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-6 text-white flex justify-between items-center">
                  <h3 className="text-lg font-semibold flex items-center">
                    <Activity className="w-5 h-5 mr-2 opacity-80" /> {formStep === 1 ? 'Let’s get to know you' : 'Tell us about your routine'}
                  </h3>
                  <span className="text-sm font-bold bg-white/20 px-3 py-1 rounded-full">{t("Step")} {formStep} {t("of 2")}</span>
                </div>
                <div className="p-6 md:p-8">
                  <form aria-busy={isSubmitting} onSubmit={formStep === 1 ? (e) => { e.preventDefault(); setFormStep(2); } : handleSubmit} className="space-y-5">
                    {submitError && <div role="alert" className="patient-feedback"><p>{submitError}</p><p>{t("Your entries are saved on this page. Use Generate Report to retry.")}</p></div>}
                    {isSubmitting && <p role="status" className="patient-loading"><Loader2 size={18} className="animate-spin"/> {t("Running your screening model. Please keep this page open…")}</p>}
                    {formStep === 1 ? (
                      <Motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
                        <div>
                          <label htmlFor="patient-name" className="block text-sm font-semibold text-slate-700 mb-1.5">{t("Full Name")}</label>
                            <input id="patient-name" 
                            type="text" required
                            className="w-full rounded-lg border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" 
                            value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                            placeholder={t("Enter your full name")}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-5">
                          <div>
                            <label htmlFor="patient-age" className="block text-sm font-semibold text-slate-700 mb-1.5">{t("Age")}</label>
                            <input id="patient-age" 
                              type="number" required min="1" max="120"
                              className="w-full rounded-lg border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" 
                              value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})}
                              placeholder="e.g. 24"
                            />
                          </div>
                          <div>
                            <label htmlFor="patient-gender" className="block text-sm font-semibold text-slate-700 mb-1.5">{t("Gender")}</label>
                            <select id="patient-gender" 
                              className="w-full rounded-lg border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                              value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})}
                            >
                              <option value="Male">{t("Male")}</option>
                              <option value="Female">{t("Female")}</option>
                              <option value="Other">{t("Other")}</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label htmlFor="assigned-doctor" className="block text-sm font-semibold text-slate-700 mb-1.5"> {t("Your doctor")} <span className="text-slate-400 font-normal text-xs">{t("(required)")}</span>
                          </label>
                          <select
                            required
                            className="w-full rounded-lg border-blue-200 bg-blue-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors font-medium"
                            id="assigned-doctor" value={selectedDoctorId}
                            disabled={doctorsLoading || !!doctorsError}
                            onChange={e => setSelectedDoctorId(e.target.value)}
                          >
                            <option value="">{t("-- Select your assigned doctor --")}</option>
                            {doctors.map(d => (
                              <option key={d.id} value={d.id}>Dr. {d.name} ({d.email})</option>
                            ))}
                          </select>
                          {doctorsLoading && <p role="status" className="text-sm text-slate-600 mt-2">{t("Loading available doctors…")}</p>}
                          {doctorsError && <div role="alert" className="patient-feedback"><p>{doctorsError}</p><button type="button" onClick={fetchDoctors}>{t("Retry doctor list")}</button></div>}
                          {!doctorsLoading && !doctorsError && doctors.length === 0 && (
                            <p className="text-xs text-amber-500 mt-1 font-medium">{t("No doctors are available for assignment yet. Contact the hospital for help.")}</p>
                          )}
                        </div>
                        <button type="submit" className="w-full rounded-xl text-md font-bold text-white bg-blue-600 hover:bg-blue-700 h-12 mt-6 transition-all shadow-lg hover:shadow-blue-500/30">{t("Continue to daily routine")}</button>
                      </Motion.div>
                    ) : (
                      <Motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
                        <div className="grid grid-cols-2 gap-5">
                          <div>
                            <label htmlFor="screen-hours" className="block text-sm font-semibold text-slate-700 mb-1.5">{t("Screen Time (hrs)")}</label>
                            <input id="screen-hours" 
                              type="number" required min="0" max="24" step="0.5"
                              className="w-full rounded-lg border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" 
                              value={formData.screenTime} onChange={e => setFormData({...formData, screenTime: e.target.value})}
                            />
                          </div>
                          <div>
                            <label htmlFor="reading-hours" className="block text-sm font-semibold text-slate-700 mb-1.5">{t("Reading Time (hrs)")}</label>
                            <input id="reading-hours" 
                              type="number" required min="0" max="24" step="0.5"
                              className="w-full rounded-lg border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" 
                              value={formData.readingTime} onChange={e => setFormData({...formData, readingTime: e.target.value})}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-5">
                          <div>
                            <label htmlFor="work-hours" className="block text-sm font-semibold text-slate-700 mb-1.5">{t("Work/Study (hrs)")}</label>
                            <input id="work-hours"
                              type="number" required min="0" max="24" step="0.5"
                              className="w-full rounded-lg border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" 
                              value={formData.workHours} onChange={e => setFormData({...formData, workHours: e.target.value})}
                            />
                          </div>
                          <div>
                            <label htmlFor="sleep-hours" className="block text-sm font-semibold text-slate-700 mb-1.5">{t("Sleep Time (hrs)")}</label>
                            <input id="sleep-hours"
                              type="number" required min="0" max="24" step="0.5"
                              className="w-full rounded-lg border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" 
                              value={formData.sleepHours} onChange={e => setFormData({...formData, sleepHours: e.target.value})}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-5">
                          <div>
                            <label htmlFor="outdoor-hours" className="block text-sm font-semibold text-slate-700 mb-1.5">{t("Outdoor Time (hrs)")}</label>
                            <input id="outdoor-hours" 
                              type="number" required min="0" max="24" step="0.5"
                              className="w-full rounded-lg border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" 
                              value={formData.outdoorActivity} onChange={e => setFormData({...formData, outdoorActivity: e.target.value})}
                            />
                          </div>
                          <div>
                            <label htmlFor="parental-myopia" className="block text-sm font-semibold text-slate-700 mb-1.5">{t("Parental Myopia")}</label>
                            <select id="parental-myopia" 
                              className="w-full rounded-lg border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                              value={formData.parentalMyopia} onChange={e => setFormData({...formData, parentalMyopia: e.target.value})}
                            >
                              <option value="0">{t("0 Parents")}</option>
                              <option value="1">{t("1 Parent")}</option>
                              <option value="2">{t("2 Parents")}</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex space-x-4 pt-4">
                          <button type="button" onClick={() => setFormStep(1)} className="w-1/3 rounded-xl text-md font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 h-12 transition-all">{t("Back")}</button>
                          <button 
                            type="submit" disabled={isSubmitting}
                            className="w-2/3 inline-flex items-center justify-center rounded-xl text-md font-bold text-white bg-blue-600 hover:bg-blue-700 h-12 transition-all shadow-lg hover:shadow-blue-500/30 disabled:opacity-70"
                          >
                            {isSubmitting ? <><Loader2 className="w-5 h-5 mr-2 animate-spin"/> {t("Generating...")}</> : t("Generate Report")}
                          </button>
                        </div>
                      </Motion.div>
                    )}
                  </form>
                </div>
              </div>
            </Motion.div>
          ) : (
            <Motion.div
              key="report"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-end mb-6 border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-3xl font-extrabold text-slate-800">{t("Your Eye-Health Screening Report")}</h2>
                  <p className="text-slate-600 mt-2 font-medium flex items-center">
                    <User className="w-4 h-4 mr-1.5 text-blue-500"/> {t("Patient:")} <span className="font-bold text-slate-800 mx-1">{result.patientName}</span> • {result.patientAge} {t("Yrs •")} {result.patientGender}
                  </p>
                  <p className="text-slate-500 text-sm mt-1 flex items-center"><CheckCircle2 className="w-4 h-4 mr-1 text-teal-500" /> {t("Generated on")} {result.date}</p>
                </div>
              </div>
              <ScreeningSummary result={result} />
              <PatientReportDelivery key={result.screeningId} screeningId={result.screeningId} initialState={result.reportEmail} registeredEmail={profile.email} />
              {result.careGuidance && (
                <section className="rounded-2xl bg-white border p-6 text-left space-y-4">
                  <p className="text-xs text-slate-500">{t("Detailed care guidance · English")}</p>
                  <h3 className="text-xl font-bold text-slate-800">{result.careGuidance.title}</h3>
                  <p className="text-slate-700">{result.careGuidance.meaning}</p>
                  <p className="text-sm text-slate-500">{result.careGuidance.probability_note}</p>
                  <p className="rounded-lg bg-blue-50 p-4 text-blue-900">{result.careGuidance.next_step}</p>
                  <h4 className="font-bold text-slate-800">{t("Daily precautions and healthy habits")}</h4>
                  <ul className="list-disc pl-5 space-y-2 text-sm text-slate-700">{(result.careGuidance.habits || []).map(habit => <li key={habit}>{habit}</li>)}</ul>
                  <details className="rounded-lg border p-4 text-sm text-slate-700">
                    <summary className="cursor-pointer font-bold">{t("Doctor discussion and appointment preparation")}</summary>
                    <ul className="list-disc pl-5 mt-3 space-y-2">{[...(result.careGuidance.doctor_discussion || []), ...(result.careGuidance.appointment_checklist || [])].map(item => <li key={item}>{item}</li>)}</ul>
                    <p className="mt-3">{t("Your PDF includes your assigned doctor's registered contact, when available. Contact the practice to book an appointment.")}</p>
                  </details>
                  <p className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-900"><strong>{t("Urgent symptoms:")} </strong>{result.careGuidance.urgent_care}</p>
                </section>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1 bg-white rounded-2xl p-6 border shadow-sm flex flex-col items-center justify-center text-center">
                  <div className="relative mb-4">
                    <svg className="w-32 h-32 transform -rotate-90">
                      <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="12" className="text-slate-100 fill-none" />
                      <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="12" strokeDasharray="351.8" strokeDashoffset={351.8 - (351.8 * result.riskScore) / 100} className={`fill-none ${result.riskScore >= 70 ? 'text-red-500' : result.riskScore >= 40 ? 'text-amber-500' : 'text-teal-500'} transition-all duration-1000 ease-out`} strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-black text-slate-800">{result.riskScore}%</span>
                      <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">{t("Model estimate")}</span>
                    </div>
                  </div>
                  <h3 className="text-xl font-bold mb-1">{result.severity} {t("Risk")}</h3>
                  <p className="text-sm text-slate-500">{result.detection}</p>
                </div>

                <div className="md:col-span-2 min-w-0 bg-white rounded-2xl p-6 border shadow-sm">
                  <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                    <Activity className="w-5 h-5 mr-2 text-blue-500" /> {t("Recorded Screening Probabilities")} </h3>
                  <div className="h-[200px] w-full">
                    <Line data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100, grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } } }} />
                  </div>
                </div>
              </div>

              {result.nextSpheq !== null && Number.isFinite(result.nextSpheq) && (
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 text-center">
                  <p className="text-xs font-bold uppercase tracking-widest mb-2 text-slate-500">{t("Predicted Next SPHEQ")}</p>
                  <p className="text-3xl font-bold text-blue-700">{result.nextSpheq.toFixed(2)} D</p>
                  <p className="text-sm text-slate-500">{t("Model-estimated refractive value at next visit")}</p>
                </div>
              )}

              {result.recommendations.length > 0 && <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-6 border border-amber-100 mt-6 shadow-sm">
                <h3 className="text-lg font-bold text-amber-800 mb-3 flex items-center">
                  <AlertTriangle className="w-5 h-5 mr-2" /> {t("Screening Recommendations")} </h3>
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
              </div>}
            </Motion.div>
          )}
        </AnimatePresence>
        )}
      </main>

      {/* Chatbot Floating UI */}
      <div className="patient-chat-widget fixed bottom-6 right-6 z-50">
        <AnimatePresence>
          {isChatOpen && (
            <Motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="patient-chat-panel absolute bottom-16 right-0 w-[350px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[450px]"
            >
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <Bot className="w-6 h-6" />
                  <span className="font-bold">{t("Vision AI Assistant")}</span>
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
                  <input type="text" value={chatMessage} onChange={e => setChatMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChatMessage()} placeholder={t("Ask about your report...")} className="w-full bg-slate-100 border-transparent rounded-full pl-4 pr-12 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-inner" />
                  <button onClick={sendChatMessage} className="absolute right-2 top-2 p-1.5 bg-blue-600 text-white rounded-full shadow hover:bg-blue-700 transition-colors">
                    <Send className="w-4 h-4 ml-px" />
                  </button>
                </div>
              </div>
            </Motion.div>
          )}
        </AnimatePresence>
        <Motion.button
          aria-label={isChatOpen ? 'Close patient assistant' : t("Open patient assistant")}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="w-14 h-14 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white shadow-xl shadow-blue-900/20 border-2 border-white"
        >
          {isChatOpen ? <ChevronDown className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
        </Motion.button>
      </div>
    </div>
  );
}
