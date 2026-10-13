import { Phone, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { hospital } from '../lib/hospital';
import { usePatientLanguage } from '../lib/patientLanguage';

const guidance = {
  Low: {
    label: ['Low screening risk', 'तपासणीतील कमी जोखीम'],
    meaning: ['Your model result is in the low band. This does not confirm normal vision or rule out an eye condition.', 'मॉडेलनुसार तुमची जोखीम कमी आहे. याचा अर्थ दृष्टी पूर्णपणे सामान्य आहे किंवा डोळ्यांचा आजार नाही, असा होत नाही.'],
    next: ['Continue routine eye care. Arrange an eye examination if you have blurred distance vision or other symptoms.', 'डोळ्यांची नियमित काळजी घ्या. दूरचे धूसर दिसत असल्यास किंवा इतर त्रास असल्यास नेत्रतपासणी करून घ्या.'],
  },
  Medium: {
    label: ['Moderate screening risk', 'तपासणीतील मध्यम जोखीम'],
    meaning: ['Your model result is in the moderate band. An eye examination is needed to check whether myopia is present.', 'मॉडेलनुसार तुमची जोखीम मध्यम आहे. मायोपिया आहे की नाही हे ठरवण्यासाठी नेत्रतपासणी आवश्यक आहे.'],
    next: ['Arrange an eye examination and bring your report, current glasses and previous prescriptions.', 'नेत्रतपासणीची वेळ ठरवा. हा अहवाल, सध्याचा चष्मा आणि जुनी प्रिस्क्रिप्शन्स सोबत आणा.'],
  },
  High: {
    label: ['High screening risk', 'तपासणीतील जास्त जोखीम'],
    meaning: ['A high screening score is not a diagnosis of high myopia or severe eye disease.', 'तपासणीतील जास्त जोखीम म्हणजे तीव्र मायोपिया किंवा गंभीर नेत्ररोगाचे निदान झाले आहे, असे नाही.'],
    next: ['Contact an eye-care professional promptly. Describe your symptoms so the clinic can decide how soon you need an examination.', 'लवकर नेत्रतज्ज्ञांशी संपर्क साधा. तुमचा त्रास सांगा, जेणेकरून तपासणी किती लवकर आवश्यक आहे हे डॉक्टर ठरवू शकतील.'],
  },
};

export default function ScreeningSummary({ result }) {
  const { language, t } = usePatientLanguage();
  const band = result.severity === 'Moderate' ? 'Medium' : result.severity;
  const plan = guidance[band];
  if (!plan) return null;
  return <section className={`screening-summary risk-${band.toLowerCase()}`} lang={language} aria-label={t('Your result at a glance', 'तुमच्या निकालाचा सारांश')}>
    <div className="summary-heading"><div><p className="screening-kicker">{t('YOUR RESULT AT A GLANCE', 'तुमच्या निकालाचा सारांश')}</p><h3>{t(...plan.label)}</h3></div><div className="summary-probability"><strong>{Number.isFinite(result.probability) ? `${(result.probability * 100).toFixed(1)}%` : '—'}</strong><span>{t('Model-estimated probability', 'मॉडेलने अंदाजित केलेली शक्यता')}</span></div></div>
    <p>{t(...plan.meaning)}</p>
    <p className="summary-explanation">{t('This questionnaire provides a model estimate, not a confirmed diagnosis, prescription strength or forecast of future vision.', 'ही प्रश्नावली मॉडेलचा अंदाज देते. हे निश्चित निदान, चष्म्याचा नंबर किंवा भविष्यातील दृष्टीचे भाकीत नाही.')}</p>
    <div className="summary-next"><span>01</span><div><h4>{t('Your next step', 'पुढील पाऊल')}</h4><p>{t(...plan.next)}</p></div></div>
    <div className="summary-next"><span>02</span><div><h4>{t('Keep your report ready', 'तुमचा अहवाल तयार ठेवा')}</h4><p>{t('View or download your PDF below, then take it to your consultation. A report email does not book an appointment.', 'खाली PDF पाहा किंवा डाउनलोड करा आणि तपासणीच्या वेळी सोबत आणा. ईमेलने अहवाल मिळाल्याने अपॉइंटमेंट निश्चित होत नाही.')}</p></div></div>
    <details className="summary-habits"><summary>{t('Everyday care to discuss with your doctor', 'डॉक्टरांशी चर्चा करण्यासाठी दैनंदिन काळजी')}</summary><ul><li>{t('Take regular breaks during prolonged reading and screen use. These can ease eye strain; they do not reverse myopia.', 'दीर्घकाळ वाचन किंवा स्क्रीन वापरताना नियमित विश्रांती घ्या. यामुळे डोळ्यांवरील ताण कमी होऊ शकतो; मायोपिया बरा होत नाही.')}</li><li>{t('Encourage safe outdoor activity for children. Ask your clinician about an appropriate routine and review schedule.', 'मुलांना सुरक्षितपणे बाहेर खेळण्यास प्रोत्साहन द्या. योग्य दिनक्रम आणि पुढील तपासणीबद्दल डॉक्टरांना विचारा.')}</li><li>{t('Use glasses and eye treatments as prescribed. Do not change your prescription or start eye drops without professional advice.', 'डॉक्टरांनी सांगितल्याप्रमाणे चष्मा आणि उपचार वापरा. स्वतःहून चष्म्याचा नंबर बदलू नका किंवा डोळ्यांचे थेंब सुरू करू नका.')}</li></ul></details>
    <div className="button-row"><a className="hospital-button" href={hospital.phoneHref}><Phone size={17}/>{t('Call for an appointment', 'अपॉइंटमेंटसाठी फोन करा')}</a><Link className="text-link" to="/contact">{t('Prepare for your visit', 'भेटीची तयारी करा')}<ArrowUpRight size={17}/></Link></div>
    <aside className="summary-urgent"><strong>{t('Sudden changes in vision?', 'दृष्टीमध्ये अचानक बदल?')}</strong> {t('Sudden vision loss, new flashes or floaters, or a curtain over your vision need urgent eye care. Do not wait for a report or email.', 'अचानक दृष्टी कमी होणे, नवीन प्रकाशाचे झोत किंवा तरंगते ठिपके दिसणे, अथवा दृष्टीवर पडदा आल्यास तातडीने नेत्रवैद्यकीय मदत घ्या. अहवाल किंवा ईमेलची वाट पाहू नका.')}</aside>
    <p className="summary-source">{t('Patient information:', 'रुग्णांसाठी माहिती:')} <a href="https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/nearsightedness-myopia" target="_blank" rel="noreferrer">National Eye Institute · Myopia</a> · <a href="https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/retinal-detachment" target="_blank" rel="noreferrer">{t('Urgent symptoms', 'तातडीची लक्षणे')}</a></p>
  </section>;
}
