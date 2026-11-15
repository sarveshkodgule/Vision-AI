import { useEffect, useRef, useState } from 'react';
import { Command, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const commands = [
  { label: 'Open patient portal', path: '/patient/dashboard' },
  { label: 'Open doctor portal', path: '/doctor/dashboard' },
  { label: 'View hospital information', path: '/about' },
  { label: 'Contact the hospital', path: '/contact' },
  { label: 'Privacy policy', path: '/privacy' },
  { label: 'Terms of use', path: '/terms' },
];

export default function CommandMenu() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = commands.filter(command => command.label.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    const handleShortcut = event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  const openMenu = () => { setQuery(''); setOpen(true); };
  const goTo = path => { setOpen(false); navigate(path); };

  return <>{open && <div className="command-backdrop" role="presentation" onMouseDown={() => setOpen(false)}><div className="command-menu" role="dialog" aria-modal="true" aria-label="Quick navigation" onMouseDown={event => event.stopPropagation()}><div className="command-search"><Search size={17}/><input ref={inputRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search pages…" aria-label="Search pages" /><kbd>Esc</kbd></div><div className="command-results">{filtered.length ? filtered.map(command => <button key={command.path} onClick={() => goTo(command.path)}>{command.label}<span>↵</span></button>) : <p>No matching page.</p>}</div></div></div>}<button className="command-trigger" onClick={openMenu} aria-label="Open quick navigation"><Command size={15}/><span>Quick navigation</span><kbd>Ctrl K</kbd></button></>;
}
