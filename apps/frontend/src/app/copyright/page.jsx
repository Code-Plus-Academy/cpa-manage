'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Scale, ArrowLeft, Eye, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import AdminShell from '../../components/shell/AdminShell';
import { apiFetch } from '../../lib/apiClient';

export default function AdminCopyrightPage() {
  const router = useRouter();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClaims();
  }, []);

  const loadClaims = async () => {
    try {
      const res = await apiFetch('/admin/cases?type=copyright');
      if (res.ok) {
        const data = await res.json();
        setClaims(data.cases || []);
      }
    } catch (err) {
      console.error('Failed to load copyright claims:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminShell activeTab="copyright" breadcrumb={['Trust & Safety', 'Copyright Claims']}>
      <div style={{ maxWidth: 1100, margin: '0 auto', color: '#f8fafc' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ padding: 10, borderRadius: 12, backgroundColor: 'rgba(236, 72, 153, 0.15)', color: '#ec4899' }}>
            <Scale size={28} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Copyright & DMCA Content Claims</h1>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Review and take moderation action on copyright infringement notices</p>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          {loading ? (
            <p style={{ color: '#94a3b8', textAlign: 'center' }}>Loading copyright queue...</p>
          ) : claims.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
              <Scale size={40} style={{ marginBottom: 12, color: '#475569' }} />
              <p style={{ fontWeight: 600, color: '#fff' }}>No pending copyright claims</p>
              <span style={{ fontSize: '0.85rem' }}>Claims submitted by rights holders will populate here automatically.</span>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: '#94a3b8', textAlign: 'left' }}>
                  <th style={{ padding: 12 }}>ID</th>
                  <th style={{ padding: 12 }}>Category</th>
                  <th style={{ padding: 12 }}>Reporter</th>
                  <th style={{ padding: 12 }}>Status</th>
                  <th style={{ padding: 12 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {claims.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: 12, fontWeight: 700, color: '#818cf8' }}>{c.id}</td>
                    <td style={{ padding: 12 }}>{c.category}</td>
                    <td style={{ padding: 12 }}>{c.reporter_email}</td>
                    <td style={{ padding: 12 }}>{c.status}</td>
                    <td style={{ padding: 12 }}>
                      <button onClick={() => router.push(`/tickets/detail?id=${c.id}`)} className="btn-secondary" style={{ fontSize: '0.8rem', padding: '4px 10px' }}>
                        Review Claim
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
