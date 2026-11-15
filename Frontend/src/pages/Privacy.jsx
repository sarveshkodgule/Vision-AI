import HospitalLayout from '../components/HospitalLayout';

export default function Privacy() {
  return <HospitalLayout><section className="legal-page hospital-container"><p className="eyebrow">PRIVACY</p><h1>Your information, handled carefully.</h1><p>We use account details and screening responses to provide the patient portal, reports, and requested hospital communication.</p><h2>What we collect</h2><p>We collect information you submit, authentication records, screening results, and operational logs needed to secure and improve the service.</p><h2>How we use it</h2><p>Clinical records are used for your care workflow and are not sold. We do not run third-party analytics by default. Contact the hospital to ask about access, correction, or retention.</p><h2>Security</h2><p>Use a unique password, do not share OTPs, and contact the hospital if you suspect account misuse.</p></section></HospitalLayout>;
}
