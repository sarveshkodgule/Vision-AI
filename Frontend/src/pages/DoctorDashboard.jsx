import { usePatientLanguage } from '../lib/patientLanguage';
import React, { createElement, useCallback, useState, useRef, useEffect } from 'react';
import {
  Users, FileText, Activity, Search, Bell, Eye, LogOut, ChevronRight,
  UploadCloud, CheckCircle2, AlertTriangle, ArrowLeft, Loader2, Info,
  UserCog, ClipboardList, Download, UserCheck, Maximize2, Printer, ShieldAlert
} from 'lucide-react';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Title, Tooltip, Legend, ArcElement, Filler
} from 'chart.js';
import { api, API_BASE_URL } from '../lib/api';
import HospitalBrand from '../components/HospitalBrand';
import PatientLanguageSwitch from '../components/PatientLanguageSwitch';
import FundusLightbox from '../components/FundusLightbox';
import { hospital } from '../lib/hospital';
import AccountDangerZone from '../components/AccountDangerZone';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  Title, Tooltip, Legend, ArcElement, Filler
);

function riskBadgeClass(level) {
  const v = String(level || '').toLowerCase();
  if (v === 'high' || v === 'needs review' || v === 'pm') return 'clinical-badge clinical-badge-high';
  if (v === 'medium' || v === 'moderate' || v === 'monitoring') return 'clinical-badge clinical-badge-medium';
  if (v === 'low' || v === 'cleared' || v === 'reviewed' || v === 'non-pm') return 'clinical-badge clinical-badge-low';
  return 'clinical-badge clinical-badge-neutral';
}

