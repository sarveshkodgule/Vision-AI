import { createElement } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Eye, FileText, Phone, MapPin, Glasses, ClipboardCheck, ScanEye, HeartHandshake } from 'lucide-react';
import HospitalLayout from '../components/HospitalLayout';
import HospitalChat from '../components/HospitalChat';
import CareNavigator from '../components/CareNavigator';
import { hospital, patientFaqs } from '../lib/hospital';

export default function LandingPage() {
  return <HospitalLayout>
    <section className="hospital-hero hospital-container">
      <div className="hero-copy">
        <p className="eyebrow"><span/> EYE CARE IN CHHATRAPATI SAMBHAJINAGAR</p>
        <h1>For every view<br/>that <em>matters.</em></h1>
        <p className="hero-description">Your child’s first book. A familiar face. The road ahead.<br className="desktop-break"/> Take the next step in caring for your vision with<br className="desktop-break"/> Shri Sarveshwar Netralaya.</p>
        <div className="button-row"><a className="hospital-button" href={hospital.phoneHref}>Call for an appointment <ArrowUpRight size={19}/></a><Link className="hospital-button button-outline" to="/login">Start eye screening <ArrowRight size={18}/></Link></div>
        <div className="hero-doctor"><span className="doctor-initials small">HA</span><div><strong>{hospital.doctor.name}</strong><span>Ophthalmologist · Meet your doctor</span></div><Link to="/about#doctor" aria-label="Read about Dr. Hemant Anaspure"><ArrowUpRight size={23}/></Link></div>
      </div>
      <div className="hero-art" aria-label="Shri Sarveshwar Netralaya eye emblem and decorative vision chart">
        <div className="art-caption"><span>श्री सर्वेश्वर नेत्रालय</span><span>CARE FOR YOUR VISION</span></div>
        <div className="hospital-emblem-display"><img src="/sarveshwar-eye.png" width="2172" height="724" alt="Shri Sarveshwar Netralaya eye emblem" fetchPriority="high" /></div>
        <div className="vision-chart" aria-hidden="true"><span>E</span><span>F P</span><span>T O Z</span><i/></div>
        <div className="art-note"><span className="art-note-icon"><HeartHandshake size={23}/></span><div><strong>A little attention today.</strong><p>A clearer understanding tomorrow.</p></div></div>
        <span className="art-footnote">VISION AI · SCREENING & PATIENT CARE</span>
      </div>
    </section>

    <div className="hospital-container"><div className="quick-access">
      <a href={hospital.phoneHref}><Phone/><div><small>LET’S TALK</small><strong>{hospital.phone}</strong><span>Call to confirm an appointment</span></div><ArrowUpRight/></a>
      <a href={hospital.directions} target="_blank" rel="noreferrer"><MapPin/><div><small>FIND THE HOSPITAL</small><strong>Mitra Nagar, Jalna Road</strong><span>Near Gurudwara · Get directions</span></div><ArrowUpRight/></a>
      <Link to="/login"><FileText/><div><small>YOUR CARE, CONNECTED</small><strong>Patient portal</strong><span>Screening, history & PDF reports</span></div><ArrowUpRight/></Link>
    </div></div>

    <section id="care" className="hospital-section hospital-container">
      <div className="section-heading"><div><p className="eyebrow">A GOOD PLACE TO BEGIN</p><h2>Care that starts<br/>with understanding.</h2></div><p>Whether you have a question about your eyesight or want to understand a screening result, find your next step here.</p></div>
      <CareNavigator />
    </section>

    <section className="portal-band"><div className="hospital-container portal-grid"><div><p className="eyebrow">MEET YOUR DIGITAL CARE COMPANION</p><h2>A little clarity.<br/>Before your consultation.</h2><p>Vision AI brings your screening, explanations and reports into one place. Use it to prepare for a conversation with your eye-care professional.</p><Link to="/login" className="hospital-button button-cream">Explore your portal <ArrowRight size={18}/></Link></div><div className="journey-list">{[[ClipboardCheck, '01', 'Tell us about your routine', 'Complete the lifestyle and family-history questionnaire.'], [ScanEye, '02', 'Understand your screening', 'See your model-estimated risk with a plain-language explanation.'], [FileText, '03', 'Take your report to the doctor', 'Download the PDF and discuss the result at your eye examination.']].map(([Icon, number, title, text]) => <div key={number}><span className="journey-icon">{createElement(Icon, { size: 23 })}</span><div><small>STEP {number}</small><h3>{title}</h3><p>{text}</p></div></div>)}</div></div></section>

    <section className="hospital-section hospital-container faq-grid"><div><p className="eyebrow">BEFORE YOU VISIT</p><h2>A few things<br/>you may be wondering.</h2><Link to="/contact" className="text-link">More help planning your visit <ArrowRight size={18}/></Link></div><div className="hospital-faq">{patientFaqs.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></section>
    <section className="hospital-container closing-invitation"><div className="invitation-emblem" aria-hidden="true"><img src="/sarveshwar-eye.png" width="2172" height="724" alt="" /></div><div><p className="eyebrow">A FAMILIAR FACE. A CLEARER NEXT STEP.</p><h2>Good care begins<br/>with being heard.</h2><p>Meet {hospital.doctor.name}, ophthalmologist at Shri Sarveshwar Netralaya.</p><Link className="text-link" to="/about#doctor">Get to know your doctor <ArrowUpRight size={18}/></Link></div><a className="hospital-button" href={hospital.phoneHref}>Let’s talk <Phone size={17}/></a></section>
    <HospitalChat/>
  </HospitalLayout>;
}
