'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserX, ArrowLeft, ShieldAlert, AlertTriangle, UserCheck } from 'lucide-react';

export default function AdminModerationPage() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const apiUrl = process.env.NEXT_PUBLIC_MANAGE_API_URL || 'https://cpa-manage.onrender.com';

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const res = await fetch(`${apiUrl}/admin/users/reports`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error('Failed to load user moderation reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleIssueStrike = async (userId) => {
    const reason = prompt('Reason for issuing strike:');
    if (!reason) return;
    try {
      const res = await fetch(`${apiUrl}/admin/users/${userId}/strikes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
        credentials: 'include',
      });
      if (res.ok) alert('Strike issued successfully.');
    } catch (err) {
      alert('Failed to issue strike.');
    }
  };

  return (
    <main style={{ minHeight: '100vh', padding: '2rem', maxWidth: 1100, margin: '0 auto', color: '#f8fafc' }}>
      <button onClick={() => router.push('/')} className="btn-secondary" style={{ marginBottom: 20, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ padding: 10, borderRadius: 12, backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
          <UserX size={28} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>User Moderation & Strike Center</h1>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Issue strikes, manage temporary account suspensions, or enforce permanent bans</p>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        {loading ? (
          <p style={{ color: '#94a3b8', textAlign: 'center' }}>Loading moderation records...</p>
        ) : users.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
            <UserCheck size={40} style={{ marginBottom: 12, color: '#10b981' }} />
            <p style={{ fontWeight: 600, color: '#fff' }}>No flagged users requiring moderation action</p>
            <span style={{ fontSize: '0.85rem' }}>Users reported for harassment or guidelines violations will appear here.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {users.map(u => (
              <div key={u.id} style={{ padding: 16, backgroundColor: 'rgba(15,23,42,0.6)', borderRadius: 10, border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: '1rem', color: '#fff' }}>User #{u.id}</strong>
                  <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{u.email}</p>
                </div>
                <button onClick={() => handleIssueStrike(u.id)} className="btn-danger">Issue Strike</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