export default function DoctorDashboard() {
  const { t, language } = usePatientLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'patients';
  const setActiveTab = useCallback((tab) => {
    if (tab === activeTab && !searchParams.get('patient') && !searchParams.get('edit')) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      next.delete('patient');
      next.delete('edit');
      return next;
    }, { replace: true });
  }, [activeTab, searchParams, setSearchParams]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [assessmentComplete, setAssessmentComplete] = useState(false);
  const [toast, setToast] = useState(null);

  const [profile, setProfile] = useState({ name: 'Loading...', email: 'Loading...', role: 'doctor' });
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
  const [profileSaving, setProfileSaving] = useState(false);

  const [screeningStats, setScreeningStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState('');
  const [timeFilter, setTimeFilter] = useState('today');

  const [patients, setPatients] = useState([]);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [patientsError, setPatientsError] = useState('');

  const [clinicalData, setClinicalData] = useState({
    sphericalEq: '',
    axialLength: '',
    acd: '',
    lt: '',
    vcd: '',
    iop: '',
    age: '',
    visitYear: new Date().getFullYear(),
    readingHours: '',
    screenTime: '',
    outdoorActivity: '',
    sleepHours: '',
    parentalMyopia: '0',
    doctorVerdict: 'Low',
  });
  const [uploadedScan, setUploadedScan] = useState(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState('');
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle | uploading | ready | error
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [predictionData, setPredictionData] = useState(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [lightbox, setLightbox] = useState({ open: false, title: '', subtitle: '', src: '', alt: '' });
  const [downloadingPatientId, setDownloadingPatientId] = useState('');
  const [patientHistory, setPatientHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [signOffVerdict, setSignOffVerdict] = useState('Low');
  const [signOffNote, setSignOffNote] = useState('');
  const [signOffSaving, setSignOffSaving] = useState(false);
  const [signOffSaved, setSignOffSaved] = useState(false);
  const [signOffError, setSignOffError] = useState('');
  const fileInputRef = useRef(null);
  const selectedPatientIdRef = useRef(null);
  const historyRequestRef = useRef(0);
  const assessmentRequestRef = useRef(0);
  const uploadGenerationRef = useRef(0);
  const predictionDataIdRef = useRef(null);

  const notify = (message, tone = 'error') => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 5000);
  };

  const clearUploadedImage = () => {
    uploadGenerationRef.current += 1;
    setUploadedScan(null);
    setUploadedImageUrl('');
    setUploadedFileName('');
    setUploadStatus('idle');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const transitionPatient = (patient, syncUrl = true) => {
    selectedPatientIdRef.current = patient?.id == null ? null : String(patient.id);
    historyRequestRef.current += 1;
    assessmentRequestRef.current += 1;
    predictionDataIdRef.current = null;
    setSelectedPatient(patient);
    setIsProcessing(false);
    setAssessmentComplete(false);
    setPredictionData(null);
    clearUploadedImage();
    setPatientHistory([]);
    setHistoryLoading(false);
    setHistoryError('');
    setSignOffVerdict('Low');
    setSignOffNote('');
    setSignOffSaving(false);
    setSignOffSaved(false);
    setSignOffError('');
    if (syncUrl) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (patient?.id) {
          next.set('tab', 'patients');
          next.set('patient', String(patient.id));
        } else {
          next.delete('patient');
        }
        return next;
      });
    }
  };

  useEffect(() => {
    const paramPatientId = searchParams.get('patient');
    if (!paramPatientId && selectedPatient) {
      transitionPatient(null, false);
    } else if (paramPatientId && (!selectedPatient || String(selectedPatient.id) !== paramPatientId)) {
      const found = patients.find((p) => String(p.id) === paramPatientId);
      if (found) transitionPatient(found, false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, patients]);

  useEffect(() => {
    if (activeTab === 'screening-reports') {
      const fetchStats = async () => {
        setStatsLoading(true);
        setStatsError('');
        try {
          const res = await api.get('/doctor/screening-stats');
          if (res && res.data) setScreeningStats(res.data);
        } catch (err) {
          console.error(err);
          setStatsError('Unable to load screening statistics.');
        } finally {
          setStatsLoading(false);
        }
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
        console.error('Failed to fetch profile', err);
      }
    };
    fetchProfile();
  }, []);

  const handleProfileSave = async () => {
    setProfileSaving(true);
    try {
      const res = await api.put('/auth/profile', { name: editForm.name });
      if (res && res.data) {
        setProfile(res.data);
        setIsEditingProfile(false);
        notify('Profile details updated.', 'success');
      }
    } catch (err) {
      console.error('Update failed', err);
      notify(err.message || 'Unable to update profile details.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('Logout backend request failed:', err);
    }
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    navigate('/login', { replace: true });
  };

  const fetchPatientsList = async () => {
    setPatientsLoading(true);
    setPatientsError('');
    try {
      const res = await api.get('/doctor/patients');
      if (res && res.data) {
        const mapped = res.data.map((p) => ({
          id: p.id,
          name: p.name || 'Unknown Patient',
          age: p.age || 'N/A',
          gender: p.gender || 'N/A',
          probability: p.myopia_probability,
          riskLevel: p.risk_level || 'Low',
          status: p.review_status === 'signed_off' || p.has_report
            ? 'Reviewed'
            : p.risk_level === 'High'
            ? 'Needs Review'
            : p.risk_level === 'Medium'
            ? 'Monitoring'
            : 'Cleared',
          screen_time: p.screen_time,
          reading_time: p.reading_time,
          work_hours: p.work_hours,
          sleep_hours: p.sleep_hours,
          outdoor_activity: p.outdoor_activity,
          parental_myopia: p.parental_myopia,
          created_at: p.created_at,
          user_id: p.user_id,
          factors: {
            screen: p.screen_time,
            outdoor: p.outdoor_activity,
            family: p.parental_myopia === 2 ? '2 Parents' : p.parental_myopia === 1 ? '1 Parent' : 'None',
          },
        }));
        setPatients(mapped);
      }
    } catch (err) {
      console.error('Failed to fetch patients', err);
      setPatientsError('Unable to load assigned patients.');
    } finally {
      setPatientsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'patients' || activeTab === 'reports' || activeTab === 'analytics') {
      fetchPatientsList();
    }
  }, [activeTab]);

  const fetchPatientHistory = useCallback(async (patientId) => {
    if (!patientId) return;
    const requestId = ++historyRequestRef.current;
    const isActiveRequest = () => (
      requestId === historyRequestRef.current
      && selectedPatientIdRef.current === String(patientId)
    );
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const res = await api.get(`/doctor/patient/${patientId}/history`);
      if (isActiveRequest()) {
        setPatientHistory(Array.isArray(res?.data) ? res.data : []);
      }
    } catch (err) {
      if (isActiveRequest()) {
        console.error('Failed to fetch patient history', err);
        setHistoryError('Unable to load previous clinical assessments.');
        setPatientHistory([]);
      }
    } finally {
      if (isActiveRequest()) setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPatient) {
      fetchPatientHistory(selectedPatient.id);
      setClinicalData((prev) => ({
        ...prev,
        age: selectedPatient.age !== 'N/A' ? String(selectedPatient.age) : '',
        readingHours: selectedPatient.reading_time != null ? String(selectedPatient.reading_time) : '',
        screenTime: selectedPatient.screen_time != null ? String(selectedPatient.screen_time) : '',
        outdoorActivity: selectedPatient.outdoor_activity != null ? String(selectedPatient.outdoor_activity) : '',
        sleepHours: selectedPatient.sleep_hours != null ? String(selectedPatient.sleep_hours) : '',
        parentalMyopia: selectedPatient.parental_myopia != null ? String(selectedPatient.parental_myopia) : '0',
      }));
    } else {
      setPatientHistory([]);
      setHistoryError('');
      setClinicalData({
        sphericalEq: '',
        axialLength: '',
        acd: '',
        lt: '',
        vcd: '',
        iop: '',
        age: '',
        visitYear: new Date().getFullYear(),
        readingHours: '',
        screenTime: '',
        outdoorActivity: '',
        sleepHours: '',
        parentalMyopia: '0',
        doctorVerdict: 'Low',
      });
    }
  }, [selectedPatient, fetchPatientHistory]);

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const generation = ++uploadGenerationRef.current;
      const patientId = selectedPatientIdRef.current;
      setUploadedImageUrl('');
      setUploadedFileName(file.name);
      setUploadStatus('uploading');
      const reader = new FileReader();
      reader.onload = (event) => {
        if (generation === uploadGenerationRef.current && patientId === selectedPatientIdRef.current) {
          setUploadedScan(event.target.result);
        }
      };
      reader.readAsDataURL(file);
      e.target.value = '';

      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await api.post('/doctor/upload-image', formData, true);
        if (generation !== uploadGenerationRef.current || patientId !== selectedPatientIdRef.current) return;
        if (res && res.data?.image_url) {
          setUploadedImageUrl(res.data.image_url);
          setUploadStatus('ready');
        } else {
          setUploadStatus('error');
        }
      } catch (err) {
        if (generation !== uploadGenerationRef.current || patientId !== selectedPatientIdRef.current) return;
        console.error(err);
        setUploadedScan(null);
        setUploadStatus('error');
        notify(err.message || 'Image upload failed');
      }
    }
  };

  const numberOr = (value, fallback) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const handleRunAssessment = async (e) => {
    e.preventDefault();
    if (!uploadedImageUrl) {
      notify('Upload and verify a retinal fundus image before running the diagnostic evaluation.');
      return;
    }
    setIsProcessing(true);
    const requestId = ++assessmentRequestRef.current;
    const patientId = String(selectedPatient.id);
    const isActiveRequest = () => (
      requestId === assessmentRequestRef.current
      && selectedPatientIdRef.current === patientId
    );

    try {
      const res = await api.post('/doctor/predict', {
        patient_id: patientId,
        axial_length: numberOr(clinicalData.axialLength, undefined) ?? 24.0,
        refractive_error: numberOr(clinicalData.sphericalEq, undefined) ?? -1.0,
        acd: numberOr(clinicalData.acd, undefined) ?? undefined,
        lt: numberOr(clinicalData.lt, undefined) ?? undefined,
        vcd: numberOr(clinicalData.vcd, undefined) ?? undefined,
        age: numberOr(clinicalData.age, undefined) ?? (selectedPatient.age !== 'N/A' ? selectedPatient.age : undefined),
        visit_year: numberOr(clinicalData.visitYear, undefined) ?? new Date().getFullYear(),
        reading_hours: numberOr(clinicalData.readingHours, undefined) ?? selectedPatient.reading_time ?? undefined,
        screen_time: numberOr(clinicalData.screenTime, undefined) ?? selectedPatient.screen_time ?? undefined,
        outdoor_activity: numberOr(clinicalData.outdoorActivity, undefined) ?? selectedPatient.outdoor_activity ?? undefined,
        sleep_hours: numberOr(clinicalData.sleepHours, undefined) ?? selectedPatient.sleep_hours ?? undefined,
        parental_myopia: numberOr(clinicalData.parentalMyopia, undefined) ?? selectedPatient.parental_myopia ?? 0,
        doctor_verdict: clinicalData.doctorVerdict,
        image_url: uploadedImageUrl,
      });

      if (!isActiveRequest()) return;
      const result = res?.data?.data || res?.data || {};
      setShowOverlay(true);
      setSignOffVerdict(result.doctor_verdict || clinicalData.doctorVerdict || 'Low');
      setSignOffNote('');
      setSignOffSaved(false);
      setSignOffError('');
      predictionDataIdRef.current = result.id == null ? null : String(result.id);
      setPredictionData(result);
      setAssessmentComplete(true);
      fetchPatientHistory(patientId);
    } catch (err) {
      if (isActiveRequest()) {
        console.error('Assessment error:', err);
        notify(err.message || 'Assessment failed. Please check your inputs and try again.');
      }
    } finally {
      if (isActiveRequest()) setIsProcessing(false);
    }
  };

  const handleSaveSignOff = async () => {
    if (!predictionData?.id) {
      setSignOffError(t('Report ID is missing. Run an evaluation first.'));
      return;
    }
    const reportId = String(predictionData.id);
    setSignOffSaving(true);
    setSignOffError('');
    try {
      const res = await api.patch(`/doctor/report/${reportId}/sign-off`, {
        doctor_verdict: signOffVerdict,
        clinical_note: signOffNote.trim() || null,
      });
      if (predictionDataIdRef.current !== reportId) return;
      const updated = res?.data || {};
      setPredictionData((prev) => {
        if (!prev || String(prev.id) !== reportId) return prev;
        return {
          ...prev,
          doctor_verdict: updated.doctor_verdict || signOffVerdict,
          review_status: updated.review_status || 'signed_off',
          signed_off_at: updated.signed_off_at,
          signed_off_by_name: updated.signed_off_by_name,
          clinical_note: updated.clinical_note,
        };
      });
      setSignOffSaved(true);
      notify(t('Clinical sign-off saved.'), 'success');
      if (selectedPatientIdRef.current) fetchPatientHistory(selectedPatientIdRef.current);
      fetchPatientsList();
    } catch (err) {
      if (predictionDataIdRef.current === reportId) {
        console.error('Sign-off error:', err);
        setSignOffError(err.message || t('Unable to save clinical sign-off.'));
      }
    } finally {
      if (predictionDataIdRef.current === reportId) setSignOffSaving(false);
    }
  };

  const downloadPatientPdf = async (patientId, patientName = 'patient') => {
    setDownloadingPatientId(patientId);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/doctor/generate-report/${patientId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        notify(err.detail || 'No clinical report has been generated for this patient yet. Complete the clinical evaluation first.');
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `myopia_report_${String(patientName).replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify('Clinical PDF report downloaded.', 'success');
    } catch (err) {
      console.error('PDF download failed', err);
      notify('Network error. Failed to download report PDF.');
    } finally {
      setDownloadingPatientId('');
    }
  };

  const measuredPatients = patients.filter((p) => Number.isFinite(p.probability));
  const trendData = {
    labels: measuredPatients.map((p, i) => p.name ? `${p.name.split(' ')[0]} (#${i + 1})` : `Screening ${i + 1}`),
    datasets: [{
      label: 'Model myopia probability (%)',
      data: measuredPatients.map((p) => Number((p.probability * 100).toFixed(1))),
      borderColor: '#17365d',
      backgroundColor: 'rgba(23, 54, 93, 0.08)',
      fill: true,
      tension: 0.25,
    }],
  };
  const distributionData = {
    labels: ['Low', 'Medium', 'High'],
    datasets: [{
      data: ['Low', 'Medium', 'High'].map((level) => patients.filter((p) => p.riskLevel === level).length),
      backgroundColor: ['#267765', '#a57128', '#b45345'],
      borderWidth: 0,
    }],
  };

  const renderContent = () => {
    if (activeTab === 'profile') {
      return (
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl font-semibold text-slate-900 mb-5">{t('Doctor Profile')}</h2>
          <div className="clinical-card p-6 sm:p-8">
            <div className="flex items-center space-x-5 mb-7 pb-6 border-b border-slate-200">
              <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-800 font-semibold text-2xl uppercase">
                {profile.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-xl font-semibold text-slate-900">
                  {profile.name.startsWith('Dr.') ? profile.name : `Dr. ${profile.name}`}
                </h3>
                <p className="text-sm font-medium text-blue-700 capitalize">{t(profile.role)} {t('Account')}</p>
                <p className="text-slate-600 text-xs mt-0.5">{hospital.name}</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <span className="clinical-label text-slate-500">{t('System ID')}</span>
                <span className="text-sm text-slate-900 font-medium ui-tabular break-all">{profile.id || 'N/A'}</span>
              </div>
              <div>
                <span className="clinical-label text-slate-500">{t('Specialization')}</span>
                <span className="text-sm text-slate-900 font-medium">{t('Retinal Diagnostics & Myopia Mgmt')}</span>
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
                    <label htmlFor="doc-profile-email" className="clinical-label">{t('Email Address')}</label>
                    <input
                      id="doc-profile-email"
                      type="email"
                      value={editForm.email}
                      readOnly
                      aria-label={t('Email linked to your sign-in account')}
                      className="clinical-input bg-slate-50 text-slate-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="doc-profile-name" className="clinical-label">{t('Full Name')}</label>
                    <input
                      id="doc-profile-name"
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="clinical-input"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="mt-7 pt-5 border-t border-slate-200 flex justify-between items-center space-x-3">
              <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center text-sm font-semibold text-slate-600 hover:text-blue-700 transition-colors">
                <ArrowLeft className="w-4 h-4 mr-1.5" /> {t('Back')}
              </button>
              <div className="flex space-x-3">
              {isEditingProfile ? (
                <>
                  <button type="button" onClick={() => setIsEditingProfile(false)} className="clinical-btn-secondary">{t('Cancel')}</button>
                  <button type="button" onClick={handleProfileSave} disabled={profileSaving} className="clinical-btn-primary">
                    {profileSaving ? 'Saving...' : t('Save Details')}
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setIsEditingProfile(true)} className="clinical-btn-secondary">{t('Edit Details')}</button>
              )}
              </div>
            </div>
            <AccountDangerZone onDeleted={() => navigate('/')} />
          </div>
        </div>
      );
    }

    if (activeTab === 'screening-reports') {
      const currentStats = screeningStats?.[timeFilter] || { total: 0, High: 0, Medium: 0, Low: 0 };
      const filterLabels = {
        today: "Today's Report",
        week: 'Weekly Report',
        month: 'Monthly Report',
        all_time: 'All-Time Report',
      };

      const doughnutData = {
        labels: ['High Risk', 'Medium Risk', 'Low Risk'],
        datasets: [{
          data: [currentStats.High, currentStats.Medium, currentStats.Low],
          backgroundColor: ['#b45345', '#a57128', '#267765'],
          borderWidth: 0,
        }],
      };

      const periodComparisonData = {
        labels: ['Today', 'This Week', 'This Month', 'All Time'],
        datasets: [
          {
            label: 'Total Screenings',
            data: [
              screeningStats?.today?.total || 0,
              screeningStats?.week?.total || 0,
              screeningStats?.month?.total || 0,
              screeningStats?.all_time?.total || 0,
            ],
            backgroundColor: '#17365d',
            borderRadius: 4,
          },
          {
            label: 'High Risk',
            data: [
              screeningStats?.today?.High || 0,
              screeningStats?.week?.High || 0,
              screeningStats?.month?.High || 0,
              screeningStats?.all_time?.High || 0,
            ],
            backgroundColor: '#b45345',
            borderRadius: 4,
          },
        ],
      };

      return (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{t(filterLabels[timeFilter])}</h2>
              <p className="text-slate-600 text-sm mt-0.5">
                {t('Patient screening summary —')}{' '}
                {new Date().toLocaleDateString(language === 'mr' ? 'mr-IN' : 'en-IN', {
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                })}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 no-print">
              <div className="flex bg-slate-100 border border-slate-200 rounded-lg p-1 gap-1" role="tablist" aria-label="Timeframe filter">
                {[['today', 'Today'], ['week', 'Weekly'], ['month', 'Monthly'], ['all_time', 'All Time']].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={timeFilter === key}
                    onClick={() => setTimeFilter(key)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${timeFilter === key ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    {t(label)}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => window.print()} className="clinical-btn-primary">
                <Printer className="w-4 h-4" /> Print Summary
              </button>
            </div>
          </div>

          {statsError && (
            <div role="alert" className="clinical-card p-4 border-red-200 bg-red-50 text-red-800 text-sm">
              {statsError}
            </div>
          )}

          {statsLoading && !screeningStats ? (
            <div className="clinical-card p-6 text-sm text-slate-600 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading screening statistics...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                  { label: 'Total Screened', value: currentStats.total, accent: 'border-t-blue-700', text: 'text-slate-900' },
                  { label: 'High Risk', value: currentStats.High, accent: 'border-t-red-700', text: 'text-red-800' },
                  { label: 'Medium Risk', value: currentStats.Medium, accent: 'border-t-amber-600', text: 'text-amber-800' },
                  { label: 'Low Risk', value: currentStats.Low, accent: 'border-t-teal-700', text: 'text-teal-800' },
                ].map((card) => (
                  <div key={card.label} className={`clinical-card border-t-4 ${card.accent} p-5`}>
                    <p className="text-xs font-semibold text-slate-600 mb-2">{t(card.label)}</p>
                    <p className={`text-3xl font-semibold ui-tabular ${card.text}`}>
                      {screeningStats ? card.value : '—'}
                    </p>
                  </div>
                ))}
                <div className="clinical-card border-t-4 border-t-slate-700 p-5">
                  <p className="text-xs font-semibold text-slate-600 mb-2">{t('AI vs Doctor Agreement')}</p>
                  <p className="text-3xl font-semibold ui-tabular text-slate-900">
                    {screeningStats ? `${screeningStats.validation_accuracy || 0}%` : '—'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{t('Validated vs Doctor')}</p>
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                <div className="clinical-card p-6">
                  <h3 className="text-base font-semibold text-slate-900 mb-4">{t('Risk Distribution')}</h3>
                  {screeningStats && currentStats.total > 0 ? (
                    <div className="h-[220px] flex items-center justify-center">
                      <Doughnut
                        data={doughnutData}
                        options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, cutout: '65%' }}
                      />
                    </div>
                  ) : (
                    <div className="h-[220px] flex items-center justify-center text-slate-500 text-sm">
                      {t('No data for this period')}
                    </div>
                  )}
                </div>
                <div className="clinical-card p-6">
                  <h3 className="text-base font-semibold text-slate-900 mb-1">Period Comparison</h3>
                  <p className="text-xs text-slate-500 mb-4">Database counts across recorded timeframes</p>
                  <div className="h-[220px]">
                    <Bar
                      data={periodComparisonData}
                      options={{
                        maintainAspectRatio: false,
                        plugins: { legend: { position: 'bottom' } },
                        scales: {
                          y: { min: 0, ticks: { stepSize: 1 }, grid: { color: '#f1f5f9' } },
                          x: { grid: { display: false } },
                        },
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="clinical-card overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                  <h3 className="font-semibold text-slate-900 text-sm">{t('Summary — All Timeframes')}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-600 border-b border-slate-200 bg-slate-50/60">
                        <th className="px-6 py-3 text-left font-semibold">{t('Period')}</th>
                        <th className="px-6 py-3 text-right font-semibold">{t('Total')}</th>
                        <th className="px-6 py-3 text-right font-semibold text-red-800">{t('High')}</th>
                        <th className="px-6 py-3 text-right font-semibold text-amber-800">{t('Medium')}</th>
                        <th className="px-6 py-3 text-right font-semibold text-teal-800">{t('Low')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[['Today', 'today'], ['This Week', 'week'], ['This Month', 'month'], ['All Time', 'all_time']].map(([label, key]) => {
                        const s = screeningStats?.[key] || { total: 0, High: 0, Medium: 0, Low: 0 };
                        return (
                          <tr key={key} className={`border-b border-slate-100 ${timeFilter === key ? 'bg-blue-50/40' : 'hover:bg-slate-50'} transition-colors`}>
                            <td className="px-6 py-3.5 font-semibold text-slate-800">{t(label)}</td>
                            <td className="px-6 py-3.5 text-right font-semibold text-slate-900 ui-tabular">{screeningStats ? s.total : '—'}</td>
                            <td className="px-6 py-3.5 text-right font-semibold text-red-800 ui-tabular">{screeningStats ? s.High : '—'}</td>
                            <td className="px-6 py-3.5 text-right font-semibold text-amber-800 ui-tabular">{screeningStats ? s.Medium : '—'}</td>
                            <td className="px-6 py-3.5 text-right font-semibold text-teal-800 ui-tabular">{screeningStats ? s.Low : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      );
    }

    if (activeTab === 'reports') {
      return (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{t('Generated Clinical Reports')}</h2>
              <p className="text-sm text-slate-600 mt-0.5">
                Download clinical PDF reports for evaluated patients or open a patient record to run an evaluation.
              </p>
            </div>
          </div>

          {patientsLoading ? (
            <div className="clinical-card p-6 text-sm text-slate-600 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading assigned patient records...
            </div>
          ) : patients.length === 0 ? (
            <div className="clinical-card p-12 text-center">
              <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-800 mb-1">{t('No Reports Generated Yet')}</h3>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                {t('Run diagnostic evaluations on patients to automatically generate downloadable PDF reports.')}
              </p>
            </div>
          ) : (
            <div className="clinical-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-600 bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3.5 font-semibold">Patient</th>
                      <th className="px-6 py-3.5 font-semibold">Screening Date</th>
                      <th className="px-6 py-3.5 font-semibold">Lifestyle Risk</th>
                      <th className="px-6 py-3.5 font-semibold text-right">Clinical Report</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patients.map((p) => (
                      <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-900">{p.name}</div>
                          <div className="text-xs text-slate-500 ui-tabular">{p.id}</div>
                        </td>
                        <td className="px-6 py-4 text-slate-600 text-xs ui-tabular">
                          {p.created_at ? new Date(p.created_at).toLocaleDateString() : 'Unavailable'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={riskBadgeClass(p.riskLevel)}>{p.riskLevel}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => transitionPatient(p)}
                              className="clinical-btn-secondary px-3 py-1.5 min-h-[36px] text-xs"
                            >
                              Open Record
                            </button>
                            <button
                              type="button"
                              disabled={downloadingPatientId === p.id}
                              onClick={() => downloadPatientPdf(p.id, p.name)}
                              className="clinical-btn-primary px-3 py-1.5 min-h-[36px] text-xs"
                            >
                              <Download className="w-3.5 h-3.5" />
                              {downloadingPatientId === p.id ? 'Preparing...' : 'Download PDF'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (activeTab === 'analytics') {
      return (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{t('Clinic Analytics Overview')}</h2>
            <p className="text-sm text-slate-600 mt-0.5">Distribution and recorded model probabilities for your assigned patients.</p>
          </div>
          {patients.length === 0 ? (
            <div className="clinical-card p-10 text-center text-sm text-slate-600">
              No assigned patient records available for analytics yet.
            </div>
          ) : (
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="clinical-card p-6">
                <h3 className="text-base font-semibold text-slate-900 mb-4">{t('Recorded model probabilities')}</h3>
                <div className="h-[250px]">
                  <Line
                    data={trendData}
                    options={{
                      maintainAspectRatio: false,
                      scales: { y: { min: 0, max: 100, grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } },
                    }}
                  />
                </div>
              </div>
              <div className="clinical-card p-6">
                <h3 className="text-base font-semibold text-slate-900 mb-4">{t('Risk Distribution')}</h3>
                <div className="h-[250px]">
                  <Doughnut
                    data={distributionData}
                    options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, cutout: '62%' }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (activeTab === 'patients' && selectedPatient) {
      return (
        <div className="space-y-6">
          <button
            type="button"
            onClick={() => transitionPatient(null)}
            className="inline-flex items-center text-sm font-semibold text-slate-600 hover:text-blue-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> {t('Back to Directory')}
          </button>

          {/* Persistent Clinical Patient Banner */}
          <section className="clinical-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-l-4 border-l-blue-700" aria-label="Selected patient summary">
            <div className="flex items-start sm:items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-300 text-slate-800 flex items-center justify-center text-lg font-semibold shrink-0">
                {selectedPatient.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-lg font-semibold text-slate-900">{selectedPatient.name}</h2>
                  <span className={riskBadgeClass(selectedPatient.riskLevel)}>
                    {t('Prior Risk:')} {t(selectedPatient.riskLevel)}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 ui-tabular">
                  Record ID: <span className="font-mono text-slate-800">{selectedPatient.id}</span>
                  {' · '}Age: {selectedPatient.age} {t('yrs')}
                  {' · '}Gender: {selectedPatient.gender}
                  {selectedPatient.created_at && ` · Screened: ${new Date(selectedPatient.created_at).toLocaleDateString()}`}
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={downloadingPatientId === selectedPatient.id}
              onClick={() => downloadPatientPdf(selectedPatient.id, selectedPatient.name)}
              className="clinical-btn-secondary shrink-0"
            >
              <Download className="w-4 h-4" />
              {downloadingPatientId === selectedPatient.id ? 'Preparing PDF...' : t('Download Report (PDF)')}
            </button>
          </section>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Column: Patient Reported Lifestyle */}
            <div className="lg:col-span-1 space-y-6">
              <div className="clinical-card p-5">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center mb-4 pb-3 border-b border-slate-200">
                  <FileText className="w-4 h-4 mr-2 text-blue-700" /> {t('Patient Reported Lifestyle')}
                </h3>
                <ul className="space-y-2.5 text-sm">
                  {selectedPatient.age !== 'N/A' && <li className="flex justify-between"><span className="text-slate-600">{t('Age:')}</span> <span className="font-semibold text-slate-900 ui-tabular">{selectedPatient.age} {t('yrs')}</span></li>}
                  {selectedPatient.gender !== 'N/A' && <li className="flex justify-between"><span className="text-slate-600">{t('Gender:')}</span> <span className="font-semibold text-slate-900">{selectedPatient.gender}</span></li>}
                  {selectedPatient.screen_time != null && <li className="flex justify-between"><span className="text-slate-600">{t('Screen Time:')}</span> <span className="font-semibold text-slate-900 ui-tabular">{selectedPatient.screen_time} {t('hrs/day')}</span></li>}
                  {selectedPatient.reading_time != null && <li className="flex justify-between"><span className="text-slate-600">{t('Reading Time:')}</span> <span className="font-semibold text-slate-900 ui-tabular">{selectedPatient.reading_time} {t('hrs/day')}</span></li>}
                  {selectedPatient.work_hours != null && <li className="flex justify-between"><span className="text-slate-600">{t('Work/Study:')}</span> <span className="font-semibold text-slate-900 ui-tabular">{selectedPatient.work_hours} {t('hrs/day')}</span></li>}
                  {selectedPatient.sleep_hours != null && <li className="flex justify-between"><span className="text-slate-600">{t('Sleep:')}</span> <span className="font-semibold text-slate-900 ui-tabular">{selectedPatient.sleep_hours} {t('hrs/day')}</span></li>}
                  {selectedPatient.outdoor_activity != null && <li className="flex justify-between"><span className="text-slate-600">{t('Outdoor Time:')}</span> <span className="font-semibold text-slate-900 ui-tabular">{selectedPatient.outdoor_activity} {t('hrs/day')}</span></li>}
                  {selectedPatient.parental_myopia != null && (
                    <li className="flex justify-between">
                      <span className="text-slate-600">{t('Parental Myopia:')}</span>
                      <span className="font-semibold text-slate-900">
                        {selectedPatient.parental_myopia === 0 ? 'None' : selectedPatient.parental_myopia === 1 ? t('1 Parent') : t('2 Parents')}
                      </span>
                    </li>
                  )}
                  {selectedPatient.created_at && (
                    <li className="flex justify-between pt-2.5 border-t border-slate-200 text-xs">
                      <span className="text-slate-500">{t('Submitted:')}</span>
                      <span className="font-medium text-slate-700 ui-tabular">{new Date(selectedPatient.created_at).toLocaleDateString()}</span>
                    </li>
                  )}
                </ul>
              </div>

              {/* Previous Clinical Assessments */}
              <div className="clinical-card p-5">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center justify-between mb-3 pb-2.5 border-b border-slate-200">
                  <span className="flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-blue-700" />
                    {t('Clinical Assessment History')}
                  </span>
                  <span className="text-xs text-slate-500 ui-tabular">{patientHistory.length}</span>
                </h3>
                {historyLoading ? (
                  <p className="text-xs text-slate-500 flex items-center gap-2 py-3">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('Loading assessment history...')}
                  </p>
                ) : historyError ? (
                  <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg p-3 space-y-1.5">
                    <p>{historyError}</p>
                    <button type="button" onClick={() => fetchPatientHistory(selectedPatient.id)} className="underline font-semibold">
                      {t('Retry')}
                    </button>
                  </div>
                ) : patientHistory.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">
                    {t('No previous clinical assessments recorded for this patient.')}
                  </p>
                ) : (
                  <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                    {patientHistory.length >= 2 && (
                      <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-xs space-y-1.5">
                        <p className="font-semibold text-slate-900">{t('Previous vs. Current Comparison')}</p>
                        <div className="grid grid-cols-2 gap-2 ui-tabular text-slate-700">
                          <div>
                            <span className="text-slate-500 block">{t('Previous')}</span>
                            <strong>{patientHistory[1].spheq != null ? `${patientHistory[1].spheq} D` : '—'}</strong>
                            {' · '}
                            <span>{patientHistory[1].axial_length != null ? `${patientHistory[1].axial_length} mm` : '—'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">{t('Latest')}</span>
                            <strong>{patientHistory[0].spheq != null ? `${patientHistory[0].spheq} D` : '—'}</strong>
                            {' · '}
                            <span>{patientHistory[0].axial_length != null ? `${patientHistory[0].axial_length} mm` : '—'}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    {patientHistory.map((item) => (
                      <div key={item.id} className="clinical-card-muted p-3 text-xs space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-500 ui-tabular">
                            {item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'}
                          </span>
                          <span className={riskBadgeClass(item.severity)}>{item.severity || '—'}</span>
                        </div>
                        <p className="font-semibold text-slate-900">{item.prediction || t('Clinical evaluation')}</p>
                        <div className="text-slate-600 flex flex-wrap gap-x-3 gap-y-1 ui-tabular">
                          {item.spheq != null && <span>SPHEQ: <strong className="text-slate-900">{item.spheq} D</strong></span>}
                          {item.axial_length != null && <span>AL: <strong className="text-slate-900">{item.axial_length} mm</strong></span>}
                          {item.acd != null && <span>ACD: <strong className="text-slate-900">{item.acd} mm</strong></span>}
                          {item.lt != null && <span>LT: <strong className="text-slate-900">{item.lt} mm</strong></span>}
                          {item.vcd != null && <span>VCD: <strong className="text-slate-900">{item.vcd} mm</strong></span>}
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/80 text-slate-700">
                          <span>{t('Doctor Verdict:')} <strong>{item.doctor_verdict || '—'}</strong></span>
                          <span className="text-[11px] font-semibold text-slate-600">
                            {item.review_status === 'signed_off' ? t('Signed off') : t('Preliminary')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Clinical Inputs & Assessment */}
            <div className="lg:col-span-2 space-y-6">
              {!assessmentComplete ? (
                <div className="clinical-card p-6">
                  <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-200">
                    <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                      <Eye className="w-5 h-5 mr-2 text-blue-700" /> {t('Diagnostic Form')}
                    </h3>
                    <span className="text-xs text-slate-500">Clinical biometry + retinal fundus scan</span>
                  </div>

                  <form onSubmit={handleRunAssessment} className="space-y-6">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 mb-3">{t('Clinical Optical Biometry')}</h4>
                      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                          <label htmlFor="bio-spheq" className="clinical-label flex items-center gap-1">
                            SPHEQ (D)
                            <span title="Spherical Equivalent refraction in Diopters">
                              <Info className="w-3.5 h-3.5 text-slate-400" aria-label="Spherical Equivalent refraction in Diopters" />
                            </span>
                          </label>
                          <input
                            id="bio-spheq"
                            type="number"
                            step="0.25"
                            min="-25"
                            max="15"
                            placeholder="-2.50"
                            required
                            className="clinical-input ui-tabular"
                            value={clinicalData.sphericalEq}
                            onChange={(e) => setClinicalData({ ...clinicalData, sphericalEq: e.target.value })}
                          />
                        </div>
                        <div>
                          <label htmlFor="bio-al" className="clinical-label flex items-center gap-1">
                            {t('Axial Length')} (mm)
                            <span title="Ocular axial length in millimeters">
                              <Info className="w-3.5 h-3.5 text-slate-400" aria-label="Ocular axial length in millimeters" />
                            </span>
                          </label>
                          <input
                            id="bio-al"
                            type="number"
                            step="0.01"
                            min="15"
                            max="40"
                            placeholder="24.50"
                            required
                            className="clinical-input ui-tabular"
                            value={clinicalData.axialLength}
                            onChange={(e) => setClinicalData({ ...clinicalData, axialLength: e.target.value })}
                          />
                        </div>
                        <div>
                          <label htmlFor="bio-acd" className="clinical-label flex items-center gap-1">
                            {t('Ant. Chamber (ACD)')} (mm)
                            <span title="Anterior Chamber Depth: distance from corneal endothelium to anterior lens surface in millimeters (mm)">
                              <Info className="w-3.5 h-3.5 text-slate-400" aria-label="Anterior Chamber Depth in millimeters" />
                            </span>
                          </label>
                          <input
                            id="bio-acd"
                            type="number"
                            step="0.01"
                            min="1"
                            max="6"
                            placeholder="3.50"
                            className="clinical-input ui-tabular"
                            value={clinicalData.acd}
                            onChange={(e) => setClinicalData({ ...clinicalData, acd: e.target.value })}
                          />
                        </div>
                        <div>
                          <label htmlFor="bio-lt" className="clinical-label flex items-center gap-1">
                            {t('Lens Thickness (LT)')} (mm)
                            <span title="Crystalline Lens Thickness: axial thickness of the eye's natural lens in millimeters (mm)">
                              <Info className="w-3.5 h-3.5 text-slate-400" aria-label="Crystalline Lens Thickness in millimeters" />
                            </span>
                          </label>
                          <input
                            id="bio-lt"
                            type="number"
                            step="0.01"
                            min="2"
                            max="7"
                            placeholder="4.00"
                            className="clinical-input ui-tabular"
                            value={clinicalData.lt}
                            onChange={(e) => setClinicalData({ ...clinicalData, lt: e.target.value })}
                          />
                        </div>
                        <div>
                          <label htmlFor="bio-vcd" className="clinical-label flex items-center gap-1">
                            {t('Vitreous Chamber')} (mm)
                            <span title="Vitreous Chamber Depth: distance from posterior lens surface to retina in millimeters (mm)">
                              <Info className="w-3.5 h-3.5 text-slate-400" aria-label="Vitreous Chamber Depth in millimeters" />
                            </span>
                          </label>
                          <input
                            id="bio-vcd"
                            type="number"
                            step="0.01"
                            min="10"
                            max="30"
                            placeholder="16.50"
                            className="clinical-input ui-tabular"
                            value={clinicalData.vcd}
                            onChange={(e) => setClinicalData({ ...clinicalData, vcd: e.target.value })}
                          />
                        </div>
                        <div>
                          <label htmlFor="bio-iop" className="clinical-label flex items-center gap-1">
                            IOP (mmHg) <span className="font-normal text-slate-500">(optional)</span>
                            <span title="Intraocular Pressure in millimeters of mercury (mmHg). Recorded as an optional clinical observation; not sent to the biometry ML model.">
                              <Info className="w-3.5 h-3.5 text-slate-400" aria-label="Intraocular Pressure in mmHg, optional clinical observation" />
                            </span>
                          </label>
                          <input
                            id="bio-iop"
                            type="number"
                            step="0.1"
                            placeholder="15.0"
                            className="clinical-input ui-tabular"
                            value={clinicalData.iop}
                            onChange={(e) => setClinicalData({ ...clinicalData, iop: e.target.value })}
                          />
                          <p className="text-xs text-slate-500 mt-1">Optional clinical observation; not used by ML API</p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-200">
                      <h4 className="text-sm font-semibold text-slate-900 mb-3">{t('Lifestyle Analytics Matrix')}</h4>
                      <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <label htmlFor="cli-age" className="clinical-label">{t('Patient Age')}</label>
                          <input id="cli-age" type="number" min="1" max="120" placeholder="24" className="clinical-input ui-tabular" value={clinicalData.age} onChange={(e) => setClinicalData({ ...clinicalData, age: e.target.value })} />
                        </div>
                        <div>
                          <label htmlFor="cli-read" className="clinical-label">{t('Reading (h/d)')}</label>
                          <input id="cli-read" type="number" step="0.5" min="0" max="24" placeholder="4.5" className="clinical-input ui-tabular" value={clinicalData.readingHours} onChange={(e) => setClinicalData({ ...clinicalData, readingHours: e.target.value })} />
                        </div>
                        <div>
                          <label htmlFor="cli-screen" className="clinical-label">{t('Screen (h/d)')}</label>
                          <input id="cli-screen" type="number" step="0.5" min="0" max="24" placeholder="6.0" className="clinical-input ui-tabular" value={clinicalData.screenTime} onChange={(e) => setClinicalData({ ...clinicalData, screenTime: e.target.value })} />
                        </div>
                        <div>
                          <label htmlFor="cli-outdoor" className="clinical-label">{t('Outdoor (h/d)')}</label>
                          <input id="cli-outdoor" type="number" step="0.5" min="0" max="24" placeholder="1.5" className="clinical-input ui-tabular" value={clinicalData.outdoorActivity} onChange={(e) => setClinicalData({ ...clinicalData, outdoorActivity: e.target.value })} />
                        </div>
                        <div>
                          <label htmlFor="cli-sleep" className="clinical-label">{t('Sleep (h/d)')}</label>
                          <input id="cli-sleep" type="number" step="0.5" min="0" max="24" placeholder="7.0" className="clinical-input ui-tabular" value={clinicalData.sleepHours} onChange={(e) => setClinicalData({ ...clinicalData, sleepHours: e.target.value })} />
                        </div>
                        <div className="md:col-span-2">
                          <label htmlFor="cli-parental" className="clinical-label">{t('Parental History')}</label>
                          <select id="cli-parental" className="clinical-input" value={clinicalData.parentalMyopia} onChange={(e) => setClinicalData({ ...clinicalData, parentalMyopia: e.target.value })}>
                            <option value="0">{t('0 Myopic Parents')}</option>
                            <option value="1">{t('1 Myopic Parent')}</option>
                            <option value="2">{t('2 Myopic Parents')}</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor="cli-year" className="clinical-label">{t('Visit Year')}</label>
                          <input id="cli-year" type="number" min="1990" max="2100" className="clinical-input ui-tabular" value={clinicalData.visitYear} onChange={(e) => setClinicalData({ ...clinicalData, visitYear: e.target.value })} />
                        </div>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-5 pt-4 border-t border-slate-200 items-start">
                      <div>
                        <label className="clinical-label">{t('Fundus Scan Upload')} <span className="text-red-700">*</span></label>
                        <div
                          className={`border-2 border-dashed rounded-xl p-4 min-h-[150px] flex flex-col justify-center items-center text-center transition-colors cursor-pointer ${uploadedScan ? 'border-blue-700 bg-slate-50' : 'border-slate-300 hover:border-blue-700 bg-slate-50'}`}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {uploadedScan ? (
                            <div className="w-full space-y-2.5">
                              <div className="bg-slate-950 rounded-lg overflow-hidden border border-slate-200 flex items-center justify-center h-36">
                                <img src={uploadedScan} alt="Uploaded retinal fundus preview" className="max-h-36 object-contain" />
                              </div>
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <span className="font-medium text-slate-700 truncate">
                                  {uploadStatus === 'uploading' ? 'Verifying image quality...' : uploadStatus === 'ready' ? `${uploadedFileName || 'Fundus scan'} · Verified` : 'Upload failed'}
                                </span>
                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setLightbox({
                                        open: true,
                                        title: 'Uploaded Fundus Scan',
                                        subtitle: uploadedFileName || selectedPatient.name,
                                        src: uploadedScan,
                                        alt: 'Uploaded retinal fundus scan',
                                      });
                                    }}
                                    className="text-blue-700 font-semibold hover:underline inline-flex items-center gap-1"
                                  >
                                    <Maximize2 className="w-3.5 h-3.5" /> Inspect
                                  </button>
                                  <span className="text-slate-300">|</span>
                                  <span className="text-blue-700 font-semibold hover:underline">{t('Replace')}</span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center pointer-events-none py-3">
                              <UploadCloud className="w-7 h-7 text-slate-400 mb-2" />
                              <p className="text-xs font-semibold text-slate-700">{t('Upload Fundus Image')}</p>
                              <p className="text-xs text-slate-500 mt-1">JPEG or PNG, minimum 100×100 px (max 10 MB)</p>
                            </div>
                          )}
                          <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept="image/jpeg,image/png" />
                        </div>
                      </div>

                      <div className="clinical-card-muted p-4 space-y-2">
                        <label htmlFor="doctor-verdict" className="clinical-label flex items-center gap-1.5 text-slate-900">
                          <UserCheck className="w-4 h-4 text-blue-700" /> Preliminary Clinical Assessment
                        </label>
                        <select
                          id="doctor-verdict"
                          className="clinical-input font-semibold"
                          value={clinicalData.doctorVerdict}
                          onChange={(e) => setClinicalData({ ...clinicalData, doctorVerdict: e.target.value })}
                        >
                          <option value="Low">{t('Low Risk (Normal)')}</option>
                          <option value="Medium">{t('Medium Risk')}</option>
                          <option value="High">{t('High Risk (Urgent)')}</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-200">
                      <button
                        type="submit"
                        disabled={isProcessing || uploadStatus === 'uploading'}
                        className="clinical-btn-primary"
                      >
                        {isProcessing ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> {t('Processing Diagnostic Analysis...')}</>
                        ) : (
                          t('Synthesize Factors & Evaluate')
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Clinical Decision Support Output vs Doctor Assessment */}
                  <div className="clinical-card p-6 border-t-4 border-t-blue-700">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
                      <div>
                        <p className="text-xs font-semibold text-blue-700 mb-1">Clinical Decision Support Output</p>
                        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-teal-700" /> {t('Model Evaluation Complete')}
                        </h3>
                        <p className="text-slate-600 text-xs mt-1">
                          {t('Clinical XGBoost prediction and optional fundus image classification.')}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="clinical-card-muted px-4 py-2.5 text-center">
                          <span className="block text-xs text-slate-600">{t('Myopia probability')}</span>
                          <span className="text-lg font-semibold text-slate-900 ui-tabular">
                            {predictionData?.confidence != null ? `${(predictionData.confidence * 100).toFixed(1)}%` : 'Unavailable'}
                          </span>
                        </div>
                        <div className="clinical-card-muted px-4 py-2.5 text-center">
                          <span className="block text-xs text-slate-600">{t('Severity Risk')}</span>
                          <span className={riskBadgeClass(predictionData?.severity)}>
                            {predictionData?.severity ?? 'Unavailable'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
                      <div className="clinical-card-muted p-3.5">
                        <p className="text-xs text-slate-600 mb-1">{t('Clinical model result')}</p>
                        <p className="text-sm font-semibold text-slate-900">{predictionData?.prediction ?? 'Unavailable'}</p>
                      </div>
                      <div className="clinical-card-muted p-3.5">
                        <p className="text-xs text-slate-600 mb-1">{t('Predicted Next SPHEQ')}</p>
                        <p className="text-base font-semibold text-slate-900 ui-tabular">
                          {predictionData?.predicted_next_spheq != null ? `${predictionData.predicted_next_spheq.toFixed(2)} D` : 'Unavailable'}
                        </p>
                      </div>
                      <div className="clinical-card-muted p-3.5">
                        <p className="text-xs text-slate-600 mb-1">{t('Model progression category')}</p>
                        <p className="text-base font-semibold text-slate-900">{predictionData?.progression_rate ?? 'Unavailable'}</p>
                      </div>
                      <div className="clinical-card-muted p-3.5 border-blue-200 bg-blue-50/40">
                        <p className="text-xs text-slate-600 mb-1">Doctor Clinical Verdict</p>
                        <span className={riskBadgeClass(predictionData?.doctor_verdict || clinicalData.doctorVerdict)}>
                          {predictionData?.doctor_verdict || clinicalData.doctorVerdict}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* PALM EfficientNet-B0 Fundus DL Result */}
                  {predictionData?.fundus_pm_prediction && predictionData.fundus_pm_prediction !== 'No Image' && (
                    <div className={`clinical-card p-5 border-l-4 ${
                      predictionData.fundus_pm_prediction === 'PM'
                        ? 'border-l-red-700'
                        : predictionData.fundus_pm_prediction === 'Service Unavailable'
                        ? 'border-l-slate-400'
                        : 'border-l-teal-700'
                    }`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-slate-600 mb-1.5">
                            {t('Fundus DL Analysis · EfficientNet-B0 (PALM Dataset)')}
                          </p>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className={riskBadgeClass(predictionData.fundus_pm_prediction)}>
                              {predictionData.fundus_pm_prediction === 'PM'
                                ? 'Pathologic Myopia Detected'
                                : predictionData.fundus_pm_prediction === 'Service Unavailable'
                                ? 'DL Service Offline'
                                : 'Non-Pathologic'}
                            </span>
                            {predictionData.fundus_pm_prediction !== 'Service Unavailable' && (
                              <span className="text-sm text-slate-700">
                                {t('Confidence:')}{' '}
                                <strong className="ui-tabular text-slate-900">
                                  {(predictionData.fundus_pm_confidence * 100).toFixed(1)}%
                                </strong>
                              </span>
                            )}
                          </div>
                          {predictionData.fundus_review_required && (
                            <p className="mt-2.5 text-xs font-semibold text-amber-800 flex items-center gap-1.5" role="status">
                              <ShieldAlert className="w-4 h-4 shrink-0" />
                              {t('Confidence is below the review threshold. Confirm this result clinically.')}
                            </p>
                          )}
                        </div>
                        {predictionData.fundus_pm_prediction === 'Service Unavailable' && (
                          <span className="text-xs text-slate-500">{t('Start the inference service on port 8001')}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Progression Chart + Grad-CAM++ Comparison */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="clinical-card p-6">
                      <h3 className="text-base font-semibold text-slate-900 mb-4">{t('Model progression estimate')}</h3>
                      {predictionData?.current_spheq != null && predictionData?.predicted_next_spheq != null ? (
                        <div className="h-52">
                          <Line
                            data={{
                              labels: ['Current measurement', 'Predicted next visit'],
                              datasets: [{
                                label: 'SPHEQ (D)',
                                data: [predictionData.current_spheq, predictionData.predicted_next_spheq],
                                borderColor: '#17365d',
                                borderDash: [6, 4],
                                tension: 0,
                              }],
                            }}
                            options={{ maintainAspectRatio: false }}
                          />
                        </div>
                      ) : (
                        <p className="text-sm text-slate-600">{t('No progression estimate available.')}</p>
                      )}
                    </div>

                    <div className="clinical-card p-6">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <h3 className="text-base font-semibold text-slate-900">
                          {predictionData?.gradcam?.method || 'Grad-CAM++'} {t('heatmap')}
                        </h3>
                        {predictionData?.gradcam && (
                          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={showOverlay}
                              onChange={(event) => setShowOverlay(event.target.checked)}
                              className="accent-blue-700"
                            />
                            {t('Show attention overlay')}
                          </label>
                        )}
                      </div>
                      {predictionData?.gradcam ? (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <figure className="space-y-1.5">
                              <div className="relative bg-slate-950 rounded-lg overflow-hidden border border-slate-200">
                                <img src={predictionData.gradcam.model_input} alt="Preprocessed model input" className="w-full h-36 object-contain" />
                                <button
                                  type="button"
                                  onClick={() => setLightbox({
                                    open: true,
                                    title: 'Preprocessed Fundus Model Input',
                                    subtitle: selectedPatient.name,
                                    src: predictionData.gradcam.model_input,
                                    alt: 'Preprocessed model input',
                                  })}
                                  aria-label="Zoom model input image"
                                  className="absolute bottom-2 right-2 bg-white/90 text-slate-900 rounded-md p-1.5 border border-slate-300 hover:bg-white"
                                >
                                  <Maximize2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <figcaption className="text-xs text-slate-600 font-medium">{t('Model input')}</figcaption>
                            </figure>
                            <figure className="space-y-1.5">
                              <div className="relative bg-slate-950 rounded-lg overflow-hidden border border-slate-200">
                                <img
                                  src={showOverlay ? predictionData.gradcam.overlay : predictionData.gradcam.model_input}
                                  alt={showOverlay ? `${predictionData.gradcam.method} for ${predictionData.gradcam.target_label}` : 'Model input with attention overlay hidden'}
                                  className="w-full h-36 object-contain"
                                />
                                <button
                                  type="button"
                                  onClick={() => setLightbox({
                                    open: true,
                                    title: showOverlay ? `${predictionData.gradcam.method} Attribution` : 'Model Input (Overlay Hidden)',
                                    subtitle: `Target class: ${predictionData.gradcam.target_label}`,
                                    src: showOverlay ? predictionData.gradcam.overlay : predictionData.gradcam.model_input,
                                    alt: showOverlay ? `${predictionData.gradcam.method} attribution` : 'Model input',
                                  })}
                                  aria-label="Zoom Grad-CAM image"
                                  className="absolute bottom-2 right-2 bg-white/90 text-slate-900 rounded-md p-1.5 border border-slate-300 hover:bg-white"
                                >
                                  <Maximize2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <figcaption className="text-xs text-slate-600 font-medium">
                                {showOverlay ? `${predictionData.gradcam.method} attribution` : 'Overlay hidden'}
                              </figcaption>
                            </figure>
                          </div>
                          {!predictionData.gradcam.has_positive_attribution && (
                            <p className="text-xs text-slate-600 mt-2">{t('No positive attribution at this layer.')}</p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-slate-600">{t('Upload a fundus image to generate a model explanation.')}</p>
                      )}
                    </div>
                  </div>

                  {/* Clinical Review & Sign-Off */}
                  <div className="clinical-card p-5 border-l-4 border-l-blue-700 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                          <UserCheck className="w-4 h-4 text-blue-700" /> {t('Clinician Review & Sign-Off')}
                        </h3>
                      </div>
                      <span className={predictionData?.review_status === 'signed_off' || signOffSaved ? 'clinical-badge clinical-badge-low' : 'clinical-badge clinical-badge-medium'}>
                        {predictionData?.review_status === 'signed_off' || signOffSaved ? t('Signed off') : t('Pending sign-off')}
                      </span>
                    </div>

                    {signOffError && (
                      <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
                        {signOffError}
                      </div>
                    )}

                    <div className="grid sm:grid-cols-3 gap-4 items-end">
                      <div>
                        <label htmlFor="final-signoff-verdict" className="clinical-label">{t('Final Doctor Verdict')}</label>
                        <select
                          id="final-signoff-verdict"
                          className="clinical-input font-semibold"
                          value={signOffVerdict}
                          onChange={(e) => { setSignOffVerdict(e.target.value); setSignOffSaved(false); }}
                        >
                          <option value="Low">{t('Low Risk (Normal)')}</option>
                          <option value="Medium">{t('Medium Risk')}</option>
                          <option value="High">{t('High Risk (Urgent)')}</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor="final-signoff-note" className="clinical-label">{t('Clinical Note (optional)')}</label>
                        <input
                          id="final-signoff-note"
                          type="text"
                          maxLength={1000}
                          placeholder={t('Optional clinical notes or follow-up plan')}
                          className="clinical-input"
                          value={signOffNote}
                          onChange={(e) => { setSignOffNote(e.target.value); setSignOffSaved(false); }}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                      <span className="text-xs text-slate-600">
                        {predictionData?.signed_off_at
                          ? `${t('Signed off on')} ${new Date(predictionData.signed_off_at).toLocaleString()}`
                          : t('Not yet signed off in database')}
                      </span>
                      <button
                        type="button"
                        disabled={signOffSaving}
                        onClick={handleSaveSignOff}
                        className="clinical-btn-primary"
                      >
                        {signOffSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('Saving...')}</> : t('Save Clinical Sign-Off')}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setAssessmentComplete(false);
                        predictionDataIdRef.current = null;
                        setPredictionData(null);
                        setSignOffSaving(false);
                        setSignOffSaved(false);
                        setSignOffError('');
                        clearUploadedImage();
                      }}
                      className="clinical-btn-secondary"
                    >
                      {t('New Assessment')}
                    </button>
                    <button
                      type="button"
                      disabled={downloadingPatientId === selectedPatient.id}
                      onClick={() => downloadPatientPdf(selectedPatient.id, selectedPatient.name)}
                      className="clinical-btn-secondary"
                    >
                      <FileText className="w-4 h-4" />
                      {downloadingPatientId === selectedPatient.id ? t('Preparing PDF...') : t('Download PDF Report')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAssessmentComplete(false);
                        predictionDataIdRef.current = null;
                        setPredictionData(null);
                        setSignOffSaving(false);
                        setSignOffSaved(false);
                        setSignOffError('');
                        clearUploadedImage();
                        setActiveTab('patients');
                      }}
                      className="clinical-btn-primary"
                    >
                      {t('Done - Assessment Saved')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    const filteredPatients = patients.filter((p) =>
      `${p.name} ${p.id}`.toLowerCase().includes(patientSearch.trim().toLowerCase())
    );

    return (
      <div className="clinical-card overflow-hidden">
        {patientsError && (
          <div role="alert" className="p-4 bg-red-50 border-b border-red-200 text-sm text-red-800 flex items-center justify-between">
            <span>{patientsError}</span>
            <button type="button" onClick={fetchPatientsList} className="underline font-semibold">Retry</button>
          </div>
        )}
        <div className="p-4 border-b border-slate-200 flex flex-wrap justify-between items-center gap-3 bg-slate-50">
          <div className="relative w-full max-w-sm">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="search"
              aria-label={t('Search patients')}
              value={patientSearch}
              onChange={(event) => setPatientSearch(event.target.value)}
              placeholder={t('Search ID or patient name')}
              className="clinical-input pl-10"
            />
          </div>
          <span className="text-xs text-slate-600 ui-tabular">
            {patientsLoading ? t('Loading records...') : `${filteredPatients.length} assigned patient(s)`}
          </span>
        </div>
        <div className="patient-table-scroll">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-600 bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5 font-semibold">{t('Patient Details')}</th>
                <th className="px-6 py-3.5 font-semibold">{t('Historical Risk')}</th>
                <th className="px-6 py-3.5 font-semibold">{t('Registered On')}</th>
                <th className="px-6 py-3.5 font-semibold">{t('Action Needed')}</th>
                <th className="px-6 py-3.5 font-semibold text-right">{t('Perform Eval')}</th>
              </tr>
            </thead>
            <tbody>
              {!patientsLoading && filteredPatients.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <div className="registry-empty">
                      <Users size={32} strokeWidth={1.4} />
                      <h3>{patients.length ? t('No matching patients') : t('Your patient registry starts here')}</h3>
                      <p>{patients.length ? t('Try another name or screening ID.') : t('Patients assigned to you will appear here after their screening.')}</p>
                      {patientSearch && <button type="button" onClick={() => setPatientSearch('')}>{t('Clear search')}</button>}
                    </div>
                  </td>
                </tr>
              )}
              {filteredPatients.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => transitionPatient(p)}
                  className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer group"
                >
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-900">{p.name}</div>
                    <div className="text-slate-500 text-xs font-mono">{p.id}</div>
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-800 ui-tabular">
                    {Number.isFinite(p.probability) ? `${(p.probability * 100).toFixed(1)}%` : 'Unavailable'}
                  </td>
                  <td className="px-6 py-4 text-slate-600 text-xs ui-tabular">
                    {p.created_at
                      ? new Date(p.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                      : 'Unavailable'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={riskBadgeClass(p.status)}>{p.status}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      className="clinical-btn-secondary px-3 py-1.5 min-h-[36px] text-xs group-hover:bg-blue-700 group-hover:text-white group-hover:border-blue-700"
                    >
                      {t('Evaluate')} <ChevronRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const navItems = [
    { id: 'patients', icon: Users, label: t('Patient Registry') },
    { id: 'screening-reports', icon: ClipboardList, label: t('Screening Reports') },
    { id: 'reports', icon: FileText, label: t('Generated PDFs') },
    { id: 'analytics', icon: Activity, label: t('Analytics') },
    { id: 'profile', icon: UserCog, label: t('Profile Settings') },
  ];

  return (
    <div className="care-workspace clinical-shell flex flex-col md:flex-row font-sans">
      <a href="#doctor-main" className="skip-link">Skip to workspace</a>
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 max-w-sm rounded-xl border px-4 py-3 text-sm shadow-md ${
            toast.tone === 'success'
              ? 'border-teal-200 bg-teal-50 text-teal-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
          role="alert"
        >
          {toast.message}
        </div>
      )}

      <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col z-20 sticky top-0 md:h-screen">
        <div className="p-4 border-b border-slate-200 flex items-center space-x-2">
          <HospitalBrand compact />
        </div>
        <nav className="flex-1 py-5 px-3 space-y-1.5" aria-label="Doctor workspace navigation">
          {navItems.map(({ id, icon: Icon, label }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => { setActiveTab(id); transitionPatient(null, false); }}
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  active ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {createElement(Icon, { className: 'w-[18px] h-[18px] shrink-0', strokeWidth: 1.6 })}
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-slate-200">
          <button
            type="button"
            aria-label={t('Sign out')}
            onClick={handleSignOut}
            className="w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold text-slate-600 hover:bg-red-50 hover:text-red-800 transition-colors"
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" strokeWidth={1.6} />
            <span>{t('Sign Out')}</span>
          </button>
        </div>
      </aside>

      <main id="doctor-main" className="flex-1 flex flex-col min-h-screen">
        <header className="bg-white border-b border-slate-200 min-h-16 flex items-center justify-between gap-3 px-4 md:px-8 py-3 sticky top-0 z-10">
          <h1 className="font-semibold text-slate-900 text-lg">
            {activeTab === 'patients'
              ? 'Patient Management'
              : activeTab === 'screening-reports'
              ? t('Screening Reports')
              : activeTab === 'analytics'
              ? 'Clinic Analytics'
              : activeTab === 'reports'
              ? 'Reports'
              : t('Profile Settings')}
          </h1>
          <div className="flex items-center gap-3">
            <PatientLanguageSwitch compact />
            <button
              type="button"
              aria-label={t('View screening reports')}
              onClick={() => { setActiveTab('screening-reports'); transitionPatient(null, false); }}
              className="p-2 text-slate-500 hover:text-blue-700 transition-colors rounded-lg hover:bg-slate-100"
            >
              <Bell className="w-[18px] h-[18px]" />
            </button>
            <button
              type="button"
              aria-label="Open doctor profile"
              onClick={() => { setActiveTab('profile'); transitionPatient(null, false); }}
              className={`w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-800 font-semibold text-sm border transition-colors ${
                activeTab === 'profile' ? 'border-blue-700 ring-2 ring-blue-200' : 'border-slate-300 hover:bg-slate-200'
              }`}
            >
              Dr.
            </button>
          </div>
        </header>
        <div className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            {renderContent()}
          </div>
        </div>
      </main>

      <FundusLightbox
        open={lightbox.open}
        title={lightbox.title}
        subtitle={lightbox.subtitle}
        src={lightbox.src}
        alt={lightbox.alt}
        onClose={() => setLightbox((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}
