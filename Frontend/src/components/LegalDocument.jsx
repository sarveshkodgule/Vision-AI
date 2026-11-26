import { createElement } from 'react';
import { ArrowLeft, ChevronRight, FileText, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import HospitalLayout from './HospitalLayout';
import { hospital } from '../lib/hospital';

export default function LegalDocument({ type, title, summary, audience, version, updated, sections, notices }) {
  const navigate = useNavigate();
  const icon = type === 'privacy' ? ShieldCheck : FileText;
  const other = type === 'privacy' ? { to: '/terms', label: 'Terms & Conditions' } : { to: '/privacy', label: 'Privacy Policy' };
  return <HospitalLayout><section className="legal-document hospital-container">
    <button type="button" onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/')} className="legal-back"><ArrowLeft size={16} /> Back</button>
    <header className="legal-header"><div className="legal-icon">{createElement(icon, { size: 25 })}</div><div><p className="legal-kicker">{hospital.name} · Vision AI care portal</p><h1>{title}</h1><p>{summary}</p><dl className="legal-meta"><div><dt>Version</dt><dd>{version}</dd></div><div><dt>Effective / updated</dt><dd>{updated}</dd></div><div><dt>Applies to</dt><dd>{audience}</dd></div></dl></div></header>
    {notices?.map((notice, index) => <aside key={index} className={`legal-notice ${notice.tone || ''}`}><strong>{notice.title}</strong><p>{notice.body}</p></aside>)}
    <div className="legal-layout"><nav className="legal-toc" aria-label={`${title} table of contents`}><strong>On this page</strong>{sections.map((section, index) => <a key={section.id} href={`#${section.id}`}><span>{index + 1}</span>{section.title}</a>)}</nav><article className="legal-content">{sections.map((section, index) => <section id={section.id} key={section.id}><h2><span>{index + 1}</span>{section.title}</h2>{section.content}</section>)}<footer className="legal-footer"><p>Document version {version} · {updated}</p><div><Link to={other.to}>{other.label}<ChevronRight size={15} /></Link><Link to="/login?reauth=1">Back to sign in<ChevronRight size={15} /></Link></div></footer></article></div>
  </section></HospitalLayout>;
}
