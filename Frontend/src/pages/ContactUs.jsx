import { Link } from 'react-router-dom';
import { Phone, MapPin, Clock3, ArrowUpRight, Check, FileText } from 'lucide-react';
import HospitalLayout from '../components/HospitalLayout';
import VisitChecklist from '../components/VisitChecklist';
import CopyAddressButton from '../components/CopyAddressButton';
import { hospital } from '../lib/hospital';

export default function ContactUs() {
  return <HospitalLayout>
    <section className="page-intro hospital-container"><p className="eyebrow">CONTACT & DIRECTIONS</p><h1>Your next step<br/>to <em>better eye care.</em></h1><p>Speak to the hospital, plan your journey, and arrive prepared for your consultation.</p></section>
    <section className="hospital-container contact-grid">
      <div className="contact-panel"><p className="eyebrow">SHRI SARVESHWAR NETRALAYA</p><h2>We’re a phone<br/>call away.</h2><a className="contact-number" href={hospital.phoneHref}>{hospital.phone}<ArrowUpRight size={26}/></a><p>Call to ask about appointments, doctor availability, consultation fees and the right time to visit.</p><div className="contact-detail"><MapPin/><div><h3>Find us</h3><p>{hospital.address}</p></div></div><CopyAddressButton/><div className="contact-detail"><Clock3/><div><h3>Before you travel</h3><p>Please call to confirm current clinic hours. Public listings show different timings.</p></div></div><a className="hospital-button button-cream" href={hospital.phoneHref}><Phone size={18}/> Call for an appointment</a></div>
      <div className="visit-panel"><p className="eyebrow">A LITTLE PREPARATION GOES A LONG WAY</p><h2>Coming in for<br/>an eye examination?</h2><VisitChecklist /><div className="portal-reminder"><FileText size={27}/><div><strong>Your report is ready when you are.</strong><p>Sign in to view screening history and download your PDF.</p><Link to="/login" className="text-link">Open the patient portal <ArrowUpRight size={16}/></Link></div></div></div>
    </section>
    <section className="hospital-container location-section"><div><p className="eyebrow">FIND YOUR WAY</p><h2>Mitra Nagar,<br/>Jalna Road.</h2><p>Near Gurudwara, Chhatrapati Sambhajinagar<br/>(formerly Aurangabad), Maharashtra.</p><a href={hospital.directions} target="_blank" rel="noreferrer" className="hospital-button button-outline">Open Google Maps <ArrowUpRight size={18}/></a></div><a className="location-card" href={hospital.directions} target="_blank" rel="noreferrer"><MapPin size={42}/><strong>Shri Sarveshwar Netralaya</strong><span>Plot No. 5 · Mitra Nagar · Near Gurudwara</span><span className="map-link">Get directions in Google Maps <ArrowUpRight size={18}/></span></a></section>
    <div className="hospital-container"><aside className="urgent-note"><strong>Need urgent eye care?</strong><p>For sudden vision loss, new flashes or floaters, or a curtain across your vision, seek urgent eye care immediately. Do not wait for an online response. Emergency availability at this hospital must be confirmed directly.</p></aside></div>
    <div className="hospital-container content-sources">Contact information from <a href={hospital.sources.contact} target="_blank" rel="noreferrer">public hospital listings</a>, reviewed 7 October 2026. Appointment arrangements are made directly by phone.</div>
  </HospitalLayout>;
}
