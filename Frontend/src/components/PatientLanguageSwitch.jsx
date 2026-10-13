import { usePatientLanguage } from '../lib/patientLanguage';

export default function PatientLanguageSwitch() {
  const { language, setLanguage } = usePatientLanguage();
  return <div className="guidance-language" role="group" aria-label="Patient guidance language">
    <span>Patient guidance / रुग्ण मार्गदर्शन</span>
    <div>{[['en', 'English'], ['mr', 'मराठी']].map(([code, label]) => <button key={code} type="button" lang={code} aria-pressed={language === code} onClick={() => setLanguage(code)}>{label}</button>)}</div>
  </div>;
}
