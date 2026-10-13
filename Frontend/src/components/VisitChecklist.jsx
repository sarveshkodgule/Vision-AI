import { useState } from 'react';
import { Check, ClipboardCheck } from 'lucide-react';
import { usePatientLanguage } from '../lib/patientLanguage';

const items = ['Current glasses and previous prescriptions', 'Earlier eye reports and screening PDF', 'A list of medicines and eye drops', 'Notes about symptoms and questions for the doctor'];
const marathiItems = ['सध्याचा चष्मा आणि जुनी प्रिस्क्रिप्शन्स', 'पूर्वीचे नेत्रतपासणी अहवाल आणि तपासणीचा PDF', 'औषधे आणि डोळ्यांच्या थेंबांची यादी', 'लक्षणांची नोंद आणि डॉक्टरांना विचारायचे प्रश्न'];

export default function VisitChecklist() {
  const [checked, setChecked] = useState([]);
  const { language, t } = usePatientLanguage();
  return <section className="packing-checklist" lang={language} aria-labelledby="packing-heading">
    <div className="packing-heading"><ClipboardCheck size={24}/><div><h3 id="packing-heading">{t('Your appointment checklist', 'भेटीसाठी तयारीची यादी')}</h3><p>{t('Tick items as you get ready. This list stays on this page.', 'तयारी झाल्यावर खूण करा. ही यादी फक्त या पानावर राहते.')}</p></div></div>
    <div className="packing-progress"><span style={{ width: `${checked.length / items.length * 100}%` }}/></div>
    <ul>{items.map((item, index) => <li key={item}><label><input type="checkbox" checked={checked.includes(item)} onChange={() => setChecked(previous => previous.includes(item) ? previous.filter(value => value !== item) : [...previous, item])}/><span className="packing-box" aria-hidden="true">{checked.includes(item) && <Check size={14}/>}</span><span>{t(item, marathiItems[index])}</span></label></li>)}</ul>
    <p className="packing-status" role="status">{checked.length === items.length ? t('All set. Remember to confirm your appointment with the hospital.', 'तयारी पूर्ण झाली. रुग्णालयाशी संपर्क साधून अपॉइंटमेंट निश्चित करा.') : t(`${checked.length} of ${items.length} items ready`, `${items.length} पैकी ${checked.length} गोष्टी तयार`)}</p>
  </section>;
}
