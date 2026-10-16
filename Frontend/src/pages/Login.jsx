import { usePatientLanguage } from '../lib/patientLanguage';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, FileText, HeartHandshake } from 'lucide-react';
import HospitalBrand from '../components/HospitalBrand';
import GoogleSignIn from '../components/GoogleSignIn';
import PasswordSignIn from '../components/PasswordSignIn';

export default function Login() {
  const { t } = usePatientLanguage();
  const [role, setRole] = useState('patient');
  return <main className="hospital-login-panel google-login-page">
    <section className="google-login-story"><HospitalBrand light /><div><p className="eyebrow">{t("YOUR CARE, CONNECTED")}</p><h1>{t("Your eye care.")}<br/>{t("Your reports.")}<br/>{t("All in one place.")}</h1><p>{t("Welcome to Shri Sarveshwar Netralaya’s patient and doctor portal.")}</p><ul><li><HeartHandshake size={20}/> {t("Understand your screening and next steps.")}</li><li><FileText size={20}/> {t("Keep your history and PDF reports together.")}</li><li><ShieldCheck size={20}/> {t("Choose email or Google to access your account.")}</li></ul></div><Link to="/" className="text-link"><ArrowLeft size={17}/> {t("Back to the hospital website")}</Link></section>
    <section className="google-login-form"><div className="auth-hospital-brand mobile-brand"><HospitalBrand /></div><div className="google-login-card"><p className="eyebrow">{t("PATIENT & DOCTOR PORTAL")}</p><h2>{t("Welcome to your care portal.")}</h2><p>{t("Sign in with your email and password, or continue with Google below.")}</p><PasswordSignIn role={role} onRoleChange={setRole} /><div className="signin-divider"><span>{t("or")}</span></div><GoogleSignIn /><p className="signup-link">{t("New to the portal?")} <Link to={role === 'doctor' ? '/signup?role=doctor' : '/signup'}>{t(role === 'doctor' ? "Create a doctor account" : "Create a patient account")}</Link></p><div className="login-account-note"><ShieldCheck size={21}/><p>{t("Use your registered email to keep your reports together. Registered doctors are directed to their clinical workspace.")}</p></div><p className="login-help">{t("Need help accessing an existing account?")} <Link to="/contact">{t("Contact the hospital")}</Link>.</p></div><Link className="text-link" to="/">{t("Return to home")} <ArrowLeft size={15}/></Link></section>
  </main>;
}
