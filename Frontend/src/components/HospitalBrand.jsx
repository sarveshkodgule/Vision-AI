import { usePatientLanguage } from '../lib/patientLanguage';
import { Link } from 'react-router-dom';
import { hospital } from '../lib/hospital';

export default function HospitalBrand({ light = false, compact = false }) {
  const { t } = usePatientLanguage();
  return <Link to="/" className={`hospital-brand ${light ? 'brand-light' : ''} ${compact ? 'brand-compact' : ''}`} aria-label={`${hospital.name} home`}>
    <span className="hospital-logo-frame"><img className="hospital-mark" src="/sarveshwar-eye.png" width="2172" height="724" alt="" /></span>
    <span><strong>{t("Shri Sarveshwar", "श्री सर्वेश्वर")}<span>{t("Netralaya", "नेत्रालय")}</span></strong><small>{compact ? 'VISION AI · CARE PORTAL' : hospital.marathiName}</small></span>
  </Link>;
}
