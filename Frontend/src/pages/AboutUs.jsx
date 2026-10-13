import { createElement } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, HeartHandshake, MapPin, FileCheck2, Eye, Phone, GraduationCap } from 'lucide-react';
import HospitalLayout from '../components/HospitalLayout';
import HospitalGallery from '../components/HospitalGallery';
import { hospital } from '../lib/hospital';

export default function AboutUs() {
  return <HospitalLayout>
    <section className="page-intro hospital-container"><p className="eyebrow">OUR HOSPITAL · OUR COMMUNITY</p><h1>Here for your eyes.<br/><em>Here for you.</em></h1><p>Get to know Shri Sarveshwar Netralaya, your local eye-care destination in Mitra Nagar, Chhatrapati Sambhajinagar.</p></section>
    <section className="hospital-container about-intro">
      <div className="hospital-address-art"><span className="eyebrow">श्री सर्वेश्वर नेत्रालय</span><img className="about-hospital-emblem" src="/sarveshwar-eye.png" width="2172" height="724" alt="" /><h2>Rooted in<br/>our community.</h2><span><MapPin size={16}/> Mitra Nagar · Jalna Road</span></div>
      <div><p className="eyebrow">EYE CARE, CLOSER TO HOME</p><h2>A familiar place.<br/>An important conversation.</h2><p>Located near Gurudwara on Jalna Road, the hospital is listed locally as Sri Sarveshwar Netralaya. Dr. Hemant Anaspure is its publicly listed ophthalmologist.</p><p>This digital care portal is being developed for the hospital to help patients understand their screening results, keep their reports together, and prepare for an eye examination.</p><p>For consultation availability, examinations and treatment options, please speak directly with the hospital.</p><a href={hospital.phoneHref} className="text-link">Talk to the hospital <Phone size={17}/></a></div>
    </section>
    <HospitalGallery />
    <section id="doctor" className="hospital-section hospital-container">
      <div className="section-heading"><div><p className="eyebrow">MEET YOUR DOCTOR · KNOW YOUR DOCTOR</p><h2>The person behind your care.</h2></div></div>
      <article className="doctor-profile">
        <div className="doctor-profile-art">
          <img src={hospital.doctor.photo} alt={hospital.doctor.name} className="doctor-portrait-photo" />
          <p>OPHTHALMOLOGY & STRABISMUS</p>
          <span className="doctor-art-line"/>
        </div>
        <div className="doctor-profile-copy">
          <p className="eyebrow">{hospital.doctor.role} · {hospital.doctor.marathiName}</p>
          <h3>{hospital.doctor.name}</h3>
          <div className="doctor-specialty-callout">
            <strong>Super Specialization:</strong> {hospital.doctor.superSpecialization} ({hospital.doctor.marathiSpecialization})
          </div>
          <p className="doctor-qualifications"><GraduationCap size={20}/><strong>{hospital.doctor.qualifications}</strong></p>
          <p>Dr. Hemant D. Anaspure is a senior ophthalmologist and eye surgeon specializing in comprehensive ophthalmology, paediatric eye care, and squint (strabismus) treatment at Shri Sarveshwar Netralaya, Jalna Road, Chhatrapati Sambhajinagar.</p>
          
          <div className="doctor-pedigree">
            <div>
              <h4>Academic & Medical Training</h4>
              <ul>
                {hospital.doctor.education.map(item => <li key={item.degree}><strong>{item.degree}</strong>{item.institution}</li>)}
              </ul>
            </div>
            <div>
              <h4>Past Hospital Associations</h4>
              <ul>
                {hospital.doctor.pastAssociations.map(item => <li key={item.name}><strong>{item.name}</strong>{item.location}</li>)}
              </ul>
            </div>
          </div>

          <p>An in-person consultation is the time to discuss symptoms, childhood squint or vision issues, previous prescriptions, and a care plan suited to you.</p>
          <div className="button-row">
            <a className="hospital-button" href={hospital.phoneHref}>Call Mobile: {hospital.phone} <ArrowUpRight size={18}/></a>
            <a className="hospital-button button-outline" href={hospital.landlineHref}>Clinic Phone: {hospital.landline} <Phone size={17}/></a>
          </div>
          <div style={{ marginTop: '16px', display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
            <a className="source-link" href={hospital.doctor.framedCredential} target="_blank" rel="noreferrer">View Clinic Credential Certificate ↗</a>
            <a className="source-link" href={hospital.sources.qualifications} target="_blank" rel="noreferrer">Qualification reference · Maharashtra Medical Council ↗</a>
          </div>
        </div>
      </article>
    </section>
    <section className="values-section"><div className="hospital-container"><p className="eyebrow">DESIGNED AROUND THE PATIENT</p><h2>A simpler way to stay involved in your care.</h2><div className="values-grid">{[[HeartHandshake,'Understand your next step','Read clear explanations of your screening result and questions to discuss with your doctor.'],[FileCheck2,'Keep your report with you','Access saved screening history and download your personal report from the patient portal.'],[Eye,'Put the examination first','Screening offers guidance. Your clinician confirms a diagnosis and recommends appropriate treatment.']].map(([Icon,title,text])=><article key={title}>{createElement(Icon, { size: 28 })}<h3>{title}</h3><p>{text}</p></article>)}</div></div></section>
    <section className="hospital-section hospital-container visit-banner"><div><p className="eyebrow">WE’LL HELP YOU FIND YOUR NEXT STEP</p><h2>Let’s start with a conversation.</h2><p>Call to confirm timings, doctor availability and consultation fees.</p></div><Link to="/contact" className="hospital-button">Plan your visit <ArrowUpRight size={19}/></Link></section>
    <div className="hospital-container content-sources">Hospital and doctor details: <a href={hospital.sources.doctor} target="_blank" rel="noreferrer">public doctor listing</a> · <a href={hospital.sources.contact} target="_blank" rel="noreferrer">hospital contact listing</a>. Reviewed 7 October 2026. Please confirm current details with the hospital.</div>
  </HospitalLayout>;
}
