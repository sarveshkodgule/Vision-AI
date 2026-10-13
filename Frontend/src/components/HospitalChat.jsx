import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { usePatientLanguage } from '../lib/patientLanguage';

export default function HospitalChat() {
  const { language, t } = usePatientLanguage();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const greeting = t('Hello, I’m the Vision AI assistant. I can explain screening and general eye-care information. For appointments, please call the hospital.', 'नमस्कार! मी Vision AI सहाय्यक आहे. प्राथमिक तपासणीचा अर्थ आणि डोळ्यांच्या काळजीबद्दल सामान्य माहिती समजावून सांगू शकतो. डॉक्टरांची वेळ घेण्यासाठी रुग्णालयाला फोन करा.');
  const [loading, setLoading] = useState(false);
  const end = useRef(null);
  useEffect(() => { if (open) end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages, open, loading]);
  async function send(event) {
    event.preventDefault();
    if (!input.trim() || loading) return;
    const message = input.trim();
    setMessages(previous => [...previous, { role: 'user', text: message }]);
    setInput(''); setLoading(true);
    try {
      const response = await api.post('/chatbot/general', { message });
      setMessages(previous => [...previous, { role: 'bot', text: response.data.response }]);
    } catch (error) {
      setMessages(previous => [...previous, { role: 'bot', text: error.message || 'The assistant is unavailable. Please try again.' }]);
    } finally { setLoading(false); }
  }
  return <>
    {open && <section className="hospital-chat" lang={language} aria-label={t('Vision AI assistant', 'Vision AI सहाय्यक')}>
      <header><div><strong>{t('Vision AI assistant', 'Vision AI सहाय्यक')}</strong><small>{t('General guidance · Not an emergency service', 'सामान्य माहिती · तातडीच्या उपचारांसाठी नाही')}</small></div><button aria-label={t('Close assistant', 'सहाय्यक बंद करा')} onClick={() => setOpen(false)}><X size={20}/></button></header>
      <div className="chat-messages" role="log" aria-live="polite"><p className="chat-bot">{greeting}</p>{messages.map((message, index) => <p key={index} className={`chat-${message.role}`}>{message.text}</p>)}{loading && <p role="status"><Loader2 className="animate-spin" size={18} /> {t('Thinking...', 'उत्तर तयार होत आहे…')}</p>}<div ref={end}/></div>
      <form onSubmit={send}><input aria-label={t('Your question', 'तुमचा प्रश्न')} placeholder={t('Ask about your screening...', 'तुमचा प्रश्न इथे लिहा…')} value={input} onChange={e => setInput(e.target.value)} maxLength={2000}/><button aria-label={t('Send message', 'प्रश्न पाठवा')} disabled={loading || !input.trim()}><Send size={18}/></button></form>
    </section>}
    <button className="chat-toggle" lang={language} aria-label={open ? t('Close eye-care assistant', 'डोळ्यांच्या काळजीचा सहाय्यक बंद करा') : t('Open eye-care assistant', 'डोळ्यांच्या काळजीचा सहाय्यक उघडा')} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X size={22}/> : <MessageCircle size={22}/>}<span>{t('Ask Vision AI', 'Vision AI ला विचारा')}</span></button>
  </>;
}
