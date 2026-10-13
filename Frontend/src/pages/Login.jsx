import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, FileText, HeartHandshake } from 'lucide-react';
import HospitalBrand from '../components/HospitalBrand';
import GoogleSignIn from '../components/GoogleSignIn';
import PasswordSignIn from '../components/PasswordSignIn';

export default function Login() {
  return <main className="hospital-login-panel google-login-page">
    <section className="google-login-story"><HospitalBrand light /><div><p className="eyebrow">YOUR CARE, CONNECTED</p><h1>Your eye care.<br/>Your reports.<br/>All in one place.</h1><p>Welcome to Shri Sarveshwar Netralaya’s patient and doctor portal.</p><ul><li><HeartHandshake size={20}/> Understand your screening and next steps.</li><li><FileText size={20}/> Keep your history and PDF reports together.</li><li><ShieldCheck size={20}/> Choose email or Google to access your account.</li></ul></div><Link to="/" className="text-link"><ArrowLeft size={17}/> Back to the hospital website</Link></section>
    <section className="google-login-form"><div className="auth-hospital-brand mobile-brand"><HospitalBrand /></div><div className="google-login-card"><p className="eyebrow">PATIENT & DOCTOR PORTAL</p><h2>Welcome to your care portal.</h2><p>Sign in with your email and password, or continue with Google below.</p><PasswordSignIn /><div className="signin-divider"><span>or</span></div><GoogleSignIn /><p className="signup-link">New to the portal? <Link to="/signup">Create a patient account</Link></p><div className="login-account-note"><ShieldCheck size={21}/><p>Use your registered email to keep your reports together. Registered doctors are directed to their clinical workspace.</p></div><p className="login-help">Need help accessing an existing account? <Link to="/contact">Contact the hospital</Link>.</p></div><Link className="text-link" to="/">Return to home <ArrowLeft size={15}/></Link></section>
  </main>;
}
