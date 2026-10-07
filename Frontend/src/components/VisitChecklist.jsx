import { useState } from 'react';
import { Check, ClipboardCheck } from 'lucide-react';

const items = ['Current glasses and previous prescriptions', 'Earlier eye reports and screening PDF', 'A list of medicines and eye drops', 'Notes about symptoms and questions for the doctor'];

export default function VisitChecklist() {
  const [checked, setChecked] = useState([]);
  return <section className="packing-checklist" aria-labelledby="packing-heading">
    <div className="packing-heading"><ClipboardCheck size={24}/><div><h3 id="packing-heading">Your appointment checklist</h3><p>Tick items as you get ready. This list stays on this page.</p></div></div>
    <div className="packing-progress"><span style={{ width: `${checked.length / items.length * 100}%` }}/></div>
    <ul>{items.map(item => <li key={item}><label><input type="checkbox" checked={checked.includes(item)} onChange={() => setChecked(previous => previous.includes(item) ? previous.filter(value => value !== item) : [...previous, item])}/><span className="packing-box" aria-hidden="true">{checked.includes(item) && <Check size={14}/>}</span><span>{item}</span></label></li>)}</ul>
    <p className="packing-status" role="status">{checked.length === items.length ? 'All set. Remember to confirm your appointment with the hospital.' : `${checked.length} of ${items.length} items ready`}</p>
  </section>;
}
