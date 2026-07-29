'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, ArrowLeft, ShieldCheck, Plus, Check } from 'lucide-react';
import AdminShell from '../../components/shell/AdminShell';

export default function AdminIAMPage() {
  const router = useRouter();
  const [adminUser, setAdminUser] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);

  // New admin form
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_MANAGE_API_URL || 'http://localhost:4000';

  useEffect(() => {
    checkAuth();
    loadAdmins();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch(`${apiUrl}/admin/auth/me`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAdminUser(data.admin_user);
      }
    } catch (err) {
      console.error('Auth check failed:', err);
    }
  };

  const loadAdmins = async () => {
    try {
      const res = await fetch(`${apiUrl}/admin/admins`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAdmins(data.admins || []);
      }
    } catch (err) {
      console.error('Failed to load admin list:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    if (!email || !displayName || !password) return;
    setCreating(true);

    try {
      const res = await fetch(`${apiUrl}/admin/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, display_name: displayName, password }),
        credentials: 'include',
      });

      if (res.ok) {
        setEmail('');
        setDisplayName('');
        setPassword('');
        loadAdmins();
      } else {
        const data = await res.json();
        alert(data.error?.message || data.message || 'Failed to create worker admin.');
      }
    } catch (err) {
      alert(err.message || 'Network error creating admin.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <AdminShell adminUser={adminUser} activeTab="admins" breadcrumb={['Administration', 'Admin Management']}>
      <div style={{ maxWidth: 1100, margin: '0 auto', color: '#f8fafc' }}>
      <button onClick={() => router.push('/')} className="btn-secondary" style={{ marginBottom: 20, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ padding: 10, borderRadius: 12, backgroundColor: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>
          <Users size={28} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Admin IAM & Worker Access Control</h1>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Root-only management of worker admin accounts and permission key assignments</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        {/* Admin List Left Column */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>Worker Admin Accounts</h3>
          {loading ? (
            <p style={{ color: '#94a3b8' }}>Loading worker accounts...</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {admins.map(a => (
                <div key={a.id} style={{ padding: 16, backgroundColor: 'rgba(15,23,42,0.6)', borderRadius: 10, border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <strong style={{ fontSize: '1rem', color: '#fff' }}>{a.display_name}</strong>
                    <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 10, backgroundColor: a.is_root ? '#a855f7' : '#334155', color: '#fff', fontWeight: 600 }}>
                      {a.is_root ? 'ROOT ADMIN' : 'WORKER'}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: 8 }}>{a.email}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {a.permissions?.map(p => (
                      <span key={p} style={{ fontSize: '0.7rem', padding: '2px 6px', backgroundColor: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', borderRadius: 4 }}>
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Worker Admin Right Column */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>Create Worker Admin</h3>
          <form onSubmit={handleCreateAdmin}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: 4 }}>Display Name</label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Moderator Name"
                className="glass-input"
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: 4 }}>Worker Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="worker@codeplusacademy.in"
                className="glass-input"
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: 4 }}>Initial Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="glass-input"
                style={{ width: '100%' }}
              />
            </div>
            <button type="submit" disabled={creating} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              {creating ? 'Creating Account...' : 'Create Worker Admin'}
            </button>
          </form>
        </div>
      </div>
    </div>
    </AdminShell>
  );
}
