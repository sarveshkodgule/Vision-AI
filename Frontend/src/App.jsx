import PatientLanguageSwitch from './components/PatientLanguageSwitch';
import { usePatientLanguage } from './lib/patientLanguage';
import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import AppErrorBoundary from './components/AppErrorBoundary';
import { reportClientError, trackEvent } from './lib/telemetry';
const LandingPage = lazy(() => import('./pages/LandingPage'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const PatientDashboard = lazy(() => import('./pages/PatientDashboard'));
const DoctorDashboard = lazy(() => import('./pages/DoctorDashboard'));
const AboutUs = lazy(() => import('./pages/AboutUs'));
const ContactUs = lazy(() => import('./pages/ContactUs'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Protected Route wrapper component
function ProtectedRoute({ children, allowedRole }) {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  if (!token) {
    // If not logged in, redirect to login page
    return <Navigate to="/login" replace />;
  }

  if (allowedRole && role !== allowedRole) {
    // If logged in but role mismatch, redirect to correct portal
    return <Navigate to={role === 'doctor' ? '/doctor/dashboard' : '/patient/dashboard'} replace />;
  }

  return children;
}

// Public Route wrapper component (prevents logged in users from visiting login/signup)
function PublicRoute({ children }) {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  if (token) {
    // If already logged in, redirect to their dashboard
    return <Navigate to={role === 'doctor' ? '/doctor/dashboard' : '/patient/dashboard'} replace />;
  }

  return children;
}

function LanguageSettings() {
  const { language } = usePatientLanguage();
  const { pathname } = useLocation();
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  useEffect(() => { trackEvent(`page_view:${pathname}`); }, [pathname]);
  if (['/', '/about', '/contact', '/patient/dashboard'].includes(pathname)) return null;
  return <div className="portal-language-bar"><PatientLanguageSwitch compact /></div>;
}

function App() {
  useEffect(() => {
    const handleError = event => reportClientError(event.error || new Error(event.message), { source: 'window' });
    const handleRejection = event => reportClientError(event.reason, { source: 'unhandledrejection' });
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => { window.removeEventListener('error', handleError); window.removeEventListener('unhandledrejection', handleRejection); };
  }, []);
  return (
    <BrowserRouter>
      <LanguageSettings />
      <AppErrorBoundary>
      <Suspense fallback={<p role="status" className="p-6">Loading...</p>}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/about" element={<AboutUs />} />
        <Route path="/contact" element={<ContactUs />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        
        {/* Public auth routes (restricted if logged in) */}
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
        
        {/* Protected dashboards */}
        <Route 
          path="/patient/dashboard" 
          element={
            <ProtectedRoute allowedRole="patient">
              <PatientDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/doctor/dashboard" 
          element={
            <ProtectedRoute allowedRole="doctor">
              <DoctorDashboard />
            </ProtectedRoute>
          } 
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
      </AppErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
