import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Lock, Database, Eye, FileCheck2, Mail } from 'lucide-react';
import HospitalLayout from '../components/HospitalLayout';
import { hospital } from '../lib/hospital';

export default function Privacy() {
  const navigate = useNavigate();
  const handleBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/'));

  return (
    <HospitalLayout>
      <section className="legal-page hospital-container py-10 max-w-4xl mx-auto">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center text-sm font-semibold text-slate-600 hover:text-blue-700 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
        </button>

        <div className="clinical-card p-6 sm:p-10 space-y-8">
          <div className="border-b border-slate-200 pb-6">
            <p className="eyebrow text-blue-700 font-semibold tracking-wider text-xs uppercase mb-2">
              {hospital.name} · Patient Privacy & Data Protection
            </p>
            <h1 className="text-3xl font-bold text-slate-900">Hospital Privacy Policy</h1>
            <p className="text-sm text-slate-500 mt-2">
              Last Updated: January 2026 · Committed to confidential, ethical handling of clinical & retinal data
            </p>
          </div>

          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-950 leading-relaxed">
              Your health records, ocular biometry, and fundus scans are used <strong>solely for your clinical care
              and screening workflow</strong>. We never sell, rent, or share patient health data with third-party advertisers.
            </div>
          </div>

          <div className="space-y-6 text-slate-700 text-sm leading-relaxed">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-700" /> 1. Information We Collect
              </h2>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong>Account Information:</strong> Name, email address, role (patient or staff), and explicit consent timestamps.</li>
                <li><strong>Screening & Clinical Biometry:</strong> Age, lifestyle metrics (screen time, outdoor hours, reading, sleep), family myopia history, Axial Length (AL), Spherical Equivalent (SPHEQ), and related ocular measurements.</li>
                <li><strong>Retinal Imaging:</strong> Uploaded fundus photographs and generated Grad-CAM++ visual explanation maps.</li>
                <li><strong>Security & Audit Logs:</strong> Sign-in timestamps, IP-based rate-limit records, and clinical access audit logs.</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Eye className="w-5 h-5 text-blue-700" /> 2. How We Use Your Data
              </h2>
              <p>
                Your data is processed to generate personalized myopia risk assessments, enable your assigned doctor at{' '}
                {hospital.name} to evaluate your eye health, generate downloadable PDF reports, and send requested
                verification OTPs or clinical PDF reports to your registered email address.
              </p>
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Lock className="w-5 h-5 text-blue-700" /> 3. Security Safeguards
              </h2>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Passwords are salted and hashed using <strong>bcrypt + SHA-256</strong> and never stored in plain text.</li>
                <li>Clinical portals enforce strict Role-Based Access Control (RBAC), token blacklisting on logout, and no-cache browser policies on patient/doctor endpoints.</li>
                <li>Uploaded fundus images undergo binary magic-byte and resolution verification before processing.</li>
                <li>API endpoints enforce rate limiting, brute-force account lockouts, input sanitization, and Content-Security-Policy (CSP) headers.</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-blue-700" /> 4. Your Rights & Informed Consent
              </h2>
              <p>
                You provide explicit informed consent before account creation and AI screening analysis. You may review
                your screening history, download your clinical PDFs, update your profile details, or deactivate your account
                from your dashboard. For data correction or deletion inquiries, contact hospital administration.
              </p>
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-700" /> 5. Contact Privacy Officer
              </h2>
              <p>
                {hospital.name} · {hospital.address} · Phone: <strong>{hospital.phone}</strong>.
                See also our <Link to="/terms" className="text-blue-700 font-semibold hover:underline">Terms & Conditions</Link>.
              </p>
            </div>
          </div>
        </div>
      </section>
    </HospitalLayout>
  );
}
