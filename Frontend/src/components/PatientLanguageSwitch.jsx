import { usePatientLanguage } from '../lib/patientLanguage';

export default function PatientLanguageSwitch({ compact = false }) {
  const { language, setLanguage } = usePatientLanguage();
  return <div className={`guidance-language${compact ? ' website-language' : ''}`}>
    <span>{language === 'mr' ? 'भाषा' : 'Language'}</span>
    <div><button type="button" onClick={() => setLanguage(language === 'mr' ? 'en' : 'mr')}
      lang={language === 'mr' ? 'en' : 'mr'} aria-label={language === 'mr' ? 'Switch to English' : 'मराठीत वाचा'}>
      {language === 'mr' ? 'English' : 'मराठी'}
    </button></div>
  </div>;
}
