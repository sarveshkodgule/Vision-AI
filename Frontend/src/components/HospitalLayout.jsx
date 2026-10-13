import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Phone, MapPin, ArrowUpRight, Menu, X } from 'lucide-react';
import HospitalBrand from './HospitalBrand';
import { hospital } from '../lib/hospital';
import PatientLanguageSwitch from './PatientLanguageSwitch';
import { usePatientLanguage } from '../lib/patientLanguage';

export default function HospitalLayout({ children }) {
  const { language, t } = usePatientLanguage();
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
  return <div className="hospital-site" lang={language}>
    <a href="#main-content" className="skip-link">{t('Skip to content', 'थेट मुख्य माहितीवर जा')}</a>
    <div className="hospital-topbar"><div className="hospital-container"><span><MapPin size={13} /> {t(`Mitra Nagar, ${hospital.city}`, 'मित्रनगर, छत्रपती संभाजीनगर')}</span><a href={hospital.phoneHref}><Phone size={13} /> {t('Appointments:', 'भेटीसाठी फोन:')} {hospital.phone}</a></div></div>
    <header className="hospital-header">
      <div className="hospital-container hospital-nav">
        <HospitalBrand />
        <button ref={menuButton} className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? t('Close navigation', 'मेनू बंद करा') : t('Open navigation', 'मेनू उघडा')} aria-expanded={menuOpen} aria-controls="hospital-navigation">{menuOpen ? <X /> : <Menu />}</button>
        <nav id="hospital-navigation" className={menuOpen ? 'is-open' : ''} aria-label="Main navigation" onClick={() => setMenuOpen(false)}>
          <NavLink to="/" end>{t('Home', 'मुख्य पान')}</NavLink><NavLink to="/about">{t('Our hospital', 'आमच्याबद्दल')}</NavLink><a href="/#care">{t('Eye care', 'डोळ्यांची काळजी')}</a><NavLink to="/contact">{t('Plan your visit', 'भेट देण्यापूर्वी')}</NavLink><Link className="hospital-button button-small" to={portal}>{t('Patient & doctor portal', 'रुग्ण आणि डॉक्टर लॉग इन')} <ArrowUpRight size={16} /></Link>
        </nav>
      </div>
    </header>
    {pathname === '/' && <div className="hospital-container landing-utility"><span>{t('A little guidance. A clear next step.', 'तुमची शंका विचारा. पुढचं पाऊल समजून घ्या.')}</span><PatientLanguageSwitch compact /></div>}
    <main id="main-content" lang={pathname === '/' ? language : 'en'}>{children}</main>
    <footer className="hospital-footer">
      <div className="hospital-container footer-grid">
        <div><HospitalBrand light /><p>{t('Eye care, closer to home.', 'घराच्या जवळ, डोळ्यांची काळजी.')}<br />{t('A clearer path from screening to consultation.', 'प्राथमिक तपासणीपासून डॉक्टरांच्या सल्ल्यापर्यंत.')}</p><span className="footer-caption">{t('Vision AI · Digital screening & care portal', 'Vision AI · ऑनलाइन प्राथमिक तपासणी आणि रिपोर्ट')}</span></div>
        <div><h3>{t('Explore', 'अधिक माहिती')}</h3><Link to="/about">{t('About the hospital', 'रुग्णालयाबद्दल')}</Link><Link to="/about#doctor">{t('Meet your doctor', 'डॉक्टरांची ओळख')}</Link><Link to="/contact">{t('Contact & directions', 'संपर्क आणि पत्ता')}</Link><Link to={portal}>{t('Open your portal', 'तुमचं खाते उघडा')}</Link></div>
        <div><h3>{t('Visit us', 'इथे भेट द्या')}</h3><p>{t(hospital.address, hospital.marathiAddress)}</p><a href={hospital.phoneHref}>{hospital.phone} <ArrowUpRight size={15}/></a><p className="footer-caption">{t('Please call to confirm timings before you travel.', 'निघण्यापूर्वी फोन करून वेळ नक्की करा.')}</p></div>
      </div>
      <div className="hospital-container footer-bottom"><span>© {new Date().getFullYear()} {t(hospital.name, hospital.marathiName)} · Vision AI</span><span>{t('Screening supports an eye examination; it does not replace one.', 'ऑनलाइन अंदाज मिळाला तरी प्रत्यक्ष डोळ्यांची तपासणी गरजेची आहे.')}</span></div>
    </footer>
    <nav className="mobile-care-bar" aria-label={t('Quick patient actions', 'लगेच मदत घ्या')}><a href={hospital.phoneHref}><Phone size={17}/>{t('Call hospital', 'फोन करा')}</a><Link to={portal}>{t('Open your portal', 'तुमचं खाते उघडा')} <ArrowUpRight size={17}/></Link></nav>
  </div>;
}
