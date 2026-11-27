import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Activity, AlertTriangle, CheckCircle2, Loader2, MessageSquare, Send,
  User, ChevronDown, Download, FileText, ClipboardList, Monitor, BookOpen, Sun, ArrowLeft
} from 'lucide-react';
import { Line } from 'react-chartjs-2';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { api, API_BASE_URL } from '../lib/api';
import { getAuthToken, clearAuthSession } from '../lib/authSession';
import useIdleTimeout from '../lib/useIdleTimeout';
import PatientReportDelivery from '../components/PatientReportDelivery';
import HospitalBrand from '../components/HospitalBrand';
import PatientLanguageSwitch from '../components/PatientLanguageSwitch';
import ScreeningSummary from '../components/ScreeningSummary';
import { usePatientLanguage } from '../lib/patientLanguage';
import OnboardingFlow from '../components/OnboardingFlow';
import AccountDangerZone from '../components/AccountDangerZone';
import { HistorySkeleton } from '../components/Skeleton';
import ChatMessageBody from '../components/ChatMessageBody';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

function riskBadgeClass(level) {
  const v = String(level || '').toLowerCase();
  if (v === 'high') return 'clinical-badge clinical-badge-high';
  if (v === 'medium' || v === 'moderate') return 'clinical-badge clinical-badge-medium';
  if (v === 'low') return 'clinical-badge clinical-badge-low';
  return 'clinical-badge clinical-badge-neutral';
}

