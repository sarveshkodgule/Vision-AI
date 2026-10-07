import { Link } from 'react-router-dom';
import { hospital } from '../lib/hospital';

export default function HospitalBrand({ light = false, compact = false }) {
  return <Link to="/" className={`hospital-brand ${light ? 'brand-light' : ''} ${compact ? 'brand-compact' : ''}`} aria-label={`${hospital.name} home`}>
    <span className="hospital-logo-frame"><img className="hospital-mark" src="/sarveshwar-eye.png" width="2172" height="724" alt="" /></span>
    <span><strong>Shri Sarveshwar<span>Netralaya</span></strong><small>{compact ? 'VISION AI · CARE PORTAL' : hospital.marathiName}</small></span>
  </Link>;
}
