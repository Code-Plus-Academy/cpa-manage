'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, ArrowLeft, CheckCircle2, XCircle, Clock } from 'lucide-react';
import AdminShell from '../../components/shell/AdminShell';

export default function AdminInstitutionsPage() {
  const router = useRouter();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);

  const apiUrl = process.env.NEXT_PUBLIC_MANAGE_API_URL || 'https://cpa-manage.onrender.com';

  useEffect(() => {
    loadClaims();
  }, []);

  const loadClaims = async () => {
    try {
      const res = await fetch(`${apiUrl}/admin/claims/institution`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setClaims(data.claims || []);
      }
    } catch (err) {
      console.error('Failed to load institution claims:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      const res = await fetch(`${apiUrl}/admin/claims/institution/${id}/approve`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (res.ok) loadClaims();
    } catch (err) {
      alert('Failed to approve claim.');
    }
  };

  const handleReject = async (id) => {
    const reason = prompt('Reason for rejecting this claim:');
    if (!reason) return;
    try {
      const res = await fetch(`${apiUrl}/admin/claims/institution/${id}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
        credentials: 'include',
      });
      if (res.ok) loadClaims();
    } catch (err) {
      alert('Failed to reject claim.');
    }
  };

  return (
    <AdminShell activeTab="institutions" breadcrumb={['Trust & Safety', 'Institution Claims']}>
      <div style={{ maxWidth: 1100, margin: '0 auto', color: '#f8fafc' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ padding: 10, borderRadius: 12, backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
            <Building2 size={28} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Institution Profile Verification Claims</h1>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Review official college/university ownership claims submitted by educational institution representatives</p>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          {loading ? (
            <p style={{ color: '#94a3b8', textAlign: 'center' }}>Loading institution verification queue...</p>
          ) : claims.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
              <Building2 size={40} style={{ marginBottom: 12, color: '#475569' }} />
              <p style={{ fontWeight: 600, color: '#fff' }}>No pending institution claims</p>
              <span style={{ fontSize: '0.85rem' }}>Verification requests submitted by university officials will appear here.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {claims.map(c => (
                <div key={c.id} style={{ padding: 16, backgroundColor: 'rgba(15,23,42,0.6)', borderRadius: 10, border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 700 }}>Claim #{c.id}</span>
                    <p style={{ fontWeight: 700, color: '#fff', margin: '4px 0' }}>Role: {c.claimant_role || 'Official Representative'}</p>
                    <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>Email: {c.official_email || 'N/A'} • Status: {c.status}</span>
                  </div>
                  {c.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => handleApprove(c.id)} className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Approve</button>
                      <button onClick={() => handleReject(c.id)} className="btn-danger" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Reject</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
