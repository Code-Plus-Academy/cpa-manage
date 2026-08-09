'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import PublicNavbar from '../../../components/shell/PublicNavbar';
import PublicFooter from '../../../components/shell/PublicFooter';
import { FileText, Award, Search, Clock, CheckCircle2, XCircle, ArrowLeft, Download, ExternalLink } from 'lucide-react';

export default function CandidateApplicationsPage() {
  const [emailInput, setEmailInput] = useState('');
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_MANAGE_API_URL || 'https://cpa-manage.onrender.com';

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedEmail = localStorage.getItem('cpa_candidate_email');
      if (storedEmail) {
        setEmailInput(storedEmail);
        fetchMyApplications(storedEmail);
      }
    }
  }, []);

  const fetchMyApplications = async (targetEmail) => {
    const emailToSearch = targetEmail || emailInput;
    if (!emailToSearch || !emailToSearch.trim()) return;

    try {
      setLoading(true);
      setSearched(true);
      let res = await fetch(`${apiUrl}/api/hiring/my-applications?email=${encodeURIComponent(emailToSearch.trim())}`);
      if (!res.ok) {
        res = await fetch(`${apiUrl}/admin/hiring/my-applications?email=${encodeURIComponent(emailToSearch.trim())}`);
      }
      if (res.ok) {
        const data = await res.json();
        setApplications(data.applications || []);
      }
    } catch (err) {
      console.error('Failed to fetch candidate applications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchMyApplications();
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0a0d16', color: '#f3f4f6' }}>
      <PublicNavbar />

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '48px 24px', flex: 1, width: '100%' }}>
        <Link href="/careers" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#818cf8', textDecoration: 'none', fontSize: '14px', fontWeight: '600', marginBottom: '24px' }}>
          <ArrowLeft size={16} /> Back to Open Positions
        </Link>

        <div style={{ background: 'rgba(18, 20, 29, 0.8)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '20px', padding: '32px', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#ffffff', margin: '0 0 8px 0' }}>
            Candidate Application Tracking &amp; Documents
          </h1>
          <p style={{ fontSize: '15px', color: '#9ca3af', margin: '0 0 24px 0', maxWidth: '680px' }}>
            Enter your applicant email address to view your submitted position applications, recruitment status, and download your issued Offer Letters and Completion Certificates.
          </p>

          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '12px', maxWidth: '560px' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
              <input
                type="email"
                required
                placeholder="Enter your application email address..."
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                style={{ width: '100%', padding: '12px 16px 12px 42px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)', background: '#0a0b10', color: '#fff', fontSize: '14px' }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{ padding: '12px 24px', borderRadius: '10px', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: '#fff', fontWeight: '700', border: 'none', cursor: 'pointer', fontSize: '14px' }}
            >
              {loading ? 'Searching...' : 'Find Applications'}
            </button>
          </form>
        </div>

        {/* Results List */}
        {searched && (
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#ffffff', marginBottom: '16px' }}>
              Submitted Applications ({applications.length})
            </h2>

            {applications.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', background: 'rgba(18, 20, 29, 0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', color: '#9ca3af' }}>
                No active applications found for <strong>{emailInput}</strong>.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {applications.map(app => (
                  <div key={app.id} style={{ background: 'rgba(18, 20, 29, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
                      <div>
                        <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', padding: '3px 10px', borderRadius: '9999px', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                          {app.position_department || 'Engineering'}
                        </span>
                        <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#ffffff', margin: '8px 0 4px 0' }}>
                          {app.position_title}
                        </h3>
                        <div style={{ fontSize: '13px', color: '#9ca3af' }}>
                          Applied on {new Date(app.applied_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          padding: '6px 14px', borderRadius: '9999px', fontSize: '13px', fontWeight: '700', textTransform: 'uppercase',
                          background: app.status === 'approved' ? 'rgba(16, 185, 129, 0.2)' : app.status === 'rejected' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                          color: app.status === 'approved' ? '#34d399' : app.status === 'rejected' ? '#f87171' : '#fbbf24',
                          border: `1px solid ${app.status === 'approved' ? 'rgba(16, 185, 129, 0.4)' : app.status === 'rejected' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`
                        }}>
                          Status: {app.status}
                        </span>
                      </div>
                    </div>

                    {/* Issued Documents Section */}
                    {app.documents && app.documents.length > 0 && (
                      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#34d399', textTransform: 'uppercase', margin: '0 0 12px 0' }}>
                          📄 Official Issued Documents ({app.documents.length})
                        </h4>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                          {app.documents.map((doc, i) => (
                            <a
                              key={i}
                              href={doc.pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '8px',
                                padding: '10px 16px', borderRadius: '8px',
                                background: doc.document_type === 'certificate' ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'linear-gradient(135deg, #10b981, #059669)',
                                color: '#ffffff', fontSize: '13px', fontWeight: '700', textDecoration: 'none',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                              }}
                            >
                              {doc.document_type === 'certificate' ? <Award size={16} /> : <FileText size={16} />}
                              Download {doc.document_type === 'certificate' ? 'Certificate of Completion' : 'Offer Letter'} PDF <ExternalLink size={14} />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}
