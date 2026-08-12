'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, ArrowLeft, ShieldCheck, Activity } from 'lucide-react';
import AdminShell from '../../components/shell/AdminShell';

export default function AdminAuditPage() {
  const router = useRouter();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const apiUrl = process.env.NEXT_PUBLIC_MANAGE_API_URL || 'https://cpa-manage.onrender.com';

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const loadAuditLogs = async () => {
    try {
      const res = await fetch(`${apiUrl}/admin/audit`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminShell activeTab="audit" breadcrumb={['Administration', 'Audit Log']}>
      <div style={{ maxWidth: 1100, margin: '0 auto', color: '#f8fafc' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ padding: 10, borderRadius: 12, backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
            <FileText size={28} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Append-Only Audit Log Viewer</h1>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Immutable history of every moderation decision and administrative action taken</p>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          {loading ? (
            <p style={{ color: '#94a3b8', textAlign: 'center' }}>Loading system audit log...</p>
          ) : logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
              <FileText size={40} style={{ marginBottom: 12, color: '#475569' }} />
              <p style={{ fontWeight: 600, color: '#fff' }}>No audit log entries recorded yet</p>
              <span style={{ fontSize: '0.85rem' }}>Every write operation performed by admins will be recorded here in real-time.</span>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: '#94a3b8', textAlign: 'left' }}>
                  <th style={{ padding: 12 }}>Time</th>
                  <th style={{ padding: 12 }}>Admin Actor</th>
                  <th style={{ padding: 12 }}>Action</th>
                  <th style={{ padding: 12 }}>Target</th>
                  <th style={{ padding: 12 }}>Reason</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: 12, fontSize: '0.8rem', color: '#94a3b8' }}>{new Date(l.created_at).toLocaleString()}</td>
                    <td style={{ padding: 12, fontWeight: 600, color: '#818cf8' }}>{l.actor_admin_id}</td>
                    <td style={{ padding: 12, color: '#38bdf8' }}>{l.action}</td>
                    <td style={{ padding: 12 }}>{l.target_type ? `${l.target_type}:${l.target_id || 'N/A'}` : 'N/A'}</td>
                    <td style={{ padding: 12, color: '#cbd5e1' }}>{l.reason}</td>
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
