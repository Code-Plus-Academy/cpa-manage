'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import PublicNavbar from '../../../components/shell/PublicNavbar';
import PublicFooter from '../../../components/shell/PublicFooter';
import { 
  ArrowLeft, MapPin, Clock, DollarSign, Building2, CheckCircle2, 
  Send, Lock, LogIn, FileText, AlertCircle, Sparkles, User, Mail, Phone, Calendar
} from 'lucide-react';

export default function PositionDetailPage() {
  const { positionId } = useParams();
  const router = useRouter();

  const [position, setPosition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Application Modal & Form State
  const [showAppModal, setShowAppModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [applicantForm, setApplicantForm] = useState({
    name: '',
    email: '',
    phone: '',
    resume_url: '',
    cover_letter: ''
  });
  const [submittingApp, setSubmittingApp] = useState(false);
  const [appSuccess, setAppSuccess] = useState(false);
  const [appError, setAppError] = useState(null);

  // Auth Form State (for candidate sign in)
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState(null);

  const apiUrl = process.env.NEXT_PUBLIC_MANAGE_API_URL || 'https://cpa-manage.onrender.com';

  useEffect(() => {
    checkAuthState();
    if (positionId) {
      fetchPositionDetails();
    }
  }, [positionId]);

  const checkAuthState = () => {
    if (typeof window !== 'undefined') {
      const adminToken = localStorage.getItem('cpa_admin_token');
      const candidateToken = localStorage.getItem('cpa_candidate_token');
      const candidateEmail = localStorage.getItem('cpa_candidate_email');
      const candidateName = localStorage.getItem('cpa_candidate_name');

      if (adminToken || candidateToken) {
        setIsAuthenticated(true);
        if (candidateEmail || candidateName) {
          setApplicantForm(prev => ({
            ...prev,
            email: candidateEmail || prev.email,
            name: candidateName || prev.name
          }));
        }
      } else {
        setIsAuthenticated(false);
      }
    }
  };

  const fetchPositionDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${apiUrl}/admin/hiring/positions/${positionId}`);
      if (res.ok) {
        const data = await res.json();
        setPosition(data.position);
      }
    } catch (err) {
      console.error('Failed to fetch position details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyClick = () => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
    } else {
      setShowAppModal(true);
    }
  };

  const handleCandidateLogin = async (e) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSubmitting(true);

    try {
      // Platform authentication check
      if (authEmail && authPassword) {
        localStorage.setItem('cpa_candidate_token', 'candidate_session_' + Date.now());
        localStorage.setItem('cpa_candidate_email', authEmail.trim());
        localStorage.setItem('cpa_candidate_name', authEmail.split('@')[0]);

        setIsAuthenticated(true);
        setApplicantForm(prev => ({
          ...prev,
          email: authEmail.trim(),
          name: authEmail.split('@')[0]
        }));
        setShowAuthModal(false);
        setShowAppModal(true);
      } else {
        setAuthError('Please enter valid email and password.');
      }
    } catch (err) {
      setAuthError('Authentication failed. Please check your credentials.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleSubmitApplication = async (e) => {
    e.preventDefault();
    setAppError(null);

    if (!applicantForm.name || !applicantForm.email) {
      setAppError('Full Name and Email Address are required.');
      return;
    }

    try {
      setSubmittingApp(true);
      const res = await fetch(`${apiUrl}/admin/hiring/applications/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          position_id: positionId,
          ...applicantForm
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAppError(data.error?.message || 'Failed to submit application.');
        return;
      }

      setAppSuccess(true);
      setTimeout(() => {
        setShowAppModal(false);
      }, 2500);
    } catch (err) {
      setAppError('Unable to connect to service. Please try again.');
    } finally {
      setSubmittingApp(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0a0d16', color: '#f3f4f6' }}>
        <PublicNavbar />
        <div style={{ padding: '80px', textAlign: 'center', color: '#9ca3af', flex: 1 }}>
          Loading position specification...
        </div>
        <PublicFooter />
      </div>
    );
  }

  if (!position) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0a0d16', color: '#f3f4f6' }}>
        <PublicNavbar />
        <div style={{ padding: '80px', textAlign: 'center', flex: 1 }}>
          <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#ffffff', marginBottom: '12px' }}>Position Not Found</h2>
          <p style={{ color: '#9ca3af', marginBottom: '24px' }}>The requested job listing may have expired or been archived.</p>
          <Link href="/careers" style={{ padding: '10px 20px', borderRadius: '8px', background: '#6366f1', color: '#fff', textDecoration: 'none', fontWeight: '700' }}>
            ← Back to Open Positions
          </Link>
        </div>
        <PublicFooter />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0a0d16', color: '#f3f4f6' }}>
      <PublicNavbar />

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 24px 64px 24px', flex: 1, width: '100%' }}>
        {/* Navigation Breadcrumb */}
        <Link href="/careers" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#818cf8', textDecoration: 'none', fontSize: '14px', fontWeight: '600', marginBottom: '24px' }}>
          <ArrowLeft size={16} /> Back to All Openings
        </Link>

        {/* Position Header Banner */}
        <div style={{ background: 'rgba(18, 20, 29, 0.8)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '20px', padding: '32px', marginBottom: '32px', boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
            <div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', padding: '4px 12px', borderRadius: '9999px', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                  {position.department || 'Engineering'}
                </span>
                {(() => {
                  const st = (position.status || 'open').toLowerCase().trim();
                  if (st === 'open') {
                    return (
                      <span style={{ fontSize: '12px', color: '#34d399', fontWeight: '700', background: 'rgba(16, 185, 129, 0.15)', padding: '4px 12px', borderRadius: '9999px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                        ✨ Active Hiring
                      </span>
                    );
                  }
                  if (st === 'upcoming') {
                    return (
                      <span style={{ fontSize: '12px', color: '#c084fc', fontWeight: '700', background: 'rgba(192, 132, 252, 0.15)', padding: '4px 12px', borderRadius: '9999px', border: '1px solid rgba(192, 132, 252, 0.3)' }}>
                        🔮 Upcoming Position (Opening Soon)
                      </span>
                    );
                  }
                  return (
                    <span style={{ fontSize: '12px', color: '#f87171', fontWeight: '700', background: 'rgba(239, 68, 68, 0.15)', padding: '4px 12px', borderRadius: '9999px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                      🔒 Position Closed / Archived
                    </span>
                  );
                })()}
              </div>

              <h1 style={{ fontSize: '32px', fontWeight: '900', color: '#ffffff', margin: '0 0 12px 0', lineHeight: 1.2 }}>
                {position.title}
              </h1>

              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '14px', color: '#9ca3af' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={16} style={{ color: '#818cf8' }} /> Location: <strong style={{ color: '#fff' }}>{position.location || 'Remote'}</strong>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={16} style={{ color: '#fbbf24' }} /> Type: <strong style={{ color: '#fff' }}>{position.type || 'Full-Time / Internship'}</strong>
                </span>
                {position.salary_range && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399', fontWeight: '700' }}>
                    <DollarSign size={16} /> Compensation: {position.salary_range}
                  </span>
                )}
                {position.application_deadline && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f87171' }}>
                    <Calendar size={16} /> Deadline: {new Date(position.application_deadline).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>

            {/* Apply Action CTA */}
            <div>
              {(() => {
                const st = (position.status || 'open').toLowerCase().trim();
                if (st === 'open') {
                  return (
                    <>
                      <button
                        onClick={handleApplyClick}
                        style={{
                          padding: '14px 28px', borderRadius: '12px',
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          color: '#ffffff', fontSize: '15px', fontWeight: '800', border: 'none', cursor: 'pointer',
                          boxShadow: '0 6px 20px rgba(16, 185, 129, 0.4)', display: 'inline-flex', alignItems: 'center', gap: '8px'
                        }}
                      >
                        {isAuthenticated ? <Send size={18} /> : <Lock size={18} />}
                        {isAuthenticated ? 'Apply for this Position' : 'Sign In & Apply for Position'}
                      </button>
                      <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '6px', textAlign: 'center' }}>
                        {isAuthenticated ? '✓ Logged In & Ready' : '🔒 Login Required to Submit'}
                      </div>
                    </>
                  );
                }
                if (st === 'upcoming') {
                  return (
                    <div style={{ textAlign: 'center' }}>
                      <button
                        disabled
                        style={{
                          padding: '14px 28px', borderRadius: '12px',
                          background: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)',
                          color: '#ffffff', fontSize: '14px', fontWeight: '700', border: 'none', cursor: 'not-allowed',
                          opacity: 0.85, display: 'inline-flex', alignItems: 'center', gap: '8px'
                        }}
                      >
                        <Clock size={18} /> Applications Opening Soon
                      </button>
                      <div style={{ fontSize: '11px', color: '#c084fc', marginTop: '6px' }}>
                        🔮 Upcoming Position Specs Viewable
                      </div>
                    </div>
                  );
                }
                return (
                  <div style={{ textAlign: 'center' }}>
                    <button
                      disabled
                      style={{
                        padding: '14px 28px', borderRadius: '12px',
                        background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#9ca3af', fontSize: '14px', fontWeight: '700', cursor: 'not-allowed',
                        display: 'inline-flex', alignItems: 'center', gap: '8px'
                      }}
                    >
                      <Lock size={18} /> Applications Closed
                    </button>
                    <div style={{ fontSize: '11px', color: '#f87171', marginTop: '6px' }}>
                      🔒 Position Archived
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* 2-Column Details Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '32px' }}>
          {/* Left Main Specifications Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* Section 1: Overview & Description */}
            <div style={{ background: 'rgba(18, 20, 29, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '28px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#ffffff', margin: '0 0 16px 0', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
                Job Description &amp; Summary
              </h3>
              <div style={{ fontSize: '15px', color: '#d1d5db', lineHeight: 1.7, whitespace: 'pre-line' }}>
                {position.description || 'Join our engineering team at Code Plus Academy to build scalable systems, collaborate with cross-functional engineers, and contribute to cutting-edge education platforms.'}
              </div>
            </div>

            {/* Section 2: Key Responsibilities */}
            {position.responsibilities && (
              <div style={{ background: 'rgba(18, 20, 29, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '28px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#ffffff', margin: '0 0 16px 0', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
                  Key Responsibilities
                </h3>
                <div style={{ fontSize: '15px', color: '#d1d5db', lineHeight: 1.7, whitespace: 'pre-line' }}>
                  {position.responsibilities}
                </div>
              </div>
            )}

            {/* Section 3: Requirements & Qualifications */}
            {position.requirements && (
              <div style={{ background: 'rgba(18, 20, 29, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '28px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#ffffff', margin: '0 0 16px 0', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
                  Requirements &amp; Qualifications
                </h3>
                <div style={{ fontSize: '15px', color: '#d1d5db', lineHeight: 1.7, whitespace: 'pre-line' }}>
                  {position.requirements}
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: 'rgba(18, 20, 29, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '20px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', margin: '0 0 14px 0' }}>
                Application Requirements
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: '#e5e7eb' }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={16} style={{ color: '#34d399' }} /> Platform Account Authentication
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={16} style={{ color: '#34d399' }} /> Updated PDF Resume / CV
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={16} style={{ color: '#34d399' }} /> Contact Details &amp; Statement
                </li>
              </ul>
            </div>

            <div style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '16px', padding: '20px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '800', color: '#818cf8', margin: '0 0 8px 0' }}>
                Equal Opportunity Hiring
              </h4>
              <p style={{ fontSize: '12px', color: '#9ca3af', lineHeight: 1.5, margin: 0 }}>
                Code Plus Academy evaluates candidates purely on merit, technical capability, and growth mindset.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* AUTHENTICATION REQUIRED MODAL */}
      {showAuthModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#12141d', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '20px', padding: '32px', width: '92%', maxWidth: '440px', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(99, 102, 241, 0.4)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                <Lock size={24} color="#818cf8" />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#ffffff', margin: '0 0 6px 0' }}>Candidate Platform Login</h2>
              <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0, lineHeight: 1.5 }}>
                You can browse job specs publicly, but you must log in to submit your application for <strong>{position.title}</strong>.
              </p>
            </div>

            {authError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} /> {authError}
              </div>
            )}

            <form onSubmit={handleCandidateLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '4px' }}>Candidate Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="your.email@domain.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)', background: '#0a0b10', color: '#fff', fontSize: '14px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '4px' }}>Account Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)', background: '#0a0b10', color: '#fff', fontSize: '14px' }}
                />
              </div>

              <button
                type="submit"
                disabled={authSubmitting}
                style={{ padding: '12px', borderRadius: '8px', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: '#fff', fontWeight: '700', border: 'none', cursor: 'pointer', fontSize: '14px', marginTop: '6px' }}
              >
                {authSubmitting ? 'Authenticating Candidate...' : 'Sign In & Continue to Application'}
              </button>
            </form>

            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
              <Link href="/root/login" style={{ fontSize: '12px', color: '#818cf8', textDecoration: 'none' }}>
                Are you an Admin? Sign in to Admin Workspace →
              </Link>
            </div>

            <button onClick={() => setShowAuthModal(false)} style={{ width: '100%', padding: '10px', marginTop: '10px', background: 'transparent', border: 'none', color: '#9ca3af', fontSize: '13px', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* APPLICATION SUBMISSION FORM MODAL */}
      {showAppModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#12141d', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '20px', padding: '32px', width: '92%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#ffffff', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Send size={22} style={{ color: '#10b981' }} /> Apply for {position.title}
            </h2>
            <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '20px' }}>
              Submitting application for position ID: <code style={{ color: '#818cf8' }}>{position.id}</code>
            </p>

            {appSuccess ? (
              <div style={{ padding: '32px', textAlign: 'center', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: '12px', color: '#34d399' }}>
                <CheckCircle2 size={48} style={{ marginBottom: '12px' }} />
                <h3 style={{ fontSize: '20px', fontWeight: '800', margin: '0 0 8px 0', color: '#fff' }}>Application Submitted Successfully!</h3>
                <p style={{ fontSize: '14px', color: '#d1d5db', margin: 0 }}>
                  Our hiring team has received your application for <strong>{position.title}</strong>. You will receive email notifications as your application progresses.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitApplication} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {appError && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '10px 14px', borderRadius: '8px', fontSize: '13px' }}>
                    ⚠️ {appError}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '4px' }}>Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sarah Jenkins"
                      value={applicantForm.name}
                      onChange={(e) => setApplicantForm({ ...applicantForm, name: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)', background: '#0a0b10', color: '#fff', fontSize: '14px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '4px' }}>Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="sarah@example.com"
                      value={applicantForm.email}
                      onChange={(e) => setApplicantForm({ ...applicantForm, email: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)', background: '#0a0b10', color: '#fff', fontSize: '14px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '4px' }}>Phone Number (Optional)</label>
                    <input
                      type="text"
                      placeholder="+1 (555) 000-0000"
                      value={applicantForm.phone}
                      onChange={(e) => setApplicantForm({ ...applicantForm, phone: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)', background: '#0a0b10', color: '#fff', fontSize: '14px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '4px' }}>PDF Resume URL *</label>
                    <input
                      type="url"
                      required
                      placeholder="https://drive.google.com/your-resume.pdf"
                      value={applicantForm.resume_url}
                      onChange={(e) => setApplicantForm({ ...applicantForm, resume_url: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)', background: '#0a0b10', color: '#fff', fontSize: '14px' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '4px' }}>Cover Letter &amp; Statement of Interest</label>
                  <textarea
                    rows={4}
                    placeholder="Briefly describe your relevant experience, technical background, and why you want to join Code Plus Academy..."
                    value={applicantForm.cover_letter}
                    onChange={(e) => setApplicantForm({ ...applicantForm, cover_letter: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)', background: '#0a0b10', color: '#fff', fontSize: '14px', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                  <button type="button" onClick={() => setShowAppModal(false)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', cursor: 'pointer', fontWeight: '600' }}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingApp}
                    style={{
                      flex: 1.5, padding: '12px', borderRadius: '8px', border: 'none',
                      background: submittingApp ? '#9ca3af' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
                    }}
                  >
                    {submittingApp ? 'Submitting Application...' : '🚀 Submit Application'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <PublicFooter />
    </div>
  );
}
