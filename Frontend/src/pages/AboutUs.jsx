import { usePatientLanguage } from '../lib/patientLanguage';
import { createElement } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, HeartHandshake, MapPin, FileCheck2, Eye, Phone, GraduationCap } from 'lucide-react';
import HospitalLayout from '../components/HospitalLayout';
import HospitalGallery from '../components/HospitalGallery';
import { hospital } from '../lib/hospital';

export default function AboutUs() {
  const { t } = usePatientLanguage();
  return <HospitalLayout>
    <section className="page-intro hospital-container"><p className="eyebrow">{t("OUR HOSPITAL · OUR COMMUNITY")}</p><h1>{t("Here for your eyes.")}<br/><em>{t("Here for you.")}</em></h1><p>{t("Get to know Shri Sarveshwar Netralaya, your local eye-care destination in Mitra Nagar, Chhatrapati Sambhajinagar.")}</p></section>
    <section className="hospital-container about-intro">
      <div className="hospital-address-art"><span className="eyebrow">श्री सर्वेश्वर नेत्रालय</span><img className="about-hospital-emblem" src="/sarveshwar-eye.png" width="2172" height="724" alt="" /><h2>{t("Rooted in")}<br/>{t("our community.")}</h2><span><MapPin size={16}/> {t("Mitra Nagar · Jalna Road")}</span></div>
      <div><p className="eyebrow">{t("EYE CARE, CLOSER TO HOME")}</p><h2>{t("A familiar place.")}<br/>{t("An important conversation.")}</h2><p>{t("Located near Gurudwara on Jalna Road, the hospital is listed locally as Sri Sarveshwar Netralaya. Dr. Hemant Anaspure is its publicly listed ophthalmologist.")}</p><p>{t("This digital care portal is being developed for the hospital to help patients understand their screening results, keep their reports together, and prepare for an eye examination.")}</p><p>{t("For consultation availability, examinations and treatment options, please speak directly with the hospital.")}</p><a href={hospital.phoneHref} className="text-link">{t("Talk to the hospital")} <Phone size={17}/></a></div>
    </section>
    <HospitalGallery />
    <section id="doctor" className="hospital-section hospital-container">
      <div className="section-heading"><div><p className="eyebrow">{t("MEET YOUR DOCTOR · KNOW YOUR DOCTOR")}</p><h2>{t("The person behind your care.")}</h2></div></div>
      <article className="doctor-profile">
        <div className="doctor-profile-art">
          <img className="doctor-profile-photo" src="/hospital/doctor-portrait.jpg" alt={t(hospital.doctor.name, hospital.doctor.marathiName)} width="1078" height="720" loading="lazy" />
          <p>{t("OPHTHALMOLOGY & STRABISMUS")}</p>
          <span className="doctor-art-line"/>
        </div>
        <div className="doctor-profile-copy">
          <p className="eyebrow">{t(hospital.doctor.role, "नेत्ररोगतज्ज्ञ आणि नेत्रशल्यचिकित्सक")} · {hospital.doctor.marathiName}</p>
          <h3>{t(hospital.doctor.name, hospital.doctor.marathiName)}</h3>
          <div className="doctor-specialty-callout">
            <strong>{t("Super Specialization:")}</strong> {t(hospital.doctor.superSpecialization, hospital.doctor.marathiSpecialization)}
          </div>
          <p className="doctor-qualifications"><GraduationCap size={20}/><strong>{hospital.doctor.qualifications}</strong></p>
          <p>{t("Dr. Hemant D. Anaspure is a senior ophthalmologist and eye surgeon specializing in comprehensive ophthalmology, paediatric eye care, and squint (strabismus) treatment at Shri Sarveshwar Netralaya, Jalna Road, Chhatrapati Sambhajinagar.")}</p>
          
          <div className="doctor-pedigree">
            <div>
              <h4>{t("Academic & Medical Training")}</h4>
              <ul>
                {hospital.doctor.education.map(item => <li key={item.degree}><strong>{item.degree}</strong>{item.institution}</li>)}
              </ul>
            </div>
            <div>
              <h4>{t("Past Hospital Associations")}</h4>
              <ul>
                {hospital.doctor.pastAssociations.map(item => <li key={item.name}><strong>{item.name}</strong>{item.location}</li>)}
              </ul>
            </div>
          </div>

          <p>{t("An in-person consultation is the time to discuss symptoms, childhood squint or vision issues, previous prescriptions, and a care plan suited to you.")}</p>
          <div className="button-row">
            <a className="hospital-button" href={hospital.phoneHref}>{t("Call Mobile:")} {hospital.phone} <ArrowUpRight size={18}/></a>
            <a className="hospital-button button-outline" href={hospital.landlineHref}>{t("Clinic Phone:")} {hospital.landline} <Phone size={17}/></a>
          </div>
          <div style={{ marginTop: '16px', display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
            <a className="source-link" href={hospital.sources.qualifications} target="_blank" rel="noreferrer">{t("Qualification reference · Maharashtra Medical Council ↗")}</a>
          </div>
        </div>
      </article>
    </section>
    <section className="values-section"><div className="hospital-container"><p className="eyebrow">{t("DESIGNED AROUND THE PATIENT")}</p><h2>{t("A simpler way to stay involved in your care.")}</h2><div className="values-grid">{[[HeartHandshake,'Understand your next step','Read clear explanations of your screening result and questions to discuss with your doctor.'],[FileCheck2,'Keep your report with you','Access saved screening history and download your personal report from the patient portal.'],[Eye,'Put the examination first','Screening offers guidance. Your clinician confirms a diagnosis and recommends appropriate treatment.']].map(([Icon,title,text])=><article key={title}>{createElement(Icon, { size: 28 })}<h3>{t(title)}</h3><p>{t(text)}</p></article>)}</div></div></section>
    <section className="hospital-section hospital-container visit-banner"><div><p className="eyebrow">{t("WE’LL HELP YOU FIND YOUR NEXT STEP")}</p><h2>{t("Let’s start with a conversation.")}</h2><p>{t("Call to confirm timings, doctor availability and consultation fees.")}</p></div><Link to="/contact" className="hospital-button">{t("Plan your visit")} <ArrowUpRight size={19}/></Link></section>
    <div className="hospital-container content-sources">{t("Hospital and doctor details:")} <a href={hospital.sources.doctor} target="_blank" rel="noreferrer">{t("public doctor listing")}</a> · <a href={hospital.sources.contact} target="_blank" rel="noreferrer">{t("hospital contact listing")}</a>{t(". Reviewed 7 October 2026. Please confirm current details with the hospital.")}</div>
  </HospitalLayout>;
}