export default function PatientDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const activeTab = searchParams.get('tab') || 'assessment';
  const setActiveTab = useCallback((tab) => {
    if (tab === activeTab && !searchParams.get('edit') && !searchParams.get('step')) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      next.delete('edit');
      next.delete('step');
      return next;
    });
  }, [activeTab, searchParams, setSearchParams]);
  const formStep = searchParams.get('step') === '2' ? 2 : 1;
  const setFormStep = useCallback((nextStep) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (nextStep === 2) next.set('step', '2');
      else next.delete('step');
      return next;
    });
  }, [setSearchParams]);
  const [formData, setFormData] = useState({
    name: '', gender: 'Male', age: '',
    screenTime: '', readingTime: '', workHours: '', sleepHours: '',
    outdoorActivity: '', parentalMyopia: '0',
  });
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => localStorage.getItem('visionai_onboarding_complete') !== 'true');
  const chatInputRef = useRef(null);
  const chatTriggerRef = useRef(null);

  const toggleChat = (event) => {
    if (isChatOpen) {
      setIsChatOpen(false);
    } else {
      chatTriggerRef.current = event.currentTarget;
      setIsChatOpen(true);
    }
  };

  useEffect(() => {
    if (isChatOpen) {
      chatInputRef.current?.focus();
    } else if (chatTriggerRef.current?.isConnected) {
      chatTriggerRef.current.focus();
    }
  }, [isChatOpen]);

  // Simulator States
  const [simScreen, setSimScreen] = useState(4);
  const [simOutdoor, setSimOutdoor] = useState(2);
  const [simReading, setSimReading] = useState(2);
  const [simSleep, setSimSleep] = useState(8);
  const [simParental, setSimParental] = useState(0);

  const [profile, setProfile] = useState({ name: 'Loading...', email: 'Loading...', role: 'patient' });
  const isEditingProfile = searchParams.get('edit') === '1';
  const setIsEditingProfile = useCallback((editing) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (editing) next.set('edit', '1');
      else next.delete('edit');
      return next;
    });
  }, [setSearchParams]);
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
      console.error('Logout backend request failed:', err);
    }
    clearAuthSession();
    navigate('/login', { replace: true });
  };

  useIdleTimeout(handleSignOut);

  const [chatMessage, setChatMessage] = useState('');
  const [messages, setMessages] = useState([
    { text: "Hello. I'm your Vision AI care assistant. I can help explain your screening report, provide general eye-care habits, or answer questions about myopia. How can I help today?", isBot: true },
  ]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');

    try {
      const response = await api.post('/patient/risk', {
        name: formData.name || profile.name || 'Patient',
        gender: formData.gender,
        age: parseInt(formData.age, 10) || 0,
        screen_time: parseFloat(formData.screenTime) || 0,
        reading_time: parseFloat(formData.readingTime) || 0,
        work_hours: parseFloat(formData.workHours) || 0,
        sleep_hours: parseFloat(formData.sleepHours) || 0,
        outdoor_activity: parseFloat(formData.outdoorActivity) || 0,
        parental_myopia: parseInt(formData.parentalMyopia, 10) || 0,
        assigned_doctor_id: selectedDoctorId || null,
      });

      if (response?.data && ['Low', 'Medium', 'Moderate', 'High'].includes(response.data.risk_level) && Number.isFinite(response.data.myopia_probability) && response.data.myopia_probability >= 0 && response.data.myopia_probability <= 1) {
        const d = response.data;
        const prior = [...history].reverse().filter((item) => Number.isFinite(item.myopia_probability));
        const baseTrend = prior.map((item) => Number((item.myopia_probability * 100).toFixed(1)));
        const newScore = Number((d.myopia_probability * 100).toFixed(1));

        setResult({
          screeningId: d.screening_id,
          reportEmail: d.report_email,
          careGuidance: d.care_guidance,
          patientName: formData.name || profile.name || 'Patient',
          patientGender: formData.gender,
          patientAge: formData.age,
          date: new Date().toLocaleDateString(),
          detection: `${d.risk_level} Risk for Myopia`,
          severity: d.risk_level,
          riskScore: newScore,
          trendData: [...baseTrend, newScore],
          trendLabels: [...prior.map((item) => new Date(item.created_at).toLocaleDateString()), 'Current'],
          recommendations: d.recommendation ? [d.recommendation] : [],
          myopiaDetected: d.myopia_detected ?? null,
          probability: d.myopia_probability ?? null,
          nextSpheq: d.predicted_next_spheq ?? null,
        });

        fetchPatientData();
      } else {
        throw new Error('The server did not return a valid model result. Please try again.');
      }
    } catch (err) {
      setSubmitError(err.message || 'We could not generate your screening. Your entries are still here; please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sendChatMessage = async () => {
    if (!chatMessage.trim()) return;
    const msg = chatMessage;
    setMessages((prev) => [...prev, { text: msg, isBot: false }]);
    setChatMessage('');

    try {
      const res = await api.post('/chatbot/query', { message: msg, language });
      if (res && res.data && res.data.response) {
        setMessages((prev) => [...prev, { text: res.data.response, isBot: true }]);
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [...prev, { text: err.message || 'Network error fetching AI response.', isBot: true }]);
    }
  };

  const chartData = {
    labels: result?.trendLabels || [],
    datasets: [{
      label: 'Risk Score History',
      data: result?.trendData || [],
      borderColor: '#17365d',
      backgroundColor: 'rgba(23, 54, 93, 0.1)',
      fill: true,
      tension: 0.3,
    }],
  };

  const sortedReports = [...reports].reverse();
  const biometryLabels = sortedReports.map((r) =>
    new Date(r.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })
  );
  const spheqData = sortedReports.map((r) => r.refractive_error ?? -1.0);
  const alData = sortedReports.map((r) => r.axial_length ?? 24.0);

  const biometryChartData = {
    labels: biometryLabels.length > 0 ? biometryLabels : ['No Data'],
    datasets: [
      {
        label: 'Refractive Error (SPHEQ - Diopters)',
        data: spheqData.length > 0 ? spheqData : [0],
        borderColor: '#b45345',
        backgroundColor: 'rgba(180, 83, 69, 0.06)',
        yAxisID: 'ySpheq',
        tension: 0.25,
        borderWidth: 2.5,
        pointBackgroundColor: '#b45345',
      },
      {
        label: 'Axial Length (AL - mm)',
        data: alData.length > 0 ? alData : [24],
        borderColor: '#17365d',
        backgroundColor: 'rgba(23, 54, 93, 0.06)',
        yAxisID: 'yAl',
        tension: 0.25,
        borderWidth: 2.5,
        pointBackgroundColor: '#17365d',
      },
    ],
  };

  const biometryChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { font: { weight: '600' } },
      },
    },
    scales: {
      ySpheq: {
        type: 'linear',
        position: 'left',
        title: { display: true, text: 'Refractive Error (D)', color: '#b45345', font: { weight: '600' } },
        grid: { color: '#f1f5f9' },
      },
      yAl: {
        type: 'linear',
        position: 'right',
        title: { display: true, text: 'Axial Length (mm)', color: '#17365d', font: { weight: '600' } },
        grid: { drawOnChartArea: false },
      },
    },
  };

  const downloadReportPdf = async (patientId) => {
    setDownloadError('');
    setDownloadingId(patientId);
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/patient/generate-report/${patientId}`, {
        headers: { Authorization: `Bearer ${token}` },
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
      console.error('Failed to download PDF', err);
      setDownloadError('The clinical report could not be downloaded. Please try Download PDF Report again.');
    } finally { setDownloadingId(''); }
  };

  return (
    <div className="care-workspace clinical-shell flex flex-col relative pb-20">
      <a href="#patient-main" className="skip-link">Skip to content</a>
      <nav className="patient-hospital-nav bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between sticky top-0 z-40" aria-label={t('Patient portal navigation')}>
        <div className="flex items-center space-x-4">
          <HospitalBrand compact />
          <h1 className="hidden lg:block text-sm font-semibold text-slate-600 border-l border-slate-200 pl-4">{t('Patient portal')}</h1>
          <button type="button" className="mobile-portal-help" aria-label={t('Open patient assistant')} onClick={toggleChat}>
            <MessageSquare size={20} />
          </button>
        </div>
        <div className="patient-tabs flex items-center space-x-2">
          <button
            type="button"
            aria-current={activeTab === 'assessment' ? 'page' : undefined}
            onClick={() => { setActiveTab('assessment'); setResult(null); }}
            className={`text-sm font-semibold px-3.5 py-2 rounded-lg transition-colors cursor-pointer ${activeTab === 'assessment' ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
          >
            {t('New Assessment')}
          </button>
          <button
            type="button"
            aria-current={activeTab === 'history' ? 'page' : undefined}
            onClick={() => setActiveTab('history')}
            className={`text-sm font-semibold px-3.5 py-2 rounded-lg transition-colors cursor-pointer ${activeTab === 'history' ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
          >
            {t('Screening History')}
          </button>
          <button
            type="button"
            aria-current={activeTab === 'simulator' ? 'page' : undefined}
            onClick={() => setActiveTab('simulator')}
            className={`text-sm font-semibold px-3.5 py-2 rounded-lg transition-colors cursor-pointer ${activeTab === 'simulator' ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
          >
            {t('Risk Simulator')}
          </button>
          <button
            type="button"
            aria-label={t('Patient profile')}
            aria-current={activeTab === 'profile' ? 'page' : undefined}
            onClick={() => setActiveTab('profile')}
            className={`w-9 h-9 bg-slate-100 border rounded-full flex items-center justify-center text-slate-800 font-semibold cursor-pointer transition-colors ${activeTab === 'profile' ? 'border-blue-700 ring-2 ring-blue-200' : 'border-slate-300 hover:bg-slate-200'}`}
          >
            {profile.name.charAt(0).toUpperCase()}
          </button>
        </div>
      </nav>

      <main id="patient-main" className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <PatientLanguageSwitch />
        {profileError && <div role="alert" className="patient-feedback"><p>{profileError}</p><button type="button" onClick={fetchProfile}>{t('Retry account details')}</button><button type="button" onClick={handleSignOut}>{t('Sign in again')}</button></div>}
        {historyError && <div role="alert" className="patient-feedback"><p>{historyError}</p><button type="button" onClick={fetchPatientData}>{t('Retry records')}</button></div>}
        {downloadError && <p role="alert" className="patient-feedback">{downloadError}</p>}
        {activeTab === 'assessment' && !result && (
          <p className="patient-language-note" lang={language}>
            {t('Enter your details, then your daily routine. Your report includes a model estimate and guidance for your next visit.', 'प्रथम तुमची माहिती आणि नंतर दैनंदिन सवयी भरा. अहवालात मॉडेलचा अंदाज आणि पुढील भेटीसाठी मार्गदर्शन मिळेल.')}
          </p>
        )}

        {activeTab === 'profile' ? (
          <div className="max-w-3xl mx-auto mt-2">
            <h2 className="text-xl font-semibold text-slate-900 mb-5">{t('Patient Profile')}</h2>
            <div className="clinical-card p-6 sm:p-8">
              <div className="flex items-center space-x-5 mb-7 pb-6 border-b border-slate-200">
                <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-800 font-semibold text-2xl uppercase">
                  {profile.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">{profile.name}</h3>
                  <p className="text-blue-700 font-medium text-sm capitalize">{t(profile.role)} {t('User')}</p>
                  <p className="text-slate-600 text-xs mt-0.5">{t('Last Assessment:')} {result ? t('Today') : history[0]?.created_at ? new Date(history[0].created_at).toLocaleDateString() : 'None'}</p>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <span className="clinical-label text-slate-500">{t('System ID')}</span>
                  <span className="text-sm text-slate-900 font-medium ui-tabular break-all">{profile.id || 'N/A'}</span>
                </div>
                <div>
                  <span className="clinical-label text-slate-500">{t('Account Role')}</span>
                  <span className="text-sm text-slate-900 font-medium flex items-center gap-1.5 capitalize">
                    {t(profile.role)} <CheckCircle2 className="w-4 h-4 text-teal-700" />
                  </span>
                </div>
                {!isEditingProfile ? (
                  <>
                    <div>
                      <span className="clinical-label text-slate-500">{t('Email Address')}</span>
                      <span className="text-sm text-slate-900 font-medium">{profile.email}</span>
                    </div>
                    <div>
                      <span className="clinical-label text-slate-500">{t('Full Name')}</span>
                      <span className="text-sm text-slate-900 font-medium">{profile.name}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label htmlFor="pat-profile-email" className="clinical-label">{t('Email Address')}</label>
                      <input id="pat-profile-email" type="email" value={editForm.email} readOnly aria-label={t('Email linked to your sign-in account')} className="clinical-input bg-slate-50 text-slate-500" />
                    </div>
                    <div>
                      <label htmlFor="pat-profile-name" className="clinical-label">{t('Full Name')}</label>
                      <input id="pat-profile-name" type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="clinical-input" />
                    </div>
                  </>
                )}
              </div>
              <div className="mt-7 pt-5 border-t border-slate-200 flex flex-wrap justify-between items-center gap-3">
                <div className="flex items-center gap-4">
                  <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center text-sm font-semibold text-slate-600 hover:text-blue-700 transition-colors">
                    <ArrowLeft className="w-4 h-4 mr-1.5" /> {t('Back')}
                  </button>
                  <button type="button" onClick={handleSignOut} className="text-red-700 font-semibold text-sm hover:underline">{t('Sign Out')}</button>
                </div>
                <div className="flex items-center gap-3">
                  {isEditingProfile ? (
                    <>
                      <button type="button" onClick={() => setIsEditingProfile(false)} className="clinical-btn-secondary">{t('Cancel')}</button>
                      <button type="button" onClick={handleProfileSave} disabled={profileBusy} className="clinical-btn-primary">
                        {profileBusy ? 'Saving...' : t('Save Details')}
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setIsEditingProfile(true)} className="clinical-btn-secondary">{t('Edit Profile')}</button>
                  )}
                </div>
              </div>
              <AccountDangerZone onDeleted={() => navigate('/')} />
            </div>
          </div>
        ) : activeTab === 'history' ? (
          <div className="max-w-4xl mx-auto mt-2 space-y-6 pb-10">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{t('Your Screening & Diagnostic History')}</h2>
              <p className="text-slate-600 text-sm mt-1">{t('Track your lifestyle screenings and doctor evaluations.')}</p>
            </div>

            {historyLoading ? <HistorySkeleton /> : historyError ? null : (
              <>
                {reports.length > 0 ? (
                  <div className="clinical-card p-6">
                    <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-700" /> {t('Myopia Progression Curve (Axial Length vs SPHEQ)')}
                    </h3>
                    <div className="h-[280px] w-full">
                      <Line data={biometryChartData} options={biometryChartOptions} />
                    </div>
                  </div>
                ) : (
                  <div className="clinical-card p-6 text-center bg-slate-50">
                    <h3 className="text-base font-semibold text-slate-900 mb-1">{t('No Clinical Evaluation Curve Yet')}</h3>
                    <p className="text-sm text-slate-600">{t('Once your doctor completes a fundus image scan and clinical biometry assessment, your progression curve will map here automatically.')}</p>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Doctor Clinical Reports */}
                  <div className="clinical-card p-6 flex flex-col">
                    <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-200 pb-3">
                      <ClipboardList className="w-4 h-4 text-blue-700" />
                      Doctor Clinical Assessments ({reports.length})
                    </h3>
                    {reports.length === 0 ? (
                      <p className="text-sm text-slate-500 py-6 text-center">{t('No clinical reports generated by doctors yet.')}</p>
                    ) : (
                      <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
                        {reports.map((rep) => (
                          <div key={rep.id} className="clinical-card-muted p-4 space-y-2.5">
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <span className="text-xs font-medium text-slate-500 ui-tabular">{new Date(rep.created_at).toLocaleDateString()}</span>
                                <div className="text-sm font-semibold text-slate-900 mt-0.5">{t('Prediction:')} {rep.prediction}</div>
                              </div>
                              <span className={riskBadgeClass(rep.severity)}>{rep.severity} {t('Risk')}</span>
                            </div>
                            <div className="text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1 ui-tabular">
                              {rep.axial_length != null && <span>{t('Axial Length:')} <strong className="text-slate-900">{rep.axial_length} mm</strong></span>}
                              {rep.refractive_error != null && <span>{t('Refraction:')} <strong className="text-slate-900">{rep.refractive_error} D</strong></span>}
                            </div>
                            {rep.doctor_verdict && (
                              <div className="text-xs text-slate-700 pt-1">
                                Doctor Clinical Verdict: <strong className="text-slate-900">{rep.doctor_verdict}</strong>
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => downloadReportPdf(rep.patient_id)}
                              disabled={!!downloadingId}
                              className="clinical-btn-secondary w-full py-2 min-h-[36px] text-xs"
                            >
                              <Download className="w-3.5 h-3.5" /> {downloadingId === rep.patient_id ? 'Preparing PDF...' : t('Download PDF Report')}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Patient Self Lifestyle Screenings */}
                  <div className="clinical-card p-6 flex flex-col">
                    <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-200 pb-3">
                      <FileText className="w-4 h-4 text-blue-700" />
                      Self-Reported Lifestyle Screenings ({history.length})
                    </h3>
                    {history.length === 0 ? (
                      <p className="text-sm text-slate-500 py-6 text-center">{t('No self-assessments generated yet.')}</p>
                    ) : (
                      <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
                        {history.map((hist) => (
                          <div key={hist.id} className="clinical-card-muted p-4 space-y-2.5">
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <span className="text-xs font-medium text-slate-500 ui-tabular">{new Date(hist.created_at).toLocaleDateString()}</span>
                                <div className="text-sm font-semibold text-slate-900 mt-0.5">{t('Lifestyle Screening')}</div>
                              </div>
                              <span className={riskBadgeClass(hist.risk_level)}>{hist.risk_level} {t('Risk')}</span>
                            </div>
                            <div className="text-xs text-slate-600 grid grid-cols-3 gap-2 ui-tabular">
                              <div className="flex items-center gap-1"><Monitor className="w-3.5 h-3.5 text-slate-400" /> <span><span className="sr-only">{t('Screen time')}: </span>{hist.screen_time}h</span></div>
                              <div className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5 text-slate-400" /> <span><span className="sr-only">{t('Reading time')}: </span>{hist.reading_time}h</span></div>
                              <div className="flex items-center gap-1"><Sun className="w-3.5 h-3.5 text-slate-400" /> <span><span className="sr-only">{t('Outdoor activity')}: </span>{hist.outdoor_activity}h</span></div>
                            </div>
                            {hist.recommendation && (
                              <div className="text-xs text-slate-700 bg-white border border-slate-200 p-2.5 rounded-lg">
                                {hist.recommendation}
                              </div>
                            )}
                            <PatientReportDelivery screeningId={hist.id} initialState={hist.report_email} registeredEmail={profile.email} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : activeTab === 'simulator' ? (
          <div className="max-w-4xl mx-auto mt-2 space-y-6 pb-10">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{t('What-If Myopia Risk Simulator')}</h2>
              <p className="text-slate-600 text-sm mt-1">{t('Adjust lifestyle factor sliders below to simulate and preview your myopia risk score dynamically in real-time.')}</p>
            </div>

            <div className="grid md:grid-cols-12 gap-6">
              <div className="md:col-span-7 clinical-card p-6 space-y-5 text-left">
                <h3 className="font-semibold text-slate-900 text-base border-b border-slate-200 pb-3">{t('Simulate Lifestyle Factors')}</h3>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label htmlFor="sim-screen" className="clinical-label mb-0">{t('Daily Screen Time')}</label>
                    <span className="text-sm font-semibold text-blue-700 ui-tabular">{simScreen} {t('hrs/day')}</span>
                  </div>
                  <input id="sim-screen" type="range" min="0" max="16" step="0.5" value={simScreen} onChange={(e) => setSimScreen(parseFloat(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-700" />
                  <div className="flex justify-between text-xs text-slate-500 mt-1"><span>{t('0 hrs (Ideal)')}</span><span>{t('16 hrs (Heavy)')}</span></div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label htmlFor="sim-outdoor" className="clinical-label mb-0">{t('Outdoor Activity')}</label>
                    <span className="text-sm font-semibold text-blue-700 ui-tabular">{simOutdoor} {t('hrs/day')}</span>
                  </div>
                  <input id="sim-outdoor" type="range" min="0" max="6" step="0.5" value={simOutdoor} onChange={(e) => setSimOutdoor(parseFloat(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-700" />
                  <div className="flex justify-between text-xs text-slate-500 mt-1"><span>{t('0 hrs (None)')}</span><span>{t('6 hrs (Protective Factor)')}</span></div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label htmlFor="sim-reading" className="clinical-label mb-0">{t('Continuous Near Work / Reading')}</label>
                    <span className="text-sm font-semibold text-blue-700 ui-tabular">{simReading} {t('hrs/day')}</span>
                  </div>
                  <input id="sim-reading" type="range" min="0" max="12" step="0.5" value={simReading} onChange={(e) => setSimReading(parseFloat(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-700" />
                  <div className="flex justify-between text-xs text-slate-500 mt-1"><span>{t('0 hrs')}</span><span>{t('12 hrs')}</span></div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label htmlFor="sim-sleep" className="clinical-label mb-0">{t('Sleep Hours')}</label>
                    <span className="text-sm font-semibold text-blue-700 ui-tabular">{simSleep} {t('hrs/day')}</span>
                  </div>
                  <input id="sim-sleep" type="range" min="4" max="12" step="0.5" value={simSleep} onChange={(e) => setSimSleep(parseFloat(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-700" />
                  <div className="flex justify-between text-xs text-slate-500 mt-1"><span>{t('4 hrs')}</span><span>{t('12 hrs (Healthy)')}</span></div>
                </div>

                <div>
                  <label htmlFor="sim-parental" className="clinical-label">{t('Myopia in Parents')}</label>
                  <select id="sim-parental" value={simParental} onChange={(e) => setSimParental(parseInt(e.target.value, 10))} className="clinical-input">
                    <option value="0">{t('Neither Parent has Myopia (0)')}</option>
                    <option value="1">{t('One Parent has Myopia (1)')}</option>
                    <option value="2">{t('Both Parents have Myopia (2)')}</option>
                  </select>
                </div>
              </div>

              <div className="md:col-span-5 flex flex-col space-y-5">
                {(() => {
                  if (simError) return <div role="alert" className="patient-feedback"><p>{simError}</p><button type="button" onClick={() => setSimRetry((value) => value + 1)}>{t('Retry model preview')}</button></div>;
                  if (!simResult) return <p role="status" className="patient-loading"><Loader2 size={18} className="animate-spin" />{t('Requesting model prediction…')}</p>;
                  const finalScore = Number((simResult.myopia_probability * 100).toFixed(1));
                  const isHigh = simResult.risk_level === 'High';
                  const isMed = simResult.risk_level === 'Medium';
                  const circleColor = isHigh ? 'text-red-700' : isMed ? 'text-amber-600' : 'text-teal-700';

                  return (
                    <>
                      <div className="clinical-card p-6 flex flex-col items-center justify-center text-center">
                        <h4 className="font-semibold text-slate-700 text-xs mb-5">{t('Model-predicted Myopia Risk')}</h4>
                        <div className="relative mb-5">
                          <svg className="w-36 h-36 transform -rotate-90">
                            <circle cx="72" cy="72" r="64" stroke="currentColor" strokeWidth="10" className="text-slate-100 fill-none" />
                            <circle
                              cx="72" cy="72" r="64" stroke="currentColor" strokeWidth="10"
                              strokeDasharray="401.9" strokeDashoffset={401.9 - (401.9 * finalScore) / 100}
                              className={`fill-none ${circleColor} transition-[stroke-dashoffset] duration-300 ease-out`}
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-semibold text-slate-900 ui-tabular">{finalScore}%</span>
                            <span className="text-xs text-slate-500 font-medium">{t('Risk Score')}</span>
                          </div>
                        </div>
                        <span className={riskBadgeClass(simResult.risk_level)}>
                          {isHigh ? 'High Risk' : isMed ? 'Moderate Risk' : 'Low Risk'}
                        </span>
                        <p className="text-xs text-slate-600 mt-2">{t('Based on current simulated parameters')}</p>
                      </div>

                      <div className="clinical-card p-5 text-left">
                        <h4 className="font-semibold text-slate-900 text-sm mb-2">{t('Screening Guidance')}</h4>
                        <p className="text-xs text-slate-700 leading-relaxed">{simResult.recommendation}</p>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        ) : !result ? (
          <div className="max-w-xl mx-auto">
            <div className="text-center mb-6">
              <p className="screening-kicker">{t('SHRI SARVESHWAR NETRALAYA · PATIENT CARE')}</p>
              <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900">{t('Your eye-health screening')}</h2>
              <p className="text-slate-600 mt-2 text-sm">{t('Understand your screening risk and prepare for your eye examination.')}</p>
            </div>
            <ol className="screening-progress" aria-label={t('Screening progress')}>
              <li className={formStep === 1 ? 'current-step' : 'completed-step'} aria-current={formStep === 1 ? 'step' : undefined}><span>{formStep > 1 ? '✓' : '1'}</span>{t('Your details')}</li>
              <li className={formStep === 2 ? 'current-step' : ''} aria-current={formStep === 2 ? 'step' : undefined}><span>2</span>{t('Daily routine')}</li>
              <li><span>3</span>{t('Your report')}</li>
            </ol>
            <div className="clinical-card overflow-hidden border-t-4 border-t-blue-700">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-700" /> {formStep === 1 ? "Let's get to know you" : 'Tell us about your routine'}
                </h3>
                <span className="clinical-badge clinical-badge-neutral ui-tabular">{t('Step')} {formStep} {t('of 2')}</span>
              </div>
              <div className="p-6 sm:p-7">
                <form aria-busy={isSubmitting} onSubmit={formStep === 1 ? (e) => { e.preventDefault(); setFormStep(2); } : handleSubmit} className="space-y-5">
                  {submitError && <div role="alert" className="patient-feedback"><p>{submitError}</p><p>{t('Your entries are saved on this page. Use Generate Report to retry.')}</p></div>}
                  {isSubmitting && <p role="status" className="patient-loading"><Loader2 size={18} className="animate-spin" /> {t('Running your screening model. Please keep this page open…')}</p>}
                  {formStep === 1 ? (
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="patient-name" className="clinical-label">{t('Full Name')}</label>
                        <input id="patient-name" type="text" required className="clinical-input" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder={t('Enter your full name')} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="patient-age" className="clinical-label">{t('Age')}</label>
                          <input id="patient-age" type="number" required min="1" max="120" className="clinical-input ui-tabular" value={formData.age} onChange={(e) => setFormData({ ...formData, age: e.target.value })} placeholder="e.g. 24" />
                        </div>
                        <div>
                          <label htmlFor="patient-gender" className="clinical-label">{t('Gender')}</label>
                          <select id="patient-gender" className="clinical-input" value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })}>
                            <option value="Male">{t('Male')}</option>
                            <option value="Female">{t('Female')}</option>
                            <option value="Other">{t('Other')}</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label htmlFor="assigned-doctor" className="clinical-label">
                          {t('Your doctor')} <span className="text-slate-500 font-normal text-xs">{t('(required)')}</span>
                        </label>
                        <select required className="clinical-input" id="assigned-doctor" value={selectedDoctorId} disabled={doctorsLoading || !!doctorsError} onChange={(e) => setSelectedDoctorId(e.target.value)}>
                          <option value="">{t('-- Select your assigned doctor --')}</option>
                          {doctors.map((d) => (
                            <option key={d.id} value={d.id}>Dr. {d.name} ({d.email})</option>
                          ))}
                        </select>
                        {doctorsLoading && <p role="status" className="text-xs text-slate-600 mt-1.5">{t('Loading available doctors…')}</p>}
                        {doctorsError && <div role="alert" className="patient-feedback"><p>{doctorsError}</p><button type="button" onClick={fetchDoctors}>{t('Retry doctor list')}</button></div>}
                        {!doctorsLoading && !doctorsError && doctors.length === 0 && (
                          <p className="text-xs text-amber-800 mt-1.5 font-medium">{t('No doctors are available for assignment yet. Contact the hospital for help.')}</p>
                        )}
                      </div>
                      <button type="submit" className="clinical-btn-primary w-full mt-4">{t('Continue to daily routine')}</button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="screen-hours" className="clinical-label">{t('Screen Time (hrs)')}</label>
                          <input id="screen-hours" type="number" required min="0" max="24" step="0.5" className="clinical-input ui-tabular" value={formData.screenTime} onChange={(e) => setFormData({ ...formData, screenTime: e.target.value })} />
                        </div>
                        <div>
                          <label htmlFor="reading-hours" className="clinical-label">{t('Reading Time (hrs)')}</label>
                          <input id="reading-hours" type="number" required min="0" max="24" step="0.5" className="clinical-input ui-tabular" value={formData.readingTime} onChange={(e) => setFormData({ ...formData, readingTime: e.target.value })} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="work-hours" className="clinical-label">{t('Work/Study (hrs)')}</label>
                          <input id="work-hours" type="number" required min="0" max="24" step="0.5" className="clinical-input ui-tabular" value={formData.workHours} onChange={(e) => setFormData({ ...formData, workHours: e.target.value })} />
                        </div>
                        <div>
                          <label htmlFor="sleep-hours" className="clinical-label">{t('Sleep Time (hrs)')}</label>
                          <input id="sleep-hours" type="number" required min="0" max="24" step="0.5" className="clinical-input ui-tabular" value={formData.sleepHours} onChange={(e) => setFormData({ ...formData, sleepHours: e.target.value })} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="outdoor-hours" className="clinical-label">{t('Outdoor Time (hrs)')}</label>
                          <input id="outdoor-hours" type="number" required min="0" max="24" step="0.5" className="clinical-input ui-tabular" value={formData.outdoorActivity} onChange={(e) => setFormData({ ...formData, outdoorActivity: e.target.value })} />
                        </div>
                        <div>
                          <label htmlFor="parental-myopia" className="clinical-label">{t('Parental Myopia')}</label>
                          <select id="parental-myopia" className="clinical-input" value={formData.parentalMyopia} onChange={(e) => setFormData({ ...formData, parentalMyopia: e.target.value })}>
                            <option value="0">{t('0 Parents')}</option>
                            <option value="1">{t('1 Parent')}</option>
                            <option value="2">{t('2 Parents')}</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-3 pt-3">
                        <button type="button" onClick={() => setFormStep(1)} className="clinical-btn-secondary w-1/3">{t('Back')}</button>
                        <button type="submit" disabled={isSubmitting} className="clinical-btn-primary w-2/3">
                          {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('Generating...')}</> : t('Generate Report')}
                        </button>
                      </div>
                    </div>
                  )}
                </form>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-between items-end mb-4 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">{t('Your Eye-Health Screening Report')}</h2>
                <p className="text-slate-600 mt-1.5 text-sm flex items-center gap-1.5">
                  <User className="w-4 h-4 text-blue-700" /> {t('Patient:')} <strong className="text-slate-900">{result.patientName}</strong> · {result.patientAge} {t('Yrs ·')} {result.patientGender}
                </p>
                <p className="text-slate-500 text-xs mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-700" /> {t('Generated on')} {result.date}
                </p>
              </div>
            </div>
            <ScreeningSummary result={result} />
            <PatientReportDelivery key={result.screeningId} screeningId={result.screeningId} initialState={result.reportEmail} registeredEmail={profile.email} />
            {result.careGuidance && (
              <section className="clinical-card p-6 text-left space-y-4">
                <p className="text-xs text-slate-500">{t('Detailed care guidance · English')}</p>
                <h3 className="text-lg font-semibold text-slate-900">{result.careGuidance.title}</h3>
                <p className="text-sm text-slate-700">{result.careGuidance.meaning}</p>
                <p className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-sm text-slate-900">{result.careGuidance.next_step}</p>
                <h4 className="font-semibold text-slate-900 text-sm">{t('Daily precautions and healthy habits')}</h4>
                <ul className="list-disc pl-5 space-y-2 text-sm text-slate-700">{(result.careGuidance.habits || []).map((habit) => <li key={habit}>{habit}</li>)}</ul>
                <details className="rounded-lg border border-slate-200 p-4 text-sm text-slate-700">
                  <summary className="cursor-pointer font-semibold text-slate-900">{t('Doctor discussion and appointment preparation')}</summary>
                  <ul className="list-disc pl-5 mt-3 space-y-2">{[...(result.careGuidance.doctor_discussion || []), ...(result.careGuidance.appointment_checklist || [])].map((item) => <li key={item}>{item}</li>)}</ul>
                </details>
                <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900"><strong>{t('Urgent symptoms:')} </strong>{result.careGuidance.urgent_care}</p>
              </section>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 clinical-card p-6 flex flex-col items-center justify-center text-center">
                <div className="relative mb-4">
                  <svg className="w-32 h-32 transform -rotate-90">
                    <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="10" className="text-slate-100 fill-none" />
                    <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="10" strokeDasharray="351.8" strokeDashoffset={351.8 - (351.8 * result.riskScore) / 100} className={`fill-none ${result.riskScore >= 70 ? 'text-red-700' : result.riskScore >= 40 ? 'text-amber-600' : 'text-teal-700'} transition-[stroke-dashoffset] duration-500 ease-out`} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-semibold text-slate-900 ui-tabular">{result.riskScore}%</span>
                    <span className="text-xs text-slate-500 font-medium">{t('Model estimate')}</span>
                  </div>
                </div>
                <span className={riskBadgeClass(result.severity)}>{result.severity} {t('Risk')}</span>
                <p className="text-xs text-slate-600 mt-2">{result.detection}</p>
              </div>

              <div className="md:col-span-2 min-w-0 clinical-card p-6">
                <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-700" /> {t('Recorded Screening Probabilities')}
                </h3>
                <div className="h-[200px] w-full">
                  <Line data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100, grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } } }} />
                </div>
              </div>
            </div>

            {result.nextSpheq !== null && Number.isFinite(result.nextSpheq) && (
              <div className="clinical-card p-5 text-center">
                <p className="text-xs font-semibold text-slate-600 mb-1">{t('Predicted Next SPHEQ')}</p>
                <p className="text-2xl font-semibold text-blue-700 ui-tabular">{result.nextSpheq.toFixed(2)} D</p>
              </div>
            )}

            {result.recommendations.length > 0 && (
              <div className="clinical-card p-6 border-l-4 border-l-amber-600">
                <h3 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-700" /> {t('Screening Recommendations')}
                </h3>
                <ul className="space-y-2.5">
                  {result.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-slate-800">
                      <CheckCircle2 className="w-4 h-4 text-teal-700 mt-0.5 shrink-0" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </main>

      {showOnboarding && <OnboardingFlow name={profile.name === 'Loading...' ? '' : profile.name} onComplete={() => setShowOnboarding(false)} />}

      {/* Patient Care Assistant */}
      <div className="patient-chat-widget fixed bottom-6 right-6 z-50 no-print">
        {isChatOpen && (
          <div
            className="patient-chat-panel absolute bottom-16 right-0 w-[360px] bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col h-[460px]"
            role="dialog"
            aria-label={t('Vision AI Assistant')}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                setIsChatOpen(false);
              }
            }}
          >
            <div className="bg-blue-700 px-4 py-3.5 text-white flex justify-between items-center">
              <div className="flex items-center space-x-2.5">
                <MessageSquare className="w-5 h-5 shrink-0" />
                <div>
                  <span className="font-semibold text-sm block leading-tight">{t('Vision AI Assistant')}</span>
                  <span className="text-[11px] text-blue-100 block">{t('General guidance, not a diagnosis.')}</span>
                </div>
              </div>
              <button type="button" aria-label="Close assistant" onClick={() => setIsChatOpen(false)} className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded-lg transition-colors">
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 p-4 bg-slate-50 overflow-y-auto space-y-3" role="log" aria-live="polite">
              {messages.map((m, i) => (
                <div key={i} className={`p-3 rounded-xl text-sm max-w-[85%] ${m.isBot ? 'bg-white border border-slate-200 text-slate-800' : 'bg-blue-700 text-white self-end ml-auto'}`}>
                  {m.isBot ? <ChatMessageBody text={m.text} /> : m.text}
                </div>
              ))}
            </div>
            <div className="p-3 bg-white border-t border-slate-200">
              <div className="relative">
                <input
                  type="text"
                  ref={chatInputRef}
                  aria-label={t('Ask about your report...')}
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                  placeholder={t('Ask about your report...')}
                  className="clinical-input pr-11"
                />
                <button type="button" aria-label="Send message" onClick={sendChatMessage} className="absolute right-1.5 top-1.5 p-1.5 bg-blue-700 text-white rounded-md hover:bg-blue-800 transition-colors">
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">{t('General guidance, not a diagnosis.')}</p>
            </div>
          </div>
        )}
        <button
          type="button"
          aria-label={isChatOpen ? 'Close patient assistant' : t('Open patient assistant')}
          onClick={toggleChat}
          className="w-13 h-13 p-3.5 bg-blue-700 hover:bg-blue-800 rounded-full flex items-center justify-center text-white shadow-lg border border-white transition-colors"
        >
          {isChatOpen ? <ChevronDown className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}
