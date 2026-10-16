import { usePatientLanguage } from '../lib/patientLanguage';
import { Link } from 'react-router-dom';
import { Phone, MapPin, Clock3, ArrowUpRight, Check, FileText } from 'lucide-react';
import HospitalLayout from '../components/HospitalLayout';
import VisitChecklist from '../components/VisitChecklist';
import CopyAddressButton from '../components/CopyAddressButton';
import VisitGuidance from '../components/VisitGuidance';
import { hospital } from '../lib/hospital';

export default function ContactUs() {
  const { t } = usePatientLanguage();
  return <HospitalLayout>
    <section className="page-intro hospital-container"><p className="eyebrow">{t("CONTACT & DIRECTIONS")}</p><h1>{t("Your next step")}<br/>{t("to")} <em>{t("better eye care.")}</em></h1><p>{t("Speak to the hospital, plan your journey, and arrive prepared for your consultation.")}</p></section>
    <VisitGuidance />
    <section className="hospital-container contact-grid">
      <div className="contact-panel">
        <p className="eyebrow">{t("SHRI SARVESHWAR NETRALAYA ·")} {hospital.marathiName}</p>
        <h2>{t("We’re a phone")}<br/>{t("call away.")}</h2>
        <div style={{ marginBlock: '20px 10px' }}>
          <small style={{ fontSize: '11px', color: '#c2d1e3', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t("Mobile Consultation")}</small>
          <a className="contact-number" href={hospital.phoneHref} style={{ marginTop: '4px' }}>{hospital.phone}<ArrowUpRight size={24}/></a>
        </div>
        <div style={{ marginBlock: '12px 20px' }}>
          <small style={{ fontSize: '11px', color: '#c2d1e3', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t("Clinic Registration Desk")}</small>
          <a className="contact-number" href={hospital.landlineHref} style={{ marginTop: '4px', fontSize: '22px' }}>{hospital.landline}<Phone size={20}/></a>
        </div>
        <p>{t("Call to ask about appointments, child eye screening, strabismus consultations, doctor availability and fees.")}</p>
        <div className="contact-detail"><MapPin/><div><h3>{t("Find us")}</h3><p>{t(hospital.address, hospital.marathiAddress)}</p></div></div>
        <CopyAddressButton/>
        <div className="contact-detail"><Clock3/><div><h3>{t("Clinic hours", "रुग्णालयाची वेळ")}</h3><p>{t(hospital.hours, hospital.marathiHours)}<br/>{t(hospital.closed, hospital.marathiClosed)}</p><p>{t("Please call to confirm current clinic hours and doctor consultation timings.")}</p></div></div>
        <div className="button-row" style={{ marginTop: '24px' }}>
          <a className="hospital-button button-cream" href={hospital.phoneHref}><Phone size={18}/> {t("Call Mobile")}</a>
          <a className="hospital-button button-outline" href={hospital.landlineHref} style={{ color: 'white', borderColor: '#ffffff55' }}>{t("Call Clinic")}</a>
        </div>
      </div>
      <div className="visit-panel"><p className="eyebrow">{t("A LITTLE PREPARATION GOES A LONG WAY")}</p><h2>{t("Coming in for")}<br/>{t("an eye examination?")}</h2><VisitChecklist /><div className="portal-reminder"><FileText size={27}/><div><strong>{t("Your report is ready when you are.")}</strong><p>{t("Sign in to view screening history and download your PDF.")}</p><Link to="/login" className="text-link">{t("Open the patient portal")} <ArrowUpRight size={16}/></Link></div></div></div>
    </section>
    <section className="hospital-container location-section"><div><p className="eyebrow">{t("FIND YOUR WAY")}</p><h2>{t("Mitra Nagar,")}<br/>{t("Jalna Road.")}</h2><p>{t("Near Gurudwara, Chhatrapati Sambhajinagar")}<br/>{t("(formerly Aurangabad), Maharashtra.")}</p><a href={hospital.directions} target="_blank" rel="noreferrer" className="hospital-button button-outline">{t("Open Google Maps")} <ArrowUpRight size={18}/></a></div><a className="location-card" href={hospital.directions} target="_blank" rel="noreferrer"><MapPin size={42}/><strong>{t("Shri Sarveshwar Netralaya")}</strong><span>{t("Plot No. 5 · Mitra Nagar · Near Gurudwara")}</span><span className="map-link">{t("Get directions in Google Maps")} <ArrowUpRight size={18}/></span></a></section>
    <div className="hospital-container"><aside className="urgent-note"><strong>{t("Need urgent eye care?")}</strong><p>{t("For sudden vision loss, new flashes or floaters, or a curtain across your vision, seek urgent eye care immediately. Do not wait for an online response. Emergency availability at this hospital must be confirmed directly.")}</p></aside></div>
    <div className="hospital-container content-sources">{t("Contact information from")} <a href={hospital.sources.contact} target="_blank" rel="noreferrer">{t("public hospital listings")}</a>{t(", reviewed 7 October 2026. Appointment arrangements are made directly by phone.")}</div>
  </HospitalLayout>;
}
