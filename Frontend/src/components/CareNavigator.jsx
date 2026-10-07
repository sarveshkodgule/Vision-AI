import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarDays, ClipboardCheck, FileText, Check } from 'lucide-react';
import { hospital } from '../lib/hospital';

const paths = [
  { id: 'visit', label: 'Visit the hospital', icon: CalendarDays, eyebrow: 'LET’S MAKE YOUR VISIT EASIER', title: 'A conversation is a good first step.', description: 'Call the hospital to find a suitable consultation time. Our visit guide helps you arrive with the information your doctor needs.', points: ['Confirm doctor availability and consultation fees', 'Bring your glasses and earlier eye reports', 'Make a note of the questions you want to ask'], action: 'Call for an appointment', href: hospital.phoneHref, secondary: 'Read the visit guide', to: '/contact', note: 'Appointments are confirmed directly by the hospital.' },
  { id: 'screen', label: 'Start a screening', icon: ClipboardCheck, eyebrow: 'GET TO KNOW YOUR SCREENING RISK', title: 'Understand your result. Know your next step.', description: 'Share your everyday routine and family history in the patient portal. Get a model-estimated screening result with an explanation you can discuss with your doctor.', points: ['Complete your personal and lifestyle details', 'Read your result and personalised guidance', 'Download your PDF for your eye examination'], action: 'Open the screening portal', to: '/login', note: 'A screening result does not confirm a diagnosis.' },
  { id: 'report', label: 'Find my report', icon: FileText, eyebrow: 'YOUR INFORMATION, TOGETHER', title: 'Pick up where you left off.', description: 'Your screening history brings previous results and downloadable reports into one place. Sign in with the email you used to register.', points: ['Open Screening History in your patient portal', 'Download the PDF for the screening you need', 'Check email status or retry a failed report email'], action: 'Sign in to view reports', to: '/login', note: 'Reports are available to the account that completed the screening.' },
];

export default function CareNavigator() {
  const [selected, setSelected] = useState(0);
  const tabs = useRef([]);
  const current = paths[selected];
  const Icon = current.icon;
  function navigateTabs(event, index) {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % paths.length;
    if (event.key === 'ArrowLeft') next = (index + paths.length - 1) % paths.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = paths.length - 1;
    if (next !== undefined) { event.preventDefault(); setSelected(next); tabs.current[next]?.focus(); }
  }
  return <div className="care-navigator">
    <div className="care-tabs" role="tablist" aria-label="Choose your next step">
      {paths.map((item, index) => <button key={item.id} ref={element => { tabs.current[index] = element; }} id={`care-tab-${item.id}`} role="tab" aria-selected={selected === index} aria-controls={`care-panel-${item.id}`} tabIndex={selected === index ? 0 : -1} onClick={() => setSelected(index)} onKeyDown={event => navigateTabs(event, index)}><span>0{index + 1}</span>{item.label}<ArrowUpRight size={17}/></button>)}
    </div>
    <div className="care-path" role="tabpanel" id={`care-panel-${current.id}`} aria-labelledby={`care-tab-${current.id}`} tabIndex={0}>
      <div className="care-path-copy"><p className="eyebrow">{current.eyebrow}</p><h3>{current.title}</h3><p>{current.description}</p><div className="button-row">{current.href ? <a className="hospital-button" href={current.href}>{current.action}<ArrowUpRight size={18}/></a> : <Link className="hospital-button" to={current.to}>{current.action}<ArrowUpRight size={18}/></Link>}{current.secondary && <Link to={current.to} className="text-link">{current.secondary}</Link>}</div></div>
      <div className="care-path-checklist"><Icon size={32} strokeWidth={1.4}/><h4>What to expect</h4><ul>{current.points.map(point => <li key={point}><Check size={16}/>{point}</li>)}</ul><p>{current.note}</p></div>
    </div>
  </div>;
}
