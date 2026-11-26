import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

export default function OnboardingFlow({ name, onComplete }) {
  const [step, setStep] = useState(0);
  const steps = [
    ['Start with your routine', 'Answer a few lifestyle questions for an educational screening estimate.'],
    ['Read the result carefully', 'Your report supports a conversation with an eye-care professional; it is not a diagnosis.'],
    ['Keep your next step close', 'Save your report, review your history, and contact the hospital when you need care.'],
  ];
  const complete = () => {
    localStorage.setItem('visionai_onboarding_complete', 'true');
    onComplete();
  };
  return <div className="onboarding-backdrop" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
    <div className="onboarding-card">
      <p className="eyebrow">{name ? `Patient portal · ${name}` : 'Patient portal'}</p>
      <h2 id="onboarding-title">{steps[step][0]}</h2><p>{steps[step][1]}</p>
      <div className="onboarding-progress" aria-label={`Step ${step + 1} of ${steps.length}`}>{steps.map((_, index) => <span className={index === step ? 'active' : ''} key={index} />)}</div>
      <div className="button-row">{step < steps.length - 1 ? <><button className="hospital-button button-outline" onClick={complete}>Skip</button><button className="hospital-button" onClick={() => setStep(step + 1)}>Next</button></> : <button className="hospital-button" onClick={complete}><CheckCircle2 size={17}/> Get started</button>}</div>
    </div>
  </div>;
}
