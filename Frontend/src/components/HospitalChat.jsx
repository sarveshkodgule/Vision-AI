import { createElement, useEffect, useRef, useState } from 'react';
import { X, Send, Loader2, Languages, Phone, Clock3, MapPin, ClipboardCheck } from 'lucide-react';
import { api } from '../lib/api';
import { hospital } from '../lib/hospital';
import { usePatientLanguage } from '../lib/patientLanguage';

function CareCompanion() {
  return <svg className="care-companion" viewBox="0 0 64 64" aria-hidden="true">
    <rect x="5" y="5" width="54" height="54" rx="20" fill="#e4f3f0"/>
    <path d="M12 32c10-17 30-17 40 0-10 17-30 17-40 0Z" fill="white" stroke="#17365d" strokeWidth="2"/>
    <circle cx="32" cy="32" r="9" fill="#387e83"/><circle cx="32" cy="32" r="4" fill="#17365d"/>
    <circle cx="35" cy="29" r="2" fill="white"/>
    <path d="M25 47q7 5 14 0" fill="none" stroke="#17365d" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="50" cy="13" r="10" fill="#823c46"/><path d="M50 9v8m-4-4h8" stroke="white" strokeWidth="2" strokeLinecap="round"/>
  </svg>;
}

export default function HospitalChat() {
  const { language, setLanguage, t } = usePatientLanguage();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const end = useRef(null), launcher = useRef(null), inputRef = useRef(null), busy = useRef(false);
  const topics = [
    { id: 'hours', icon: Clock3, label: t('Clinic timings', 'रुग्णालयाची वेळ'), answer: t(`${hospital.hours}. ${hospital.closed}. Call ${hospital.phone} to confirm doctor availability.`, `${hospital.marathiHours}. ${hospital.marathiClosed}. डॉक्टरांची उपलब्धता विचारण्यासाठी ${hospital.phone} वर फोन करा.`) },
    { id: 'visit', icon: Phone, label: t('Book a visit', 'भेटीची वेळ घ्या'), answer: t(`Please call ${hospital.phone} or ${hospital.landline} to arrange your visit. An online screening does not book an appointment.`, `भेटीची वेळ ठरवण्यासाठी ${hospital.phone} किंवा ${hospital.landline} वर फोन करा. ऑनलाइन तपासणी केल्याने भेटीची वेळ निश्चित होत नाही.`) },
    { id: 'directions', icon: MapPin, label: t('Find the clinic', 'रुग्णालयाचा पत्ता'), answer: t(hospital.address, hospital.marathiAddress) },
    { id: 'prepare', icon: ClipboardCheck, label: t('What to bring', 'सोबत काय आणावे'), answer: t('Bring your glasses, earlier prescriptions and eye reports, medicines list, and your screening PDF. A parent or guardian should accompany a child.', 'चष्मा, जुनी प्रिस्क्रिप्शन्स व नेत्रतपासणी अहवाल, औषधांची यादी आणि तपासणीचा PDF सोबत आणा. लहान मुलासोबत पालक असावेत.') },
  ];
  useEffect(() => { if (open) end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages, open, loading]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  function close() { setOpen(false); launcher.current?.focus(); }
  async function send(event) {
    event.preventDefault();
    if (!input.trim() || busy.current) return;
    const message = input.trim(), replyLanguage = language;
    setMessages(previous => [...previous, { role: 'user', text: message, language: replyLanguage }]);
    setInput(''); setLoading(true); busy.current = true;
    try {
      const response = await api.post('/chatbot/general', { message, language: replyLanguage });
      setMessages(previous => [...previous, { role: 'bot', text: response.data.response, language: replyLanguage }]);
    } catch {
      setMessages(previous => [...previous, { role: 'bot', failed: true }]);
    } finally { setLoading(false); busy.current = false; }
  }
  return <>
    {open && <section id="hospital-assistant" className="hospital-chat" lang={language} aria-label={t('Hospital assistant', 'रुग्णालय सहाय्यक')} onKeyDown={event => { if (event.key === 'Escape') close(); }}>
      <header><CareCompanion/><div><strong>{t('Sarveshwar care assistant', 'सर्वेश्वर सेवा सहाय्यक')}</strong><small>{t('AI guidance · Here to help you plan', 'AI मार्गदर्शन · भेटीच्या नियोजनासाठी मदत')}</small></div><button type="button" aria-label={t('Close assistant', 'सहाय्यक बंद करा')} onClick={close}><X size={20}/></button></header>
      <div className="chat-language-row"><span>{t('How can we help?', 'आम्ही कशी मदत करू?')}</span><button type="button" onClick={() => setLanguage(language === 'en' ? 'mr' : 'en')} aria-label={language === 'en' ? 'मराठीत वाचा' : 'Switch to English'}><Languages size={15}/>{language === 'en' ? 'मराठी' : 'English'}</button></div>
      <div className="chat-messages" role="log" aria-live="polite">
        <p className="chat-bot">{t('Hello! Welcome to Shri Sarveshwar Netralaya. Let’s make your visit a little easier. Choose a topic below or ask me a question.', 'नमस्कार! श्री सर्वेश्वर नेत्रालयात आपले स्वागत आहे. तुमच्या भेटीची तयारी करूया. खाली विषय निवडा किंवा तुमचा प्रश्न विचारा.')}</p>
        <div className="chat-topics">{topics.map(({ id, icon: Icon, label }) => <button key={id} type="button" disabled={loading} onClick={() => setMessages(previous => [...previous, { role: 'user', topic: id }, { role: 'bot', topic: id }])}>{createElement(Icon, { size: 16 })}{label}</button>)}</div>
        {messages.map((message, index) => <p key={index} lang={message.topic || message.failed ? language : message.language} className={`chat-${message.role}`}>{message.failed ? t('I couldn’t connect just now. Please try again, or call the hospital for help.', 'आत्ता संपर्क झाला नाही. पुन्हा प्रयत्न करा किंवा मदतीसाठी रुग्णालयाला फोन करा.') : message.topic ? topics.find(topic => topic.id === message.topic)?.[message.role === 'user' ? 'label' : 'answer'] : message.text}</p>)}
        {loading && <p role="status"><Loader2 className="animate-spin" size={18}/> {t('Preparing your answer…', 'तुमचे उत्तर तयार होत आहे…')}</p>}
        <div ref={end}/>
      </div>
      <form onSubmit={send}><input ref={inputRef} aria-label={t('Your question', 'तुमचा प्रश्न')} placeholder={t('Type your question…', 'तुमचा प्रश्न लिहा…')} value={input} onChange={event => setInput(event.target.value)} maxLength={2000}/><button aria-label={t('Send message', 'प्रश्न पाठवा')} disabled={loading || !input.trim()}><Send size={18}/></button></form>
      <div className="chat-footer"><span>{t('General guidance, not a diagnosis.', 'सामान्य मार्गदर्शन, वैद्यकीय निदान नाही.')}</span><a href={hospital.phoneHref}><Phone size={13}/>{t('Call clinic', 'फोन करा')}</a></div>
    </section>}
    <button ref={launcher} className="chat-toggle care-chat-launcher" lang={language} aria-controls="hospital-assistant" aria-label={open ? t('Close hospital assistant', 'रुग्णालय सहाय्यक बंद करा') : t('Open hospital assistant', 'रुग्णालय सहाय्यक उघडा')} aria-expanded={open} onClick={() => open ? close() : setOpen(true)}>
      {open ? <X size={24}/> : <CareCompanion/>}<span><strong>{t('Need a little help?', 'काही मदत हवी आहे?')}</strong><small>{t('Chat with our care assistant', 'आमच्या सहाय्यकाशी बोला')}</small></span>
    </button>
  </>;
}
