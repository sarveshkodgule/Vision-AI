import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, FileText, AlertTriangle, UserCheck, Stethoscope, Lock } from 'lucide-react';
import HospitalLayout from '../components/HospitalLayout';
import { hospital } from '../lib/hospital';

export default function Terms() {
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
              {hospital.name} · Clinical Portal Governance
            </p>
            <h1 className="text-3xl font-bold text-slate-900">Terms & Conditions of Care Portal Use</h1>
            <p className="text-sm text-slate-500 mt-2">
              Effective Date: January 2026 · Applies to all Patient & Doctor Portal users of Vision AI
            </p>
          </div>

          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900 leading-relaxed">
              <strong>Medical Decision-Support Disclaimer:</strong> Vision AI provides AI-assisted myopia risk screening,
              retinal fundus image analysis, and educational guidance. It does <strong>not</strong> replace an in-person
              ophthalmic examination, cycloplegic refraction, clinical diagnosis, or emergency eye care.
            </div>
          </div>

          <div className="space-y-6 text-slate-700 text-sm leading-relaxed">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-blue-700" /> 1. Scope of Clinical & Screening Services
              </h2>
              <p>
                This portal enables patients to complete lifestyle & biometric myopia risk questionnaires, receive
                automated screening summaries, and communicate with registered clinicians at {hospital.name}. Doctors use
                the portal to review clinical measurements, retinal fundus scans, and Grad-CAM++ visual overlays before
                issuing a signed clinical verdict.
              </p>
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-700" /> 2. Patient & Clinician Responsibilities
              </h2>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Provide accurate demographic, lifestyle, and clinical information during screening submissions.</li>
                <li>Keep your login password, 6-digit email verification OTPs, and hospital staff codes strictly confidential.</li>
                <li>Submitting an online screening does not automatically book an in-person hospital appointment. Call{' '}
                  <a href={hospital.phoneHref} className="text-blue-700 font-semibold hover:underline">{hospital.phone}</a>{' '}
                  to confirm visit timings.</li>
                <li>Clinicians must independently verify all AI outputs and record their own clinical judgment before finalizing any report.</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-700" /> 3. Emergency Eye Care Notice
              </h2>
              <p>
                Do <strong>not</strong> use this portal or the AI care assistant for urgent symptoms. Seek immediate
                in-person ophthalmic care if you experience sudden vision loss, flashes of light, a sudden shower of floaters,
                severe eye pain, or a curtain-like shadow across your visual field.
              </p>
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Lock className="w-5 h-5 text-blue-700" /> 4. Account Access, Suspension & Retention
              </h2>
              <p>
                We reserve the right to temporarily lock accounts after repeated failed sign-in attempts or suspend access
                if misuse is detected. You may deactivate your account at any time from Profile Settings; deactivation
                disables portal sign-in while required medical and audit records are retained per healthcare compliance laws.
              </p>
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-700" /> 5. Contact & Grievance Redressal
              </h2>
              <p>
                For questions regarding these Terms, clinical records, or portal access, contact {hospital.name} at{' '}
                <strong>{hospital.address}</strong> or call <strong>{hospital.phone}</strong> ({hospital.hours}).
                You can also review our <Link to="/privacy" className="text-blue-700 font-semibold hover:underline">Privacy Policy</Link>.
              </p>
            </div>
          </div>
        </div>
      </section>
    </HospitalLayout>
  );
}
