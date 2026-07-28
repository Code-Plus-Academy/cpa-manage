'use client';

import { useState, useEffect } from 'react';
import { ShieldCheck, Lock, Mail, Key, Activity, Server, AlertCircle, LogOut, CheckCircle2 } from 'lucide-react';

export default function AdminPage() {
  const [adminUser, setAdminUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [totpRequired, setTotpRequired] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking');

  const apiUrl = process.env.NEXT_PUBLIC_MANAGE_API_URL || 'https://cpa-manage.onrender.com';

  useEffect(() => {
    checkHealth();
    checkAuthStatus();
  }, []);

  const checkHealth = async () => {
    try {
      const res = await fetch(`${apiUrl}/healthz`);
      if (res.ok) {
        setBackendStatus('online');
      } else {
        setBackendStatus('degraded');
      }
    } catch (err) {
      setBackendStatus('offline');
    }
  };

  const checkAuthStatus = async () => {
    try {
      const res = await fetch(`${apiUrl}/admin/auth/me`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAdminUser(data.admin_user);
      }
    } catch (err) {
      // Not authenticated
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`${apiUrl}/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          totp_code: totpCode || undefined,
        }),
        credentials: 'include',
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error?.code === 'TOTP_REQUIRED') {
          setTotpRequired(true);
          setError('2FA TOTP code required for root admin login.');
        } else {
          setError(data.error?.message || 'Login failed. Please check your credentials.');
        }
        return;
      }

      setAdminUser(data.admin_user);
      setError(null);
    } catch (err) {
      setError('Network error. Unable to connect to CPA Manage API.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${apiUrl}/admin/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      setAdminUser(null);
      setTotpRequired(false);
      setTotpCode('');
      setPassword('');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#94a3b8' }}>
          <Activity className="animate-spin" size={32} style={{ marginBottom: 12, color: '#6366f1' }} />
          <p>Loading CPA Admin Platform...</p>
        </div>
      </div>
    );
  }

  return (
    <main style={{ minHeight: '100vh', padding: '2rem 1rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Top Bar / Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: '1.5rem',
        borderBottom: '1px solid #334155',
        marginBottom: '2rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            backgroundColor: '#6366f1',
            padding: '8px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <ShieldCheck size={28} color="#ffffff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Code Plus Academy</h1>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Trust, Safety & Admin Platform</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Status Badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '20px',
            fontSize: '0.8rem',
            backgroundColor: backendStatus === 'online' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: backendStatus === 'online' ? '#34d399' : '#f87171',
            border: `1px solid ${backendStatus === 'online' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
          }}>
            <Server size={14} />
            <span>API: {backendStatus}</span>
          </div>

          {adminUser && (
            <button
              onClick={handleLogout}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                backgroundColor: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #334155',
                fontSize: '0.85rem'
              }}
            >
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content View */}
      {adminUser ? (
        <section>
          {/* Welcome Card */}
          <div style={{
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '12px',
            padding: '1.5rem',
            marginBottom: '2rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>
                  Welcome, {adminUser.display_name} {adminUser.is_root && <span style={{ fontSize: '0.75rem', backgroundColor: '#6366f1', color: '#fff', padding: '2px 8px', borderRadius: '4px', marginLeft: '8px' }}>ROOT</span>}
                </h2>
                <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{adminUser.email}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Role / Privileges</span>
                <p style={{ color: '#34d399', fontWeight: 600 }}>{adminUser.is_root ? 'Full System Root' : `${adminUser.permissions.length} Permissions`}</p>
              </div>
            </div>
          </div>

          {/* Module Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: '#818cf8' }}>🎫 Support & Ticket Ops</h3>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1rem' }}>Manage user reports, DMCA copyright claims, and institution verification tickets.</p>
              <button style={{ width: '100%', padding: '10px', backgroundColor: '#334155', color: '#fff', borderRadius: '6px', fontSize: '0.85rem' }}>View Ticket Queue</button>
            </div>

            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: '#f43f5e' }}>🛡️ Moderation & Strikes</h3>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1rem' }}>Issue user strikes, execute suspensions, and review flagged content items.</p>
              <button style={{ width: '100%', padding: '10px', backgroundColor: '#334155', color: '#fff', borderRadius: '6px', fontSize: '0.85rem' }}>Moderation Hub</button>
            </div>

            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: '#38bdf8' }}>📄 Audit & Access Log</h3>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1rem' }}>Inspect full append-only system audit logs of all admin actions and permission usages.</p>
              <button style={{ width: '100%', padding: '10px', backgroundColor: '#334155', color: '#fff', borderRadius: '6px', fontSize: '0.85rem' }}>View Audit Logs</button>
            </div>
          </div>
        </section>
      ) : (
        /* Login Form Card */
        <section style={{ maxWidth: '420px', margin: '4rem auto 0 auto' }}>
          <div style={{
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <Lock size={36} color="#6366f1" style={{ marginBottom: '8px' }} />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Admin Login</h2>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px' }}>Access manage.codeplusacademy.in portal</p>
            </div>

            {error && (
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '6px' }}>Email Address</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@codeplusacademy.in"
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 38px',
                      backgroundColor: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '0.9rem'
                    }}
                  />
                  <Mail size={18} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 12 }} />
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '6px' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 38px',
                      backgroundColor: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '0.9rem'
                    }}
                  />
                  <Key size={18} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 12 }} />
                </div>
              </div>

              {totpRequired && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#6366f1', fontWeight: 600, marginBottom: '6px' }}>2FA TOTP Authenticator Code</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    placeholder="123456"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: '#0f172a',
                      border: '1px solid #6366f1',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '1rem',
                      letterSpacing: '4px',
                      textAlign: 'center'
                    }}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#6366f1',
                  color: '#fff',
                  borderRadius: '8px',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  marginTop: '0.5rem',
                  opacity: submitting ? 0.7 : 1
                }}
              >
                {submitting ? 'Authenticating...' : totpRequired ? 'Verify 2FA & Sign In' : 'Sign In to Admin Portal'}
              </button>
            </form>
          </div>
        </section>
      )}
    </main>
  );
}
