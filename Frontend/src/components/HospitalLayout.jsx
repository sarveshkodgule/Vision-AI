import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Phone, MapPin, ArrowUpRight, Menu, X } from 'lucide-react';
import HospitalBrand from './HospitalBrand';
import { hospital } from '../lib/hospital';

export default function HospitalLayout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef(null);
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [pathname, hash]);
  useEffect(() => {
    if (!menuOpen) return;
    function dismiss(event) {
      if (event.key === 'Escape') { setMenuOpen(false); menuButton.current?.focus(); }
    }
    document.addEventListener('keydown', dismiss);
    return () => document.removeEventListener('keydown', dismiss);
  }, [menuOpen]);
  const portal = localStorage.getItem('token') ? (localStorage.getItem('role') === 'doctor' ? '/doctor/dashboard' : '/patient/dashboard') : '/login';
  return <div className="hospital-site">
    <a href="#main-content" className="skip-link">Skip to content</a>
    <div className="hospital-topbar"><div className="hospital-container"><span><MapPin size={13} /> Mitra Nagar, {hospital.city}</span><a href={hospital.phoneHref}><Phone size={13} /> Appointments: {hospital.phone}</a></div></div>
    <header className="hospital-header">
      <div className="hospital-container hospital-nav">
        <HospitalBrand />
        <button ref={menuButton} className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls="hospital-navigation">{menuOpen ? <X /> : <Menu />}</button>
        <nav id="hospital-navigation" className={menuOpen ? 'is-open' : ''} aria-label="Main navigation" onClick={() => setMenuOpen(false)}>
          <NavLink to="/" end>Home</NavLink><NavLink to="/about">Our hospital</NavLink><a href="/#care">Eye care</a><NavLink to="/contact">Plan your visit</NavLink><Link className="hospital-button button-small" to={portal}>Patient & doctor portal <ArrowUpRight size={16} /></Link>
        </nav>
      </div>
    </header>
    <main id="main-content">{children}</main>
    <footer className="hospital-footer">
      <div className="hospital-container footer-grid">
        <div><HospitalBrand light /><p>Eye care, closer to home.<br />A clearer path from screening to consultation.</p><span className="footer-caption">Vision AI · Digital screening & care portal</span></div>
        <div><h3>Explore</h3><Link to="/about">About the hospital</Link><Link to="/about#doctor">Meet your doctor</Link><Link to="/contact">Contact & directions</Link><Link to={portal}>Open your portal</Link></div>
        <div><h3>Visit us</h3><p>{hospital.address}</p><a href={hospital.phoneHref}>{hospital.phone} <ArrowUpRight size={15}/></a><p className="footer-caption">Please call to confirm timings before you travel.</p></div>
      </div>
      <div className="hospital-container footer-bottom"><span>© {new Date().getFullYear()} {hospital.name} · Vision AI project</span><span>Screening supports an eye examination; it does not replace one.</span></div>
    </footer>
    <nav className="mobile-care-bar" aria-label="Quick patient actions"><a href={hospital.phoneHref}><Phone size={17}/>Call hospital</a><Link to={portal}>Open your portal <ArrowUpRight size={17}/></Link></nav>
  </div>;
}
