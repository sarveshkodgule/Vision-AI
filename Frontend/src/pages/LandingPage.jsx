import { createElement } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, FileText, Phone, MapPin, ClipboardCheck, ScanEye, HeartHandshake } from 'lucide-react';
import HospitalLayout from '../components/HospitalLayout';
import HospitalChat from '../components/HospitalChat';
import CareNavigator from '../components/CareNavigator';
import { hospital, patientFaqs } from '../lib/hospital';
import { patientFaqsMr } from '../lib/hospitalMarathi';
import { usePatientLanguage } from '../lib/patientLanguage';

export default function LandingPage() {
  const { language, t } = usePatientLanguage();
  const journey = [
    [ClipboardCheck, '01', t('Tell us about your routine', 'तुमच्या रोजच्या सवयी सांगा'), t('Complete the lifestyle and family-history questionnaire.', 'रोजच्या सवयी आणि कुटुंबातील डोळ्यांच्या त्रासाबद्दल काही प्रश्नांची उत्तरे द्या.')],
    [ScanEye, '02', t('Understand your screening', 'निकालाचा अर्थ समजून घ्या'), t('See your model-estimated risk with a plain-language explanation.', 'मॉडेलने दिलेला जोखमीचा अंदाज आणि त्याचा अर्थ सोप्या भाषेत वाचा.')],
    [FileText, '03', t('Take your report to the doctor', 'रिपोर्ट डॉक्टरांना दाखवा'), t('Download the PDF and discuss the result at your eye examination.', 'PDF डाउनलोड करा आणि प्रत्यक्ष तपासणीच्या वेळी डॉक्टरांशी चर्चा करा.')],
  ];
  return <HospitalLayout>
    <section className="hospital-hero hospital-container">
      <div className="hero-copy">
        <p className="eyebrow"><span/> {t('EYE CARE IN CHHATRAPATI SAMBHAJINAGAR', 'छत्रपती संभाजीनगरमधील नेत्ररुग्णालय')}</p>
        <h1>{t('For every view', 'तुमच्या डोळ्यांची काळजी,')}<br/>{t('that ', '')}<em>{t('matters.', 'आपुलकीने.')}</em></h1>
        <p className="hero-description">{t('Your child’s first book. A familiar face. The road ahead. Take the next step in caring for your vision with Shri Sarveshwar Netralaya.', 'वाचताना, काम करताना किंवा रोजच्या धावपळीत—डोळ्यांची काळजी घ्या. तुमच्या आणि तुमच्या कुटुंबाच्या डोळ्यांच्या तपासणीसाठी श्री सर्वेश्वर नेत्रालयाशी संपर्क साधा.')}</p>
        <div className="button-row"><a className="hospital-button" href={hospital.phoneHref}>{t('Call for an appointment', 'भेटीची वेळ ठरवण्यासाठी फोन करा')} <ArrowUpRight size={19}/></a><Link className="hospital-button button-outline" to="/login">{t('Start eye screening', 'ऑनलाइन प्राथमिक तपासणी')} <ArrowRight size={18}/></Link></div>
        <p className="hero-screening-note">{t('A questionnaire-based estimate. A doctor’s examination confirms your eye health.', 'प्रश्नांच्या उत्तरांवरून फक्त अंदाज मिळतो. खात्रीसाठी डॉक्टरांकडून डोळे तपासून घ्या.')}</p>
        <div className="hero-doctor"><span className="doctor-initials small" aria-hidden="true">HA</span><div><strong>{t(hospital.doctor.name, hospital.doctor.marathiName)}</strong><span>{t('Ophthalmologist · Meet your doctor', 'डोळ्यांचे डॉक्टर · त्यांच्याबद्दल जाणून घ्या')}</span></div><Link to="/about#doctor" aria-label={t('Read about your doctor', 'डॉक्टरांची ओळख वाचा')}><ArrowUpRight size={23}/></Link></div>
      </div>
      <div className="hero-art" aria-label={t('Shri Sarveshwar Netralaya eye emblem and decorative vision chart', 'श्री सर्वेश्वर नेत्रालयाचे डोळ्याचे बोधचिन्ह')}>
        <div className="art-caption"><span lang="mr">श्री सर्वेश्वर नेत्रालय</span><span>{t('CARE FOR YOUR VISION', 'जपुया तुमची दृष्टी')}</span></div>
        <div className="hospital-emblem-display"><img src="/sarveshwar-eye.png" width="2172" height="724" alt={t('Shri Sarveshwar Netralaya eye emblem', 'श्री सर्वेश्वर नेत्रालयाचे बोधचिन्ह')} fetchPriority="high" /></div>
        <div className="vision-chart" aria-hidden="true"><span>E</span><span>F P</span><span>T O Z</span><i/></div>
        <div className="art-note"><span className="art-note-icon"><HeartHandshake size={23}/></span><div><strong>{t('A little attention today.', 'आज थोडी काळजी घ्या.')}</strong><p>{t('A clearer understanding tomorrow.', 'डोळ्यांबद्दल नीट समजून घ्या.')}</p></div></div>
        <span className="art-footnote">{t('VISION AI · SCREENING & PATIENT CARE', 'VISION AI · प्राथमिक तपासणी आणि मार्गदर्शन')}</span>
      </div>
    </section>
    <div className="hospital-container"><div className="quick-access">
      <a href={hospital.phoneHref}><Phone/><div><small>{t('LET’S TALK', 'आमच्याशी बोला')}</small><strong>{hospital.phone}</strong><span>{t('Call to confirm an appointment', 'फोन करून भेटीची वेळ नक्की करा')}</span></div><ArrowUpRight/></a>
      <a href={hospital.directions} target="_blank" rel="noreferrer"><MapPin/><div><small>{t('FIND THE HOSPITAL', 'रुग्णालयात कसं यायचं?')}</small><strong>{t('Mitra Nagar, Jalna Road', 'मित्रनगर, जालना रोड')}</strong><span>{t('Near Gurudwara · Get directions', 'गुरुद्वाराजवळ · नकाशा पाहा')}</span></div><ArrowUpRight/></a>
      <Link to="/login"><FileText/><div><small>{t('YOUR CARE, CONNECTED', 'तुमची माहिती एकाच ठिकाणी')}</small><strong>{t('Patient portal', 'तुमचं रुग्ण खाते')}</strong><span>{t('Screening, history & PDF reports', 'तपासणी, जुने निकाल आणि PDF रिपोर्ट')}</span></div><ArrowUpRight/></Link>
    </div></div>
    <section id="care" className="hospital-section hospital-container">
      <div className="section-heading"><div><p className="eyebrow">{t('A GOOD PLACE TO BEGIN', 'सुरुवात इथून करा')}</p><h2>{t('Care that starts', 'आधी समजून घेऊया.')}<br/>{t('with understanding.', 'मग पुढचं ठरवूया.')}</h2></div><p>{t('Whether you have a question about your eyesight or want to understand a screening result, find your next step here.', 'डोळ्यांबद्दल शंका आहे, ऑनलाइन तपासणी करायची आहे किंवा जुना रिपोर्ट हवा आहे? तुम्हाला हवी असलेली मदत इथे निवडा.')}</p></div>
      <CareNavigator />
    </section>
    <section className="portal-band"><div className="hospital-container portal-grid"><div><p className="eyebrow">{t('MEET YOUR DIGITAL CARE COMPANION', 'तुमच्या सोयीसाठी ऑनलाइन मदत')}</p><h2>{t('A little clarity.', 'डॉक्टरांना भेटण्याआधी,')}<br/>{t('Before your consultation.', 'थोडी माहिती घेऊया.')}</h2><p>{t('Vision AI brings your screening, explanations and reports into one place. Use it to prepare for a conversation with your eye-care professional.', 'Vision AI मध्ये प्राथमिक तपासणी, निकालाचा अर्थ आणि तुमचे रिपोर्ट एकाच ठिकाणी मिळतात. डॉक्टरांना काय विचारायचं, याची तयारी करायला याचा उपयोग होतो.')}</p><Link to="/login" className="hospital-button button-cream">{t('Explore your portal', 'तुमचं खाते उघडा')} <ArrowRight size={18}/></Link></div><div className="journey-list">{journey.map(([Icon, number, title, text]) => <div key={number}><span className="journey-icon">{createElement(Icon, { size: 23 })}</span><div><small>{t('STEP', 'पाऊल')} {number}</small><h3>{title}</h3><p>{text}</p></div></div>)}</div></div></section>
    <section className="hospital-section hospital-container faq-grid"><div><p className="eyebrow">{t('BEFORE YOU VISIT', 'येण्यापूर्वी जाणून घ्या')}</p><h2>{t('A few things', 'तुमच्या मनातले प्रश्न,')}<br/>{t('you may be wondering.', 'आणि सोपी उत्तरे.')}</h2><Link to="/contact" className="text-link">{t('More help planning your visit', 'भेटीबद्दल अधिक माहिती')} <ArrowRight size={18}/></Link></div><div className="hospital-faq">{(language === 'mr' ? patientFaqsMr : patientFaqs).map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></section>
    <section className="hospital-container closing-invitation"><div className="invitation-emblem" aria-hidden="true"><img src="/sarveshwar-eye.png" width="2172" height="724" alt="" /></div><div><p className="eyebrow">{t('A FAMILIAR FACE. A CLEARER NEXT STEP.', 'तुमचं म्हणणं ऐकून घेणारी काळजी.')}</p><h2>{t('Good care begins', 'तुमचा त्रास सांगा.')}<br/>{t('with being heard.', 'योग्य सल्ला घ्या.')}</h2><p>{t('Meet Dr. Hemant D. Anaspure, ophthalmologist at Shri Sarveshwar Netralaya.', 'श्री सर्वेश्वर नेत्रालयातील डोळ्यांचे डॉक्टर, डॉ. हेमंत दे. अनासपुरे यांच्याबद्दल जाणून घ्या.')}</p><Link className="text-link" to="/about#doctor">{t('Get to know your doctor', 'डॉक्टरांची ओळख')} <ArrowUpRight size={18}/></Link></div><a className="hospital-button" href={hospital.phoneHref}>{t('Let’s talk', 'फोन करा')} <Phone size={17}/></a></section>
    <HospitalChat/>
  </HospitalLayout>;
}
