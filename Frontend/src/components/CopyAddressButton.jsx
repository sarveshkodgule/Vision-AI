import { usePatientLanguage } from '../lib/patientLanguage';
import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { hospital } from '../lib/hospital';

export default function CopyAddressButton() {
  const { t } = usePatientLanguage();
  const [status, setStatus] = useState('');
  async function copy() {
    try { await navigator.clipboard.writeText(`${hospital.name}\n${hospital.address}`); setStatus('Address copied'); }
    catch { setStatus('Unable to copy automatically. Select and copy the address above.'); }
  }
  return <div className="copy-address"><button type="button" className="text-link" onClick={copy}>{status === 'Address copied' ? <Check size={16}/> : <Copy size={16}/>}{t("Copy hospital address")}</button><span role="status">{t(status)}</span></div>;
}
