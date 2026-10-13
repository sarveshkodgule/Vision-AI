import { Phone, MapPin } from 'lucide-react';
import PatientLanguageSwitch from './PatientLanguageSwitch';
import { usePatientLanguage } from '../lib/patientLanguage';
import { hospital } from '../lib/hospital';

export default function VisitGuidance() {
  const { language, t } = usePatientLanguage();
  return <section className="visit-guidance hospital-container" lang={language} aria-label={t('Visit information', 'भेटीची माहिती')}>
    <PatientLanguageSwitch/><div className="visit-guidance-copy"><h2>{t('A little help before your visit.', 'भेटीपूर्वी थोडे मार्गदर्शन.')}</h2><p>{t('Call to confirm your appointment, doctor availability and fees before travelling. Bring your glasses, medicines list and earlier eye reports. A parent or guardian should accompany a child.', 'येण्यापूर्वी फोन करून डॉक्टरांची वेळ आणि तपासणीची फी विचारून घ्या. चष्मा, चालू औषधांची यादी आणि डोळ्यांचे जुने रिपोर्ट सोबत आणा. लहान मुलासोबत आई-वडील किंवा त्याची काळजी घेणारी मोठी व्यक्ती असावी.')}</p><p>{t('Find us at Plot No. 5, Mitra Nagar, Jalna Road, near Gurudwara, Chhatrapati Sambhajinagar.', 'पत्ता: प्लॉट नं. ५, मित्रनगर, जालना रोड, गुरुद्वाराजवळ, छत्रपती संभाजीनगर.')}</p><div className="button-row"><a className="hospital-button" href={hospital.phoneHref}><Phone size={17}/>{t('Call the hospital', 'रुग्णालयाला फोन करा')}</a><a className="text-link" href={hospital.directions} target="_blank" rel="noreferrer"><MapPin size={17}/>{t('Get directions', 'नकाशा पाहा')}</a></div></div>
  </section>;
}
