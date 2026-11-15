import { Link } from 'react-router-dom';
import HospitalBrand from '../components/HospitalBrand';

export default function NotFound() {
  return <main className="app-error-page"><HospitalBrand /><div><p className="eyebrow">404 · PAGE NOT FOUND</p><h1>This page is not part of the care path.</h1><p>The link may be out of date. Return to the hospital website or open your portal.</p><div className="button-row"><Link className="hospital-button" to="/">Return home</Link><Link className="hospital-button button-outline" to="/login">Open portal</Link></div></div></main>;
}
