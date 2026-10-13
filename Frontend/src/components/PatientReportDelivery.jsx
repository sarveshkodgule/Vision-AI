import { useEffect, useRef, useState } from 'react';
import { FileText, Download, Mail, RefreshCw, X, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { fetchReportPdf, savePdf } from '../lib/reportPdf';
import { usePatientLanguage } from '../lib/patientLanguage';

export default function PatientReportDelivery({ screeningId, initialState, registeredEmail }) {
  const { language, t } = usePatientLanguage();
  const [delivery, setDelivery] = useState(initialState || { status: 'not_sent' });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [statusError, setStatusError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [preview, setPreview] = useState(null);
  const [notice, setNotice] = useState('');
  const dialog = useRef(null);
  const request = useRef(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!preview) return;
    dialog.current.showModal();
    return () => URL.revokeObjectURL(preview.url);
  }, [preview]);

  useEffect(() => {
    if (!screeningId) return;
    let active = true;
    let timer;
    let attempts = 0;
    const check = async () => {
      try {
        const response = await api.get(`/patient/screening-report/${screeningId}/status`);
        if (!active) return;
        setStatusError(false);
        setDelivery(response.data);
        if (['queued', 'sending'].includes(response.data.status) && ++attempts < 20) timer = setTimeout(check, 3000);
      } catch { if (active) setStatusError(true); }
    };
    check();
    return () => { active = false; clearTimeout(timer); };
  }, [screeningId, refresh]);

  const openPdf = async mode => {
    setBusy(mode);
    setError('');
    setNotice('');
    const controller = new AbortController();
    request.current = controller;
    try {
      const blob = await fetchReportPdf(`/patient/screening-report/${screeningId}`, controller.signal);
      if (controller.signal.aborted) return;
      if (mode === 'view') setPreview({ url: URL.createObjectURL(blob), blob });
      else { savePdf(blob, `VisionAI_Screening_${screeningId}.pdf`); setNotice('download'); }
    } catch (err) { if (err.name !== 'AbortError') setError(err.message); }
    finally { if (!controller.signal.aborted) setBusy(''); }
  };

  const send = async () => {
    setBusy('email');
    setError('');
    try {
      const response = await api.post(`/patient/screening-report/${screeningId}/email`);
      setDelivery(response.data);
      setRefresh(value => value + 1);
    } catch (err) { setError(err.message || 'Unable to request email.'); }
    finally { setBusy(''); }
  };

  if (!screeningId) return null;
  const messages = {
    not_sent: t('Email a PDF copy to your registered address.', 'तुमच्या नोंदणीकृत ईमेलवर PDF पाठवा.'),
    queued: t('Email queued. Your PDF is available here while you wait.', 'ईमेल पाठवण्याच्या रांगेत आहे. तोपर्यंत PDF येथे उपलब्ध आहे.'),
    sending: t('Your report email is being sent.', 'तुमचा अहवाल ईमेलने पाठवला जात आहे.'),
    sent: t('Accepted by the mail server. Check your inbox and spam folder.', 'मेल सर्व्हरने ईमेल स्वीकारला आहे. इनबॉक्स आणि स्पॅम फोल्डर तपासा.'),
    failed: t('Email could not be sent. Retry or download your PDF.', 'ईमेल पाठवता आला नाही. पुन्हा प्रयत्न करा किंवा PDF डाउनलोड करा.'),
  };
  const emailPending = ['queued', 'sending'].includes(delivery.status);
  return <section className="report-access" lang={language} aria-label={t('Patient report download and email', 'रुग्ण अहवाल डाउनलोड आणि ईमेल')}>
    <div className="report-access-heading"><FileText size={27}/><div><h3>{t('Your report, ready to keep', 'तुमचा अहवाल जतन करा')}</h3><p>{t('Result explanation, precautions and doctor guidance · PDF in English', 'निकालाचे स्पष्टीकरण, काळजी आणि डॉक्टरांचे मार्गदर्शन · PDF इंग्रजीत')}</p></div></div>
    <div className="report-actions">
      <button type="button" disabled={!!busy} onClick={() => openPdf('view')}><FileText size={17}/>{t('View PDF', 'PDF पाहा')}</button>
      <button type="button" disabled={!!busy} onClick={() => openPdf('download')}><Download size={17}/>{t('Download', 'डाउनलोड')}</button>
      <button type="button" disabled={!!busy || emailPending || delivery.status === 'sent'} onClick={send}><Mail size={17}/>{delivery.status === 'sent' ? t('Email sent', 'ईमेल पाठवला') : delivery.status === 'failed' ? t('Retry email', 'ईमेल पुन्हा पाठवा') : t('Email report', 'अहवाल ईमेल करा')}</button>
    </div>
    <div className="report-email-status"><p role="status">{busy ? <><Loader2 size={15} className="animate-spin"/> {t(busy === 'email' ? 'Requesting your email…' : 'Preparing your PDF…', busy === 'email' ? 'ईमेलची विनंती करत आहे…' : 'PDF तयार करत आहे…')}</> : statusError ? t('Email status could not be refreshed.', 'ईमेलची स्थिती तपासता आली नाही.') : messages[delivery.status] || t('Email status unavailable.', 'ईमेलची स्थिती उपलब्ध नाही.')}</p><button type="button" onClick={() => setRefresh(value => value + 1)} disabled={!!busy}><RefreshCw size={13}/>{t('Refresh status', 'स्थिती पुन्हा तपासा')}</button></div>
    {registeredEmail && <p className="report-recipient">{t('Registered email:', 'नोंदणीकृत ईमेल:')} {registeredEmail}</p>}
    {notice && <p role="status">{t('Download started. Check your browser’s downloads.', 'डाउनलोड सुरू झाले आहे. ब्राउझरमधील डाउनलोड तपासा.')}</p>}
    {error && <div className="patient-feedback" role="alert"><p>{t('We could not complete that action. Your saved report is still available; please try the action again.', 'ही कृती पूर्ण झाली नाही. तुमचा जतन केलेला अहवाल उपलब्ध आहे; कृपया पुन्हा प्रयत्न करा.')}</p><small lang="en">{error}</small></div>}
    {preview && <dialog className="pdf-preview" ref={dialog} onCancel={() => setPreview(null)} aria-label={t('Screening PDF preview', 'तपासणी PDF पूर्वावलोकन')}>
      <header><strong>{t('Your screening PDF', 'तुमचा तपासणी PDF')}</strong><button autoFocus type="button" onClick={() => setPreview(null)} aria-label={t('Close PDF preview', 'PDF पूर्वावलोकन बंद करा')}><X size={22}/></button></header>
      <p>{t('If the preview does not appear on your device, download the report to read it.', 'तुमच्या उपकरणावर पूर्वावलोकन दिसत नसल्यास अहवाल डाउनलोड करून वाचा.')}</p>
      <iframe src={preview.url} title={t('Patient screening report PDF', 'रुग्ण तपासणी अहवाल PDF')}/>
      <footer><button type="button" onClick={() => savePdf(preview.blob, `VisionAI_Screening_${screeningId}.pdf`)}><Download size={17}/>{t('Download PDF', 'PDF डाउनलोड करा')}</button></footer>
    </dialog>}
  </section>;
}
