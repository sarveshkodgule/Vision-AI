import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { api } from '../lib/api';

export default function HospitalChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([{ role: 'bot', text: 'Hello, I’m the Vision AI assistant. I can explain screening and general eye-care information. For appointments, please call the hospital.' }]);
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
    {open && <section className="hospital-chat" aria-label="Vision AI assistant">
      <header><div><strong>Vision AI assistant</strong><small>General guidance · Not an emergency service</small></div><button aria-label="Close assistant" onClick={() => setOpen(false)}><X size={20}/></button></header>
      <div className="chat-messages" role="log" aria-live="polite">{messages.map((message, index) => <p key={index} className={`chat-${message.role}`}>{message.text}</p>)}{loading && <p role="status"><Loader2 className="animate-spin" size={18} /> Thinking...</p>}<div ref={end}/></div>
      <form onSubmit={send}><input aria-label="Your question" placeholder="Ask about your screening..." value={input} onChange={e => setInput(e.target.value)} maxLength={2000}/><button aria-label="Send message" disabled={loading || !input.trim()}><Send size={18}/></button></form>
    </section>}
    <button className="chat-toggle" aria-label={open ? 'Close eye-care assistant' : 'Open eye-care assistant'} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X size={22}/> : <MessageCircle size={22}/>}<span>Ask Vision AI</span></button>
  </>;
}
