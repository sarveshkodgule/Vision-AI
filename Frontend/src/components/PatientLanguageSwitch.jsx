import { usePatientLanguage } from '../lib/patientLanguage';

export default function PatientLanguageSwitch({ compact = false }) {
  const { language, setLanguage } = usePatientLanguage();
  return <div className={`guidance-language${compact ? ' website-language' : ''}`} role="group" aria-label={compact ? 'Website language / भाषा निवडा' : 'Patient guidance language'}>
    <span>{compact ? 'Language / भाषा' : 'Patient guidance / रुग्ण मार्गदर्शन'}</span>
    <div>{[['en', 'English'], ['mr', 'मराठी']].map(([code, label]) => <button key={code} type="button" lang={code} aria-pressed={language === code} onClick={() => setLanguage(code)}>{label}</button>)}</div>
  </div>;
}
