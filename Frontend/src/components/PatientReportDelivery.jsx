import { useEffect, useState } from 'react';
import { api, API_BASE_URL } from '../lib/api';

export default function PatientReportDelivery({ screeningId, initialState, registeredEmail }) {
  const [delivery, setDelivery] = useState(initialState || { status: 'not_sent' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!screeningId) return;
    let active = true;
    let timer;
    let attempts = 0;
    const check = async () => {
      try {
        const response = await api.get(`/patient/screening-report/${screeningId}/status`);
        if (!active) return;
        setDelivery(response.data);
        if (['queued', 'sending'].includes(response.data.status) && ++attempts < 20) {
          timer = setTimeout(check, 3000);
        }
      } catch (err) {
        if (active) setError(err.message || 'Unable to check email status.');
      }
    };
    check();
    return () => { active = false; clearTimeout(timer); };
  }, [screeningId, refresh]);

  const download = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/patient/screening-report/${screeningId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.detail || 'Unable to download report.');
      }
      if (!response.headers.get('content-type')?.includes('application/pdf')) throw new Error('The server did not return a PDF.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `VisionAI_Screening_${screeningId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err.message || 'Unable to download report.');
    } finally { setBusy(false); }
  };

  const send = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await api.post(`/patient/screening-report/${screeningId}/email`);
      setDelivery(response.data);
      setRefresh(value => value + 1);
    } catch (err) {
      setError(err.message || 'Unable to request email.');
    } finally { setBusy(false); }
  };

  if (!screeningId) return null;
  const messages = {
    not_sent: 'A PDF copy can be emailed to your registered address.',
    queued: 'Your report email is queued. You can download the PDF now.',
    sending: 'Your report email is being prepared and sent.',
    sent: 'The mail server accepted your PDF. Check your inbox and spam folder.',
    failed: delivery.error || 'Email could not be sent. Download your PDF or retry below.',
  };
  return (
    <section className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-left space-y-3" aria-label="Patient report download and email">
      <p className="text-sm font-semibold text-slate-800">Your detailed screening PDF</p>
      <p className="text-xs text-slate-600">Result explanation, daily precautions, doctor guidance and urgent symptoms.</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={busy} onClick={download} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Please wait...' : 'Download PDF report'}</button>
        {delivery.status !== 'sent' && <button type="button" disabled={busy} onClick={send} className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50">{delivery.status === 'failed' ? 'Retry email' : delivery.status === 'not_sent' ? 'Email my report' : 'Check / retry email'}</button>}
      </div>
      <p role="status" className="text-xs text-slate-600">{messages[delivery.status] || 'Email status unavailable.'}{registeredEmail && ` Registered address: ${registeredEmail}`}</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </section>
  );
}
