import { Link } from 'react-router-dom';
import { Phone, MapPin, Clock3, ArrowUpRight, Check, FileText } from 'lucide-react';
import HospitalLayout from '../components/HospitalLayout';
import VisitChecklist from '../components/VisitChecklist';
import CopyAddressButton from '../components/CopyAddressButton';
import VisitGuidance from '../components/VisitGuidance';
import { hospital } from '../lib/hospital';

export default function ContactUs() {
  return <HospitalLayout>
    <section className="page-intro hospital-container"><p className="eyebrow">CONTACT & DIRECTIONS</p><h1>Your next step<br/>to <em>better eye care.</em></h1><p>Speak to the hospital, plan your journey, and arrive prepared for your consultation.</p></section>
    <VisitGuidance />
    <section className="hospital-container contact-grid">
      <div className="contact-panel">
        <p className="eyebrow">SHRI SARVESHWAR NETRALAYA · {hospital.marathiName}</p>
        <h2>We’re a phone<br/>call away.</h2>
        <div style={{ marginBlock: '20px 10px' }}>
          <small style={{ fontSize: '11px', color: '#c2d1e3', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Mobile Consultation</small>
          <a className="contact-number" href={hospital.phoneHref} style={{ marginTop: '4px' }}>{hospital.phone}<ArrowUpRight size={24}/></a>
        </div>
        <div style={{ marginBlock: '12px 20px' }}>
          <small style={{ fontSize: '11px', color: '#c2d1e3', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Clinic Registration Desk</small>
          <a className="contact-number" href={hospital.landlineHref} style={{ marginTop: '4px', fontSize: '22px' }}>{hospital.landline}<Phone size={20}/></a>
        </div>
        <p>Call to ask about appointments, child eye screening, strabismus consultations, doctor availability and fees.</p>
        <div className="contact-detail"><MapPin/><div><h3>Find us</h3><p>{hospital.address}</p></div></div>
        <CopyAddressButton/>
        <div className="contact-detail"><Clock3/><div><h3>Before you travel</h3><p>Please call to confirm current clinic hours and doctor consultation timings.</p></div></div>
        <div className="button-row" style={{ marginTop: '24px' }}>
          <a className="hospital-button button-cream" href={hospital.phoneHref}><Phone size={18}/> Call Mobile</a>
          <a className="hospital-button button-outline" href={hospital.landlineHref} style={{ color: 'white', borderColor: '#ffffff55' }}>Call Clinic</a>
        </div>
      </div>
      <div className="visit-panel"><p className="eyebrow">A LITTLE PREPARATION GOES A LONG WAY</p><h2>Coming in for<br/>an eye examination?</h2><VisitChecklist /><div className="portal-reminder"><FileText size={27}/><div><strong>Your report is ready when you are.</strong><p>Sign in to view screening history and download your PDF.</p><Link to="/login" className="text-link">Open the patient portal <ArrowUpRight size={16}/></Link></div></div></div>
    </section>
    <section className="hospital-container location-section"><div><p className="eyebrow">FIND YOUR WAY</p><h2>Mitra Nagar,<br/>Jalna Road.</h2><p>Near Gurudwara, Chhatrapati Sambhajinagar<br/>(formerly Aurangabad), Maharashtra.</p><a href={hospital.directions} target="_blank" rel="noreferrer" className="hospital-button button-outline">Open Google Maps <ArrowUpRight size={18}/></a></div><a className="location-card" href={hospital.directions} target="_blank" rel="noreferrer"><MapPin size={42}/><strong>Shri Sarveshwar Netralaya</strong><span>Plot No. 5 · Mitra Nagar · Near Gurudwara</span><span className="map-link">Get directions in Google Maps <ArrowUpRight size={18}/></span></a></section>
    <div className="hospital-container"><aside className="urgent-note"><strong>Need urgent eye care?</strong><p>For sudden vision loss, new flashes or floaters, or a curtain across your vision, seek urgent eye care immediately. Do not wait for an online response. Emergency availability at this hospital must be confirmed directly.</p></aside></div>
    <div className="hospital-container content-sources">Contact information from <a href={hospital.sources.contact} target="_blank" rel="noreferrer">public hospital listings</a>, reviewed 7 October 2026. Appointment arrangements are made directly by phone.</div>
  </HospitalLayout>;
}
