'use client';

import { useState, useEffect } from 'react';
import {
  ShieldCheck, Lock, Mail, Key, Activity, Server, AlertCircle, LogOut, CheckCircle2,
  Ticket, Scale, Building2, UserX, FileText, Users, Search, Filter, Clock, Eye,
  ArrowRight, ShieldAlert, Check, X, RefreshCw, Send, Calendar, PieChart, Sparkles, ChevronRight,
  Inbox
} from 'lucide-react';

export default function AdminDashboard() {
  const [adminUser, setAdminUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [totpRequired, setTotpRequired] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking');

  // Active Tab
  const [activeTab, setActiveTab] = useState('overview');

  // Real API State Datasets
  const [tickets, setTickets] = useState([]);
  const [copyrightClaims, setCopyrightClaims] = useState([]);
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const apiUrl = process.env.NEXT_PUBLIC_MANAGE_API_URL || 'https://cpa-manage.onrender.com';

  useEffect(() => {
    checkHealth();
    checkAuthStatus();
  }, []);

  useEffect(() => {
    if (adminUser) {
      loadTabData(activeTab);
    }
  }, [adminUser, activeTab]);

  const checkHealth = async () => {
    try {
      const res = await fetch(`${apiUrl}/healthz`);
      if (res.ok) setBackendStatus('online');
      else setBackendStatus('degraded');
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
      // Unauthenticated
    } finally {
      setLoading(false);
    }
  };

  const loadTabData = async (tab) => {
    setDataLoading(true);
    try {
      if (tab === 'tickets' || tab === 'overview') {
        const res = await fetch(`${apiUrl}/admin/cases`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setTickets(data.tickets || []);
        }
      } else if (tab === 'copyright') {
        const res = await fetch(`${apiUrl}/admin/claims/copyright`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setCopyrightClaims(data.claims || []);
        }
      } else if (tab === 'moderation') {
        const res = await fetch(`${apiUrl}/admin/users/reports`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setUsers(data.users || []);
        }
      } else if (tab === 'audit') {
        const res = await fetch(`${apiUrl}/admin/audit`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setAuditLogs(data.logs || []);
        }
      }
    } catch (err) {
      // Backend live endpoint fallback (handling initial Phase 0 unmounted routes)
    } finally {
      setDataLoading(false);
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
          setError('2FA Authenticator code required for Root Admin login.');
        } else {
          setError(data.error?.message || 'Invalid email or password.');
        }
        return;
      }

      setAdminUser(data.admin_user);
      setError(null);
    } catch (err) {
      setError('Unable to connect to cpa-manage-backend API.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${apiUrl}/admin/auth/logout`, { method: 'POST', credentials: 'include' });
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
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#090d16' }}>
        <div style={{ textAlign: 'center', color: '#94a3b8' }}>
          <Activity className="pulse-dot" size={36} style={{ marginBottom: 12, color: '#6366f1' }} />
          <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.1rem' }}>Connecting to CPA Manage Engine...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar Navigation */}
      {adminUser && (
        <aside style={{
          width: '260px',
          background: 'rgba(15, 23, 42, 0.95)',
          borderRight: '1px solid var(--border-color)',
          padding: '1.5rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            {/* Brand Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', paddingLeft: '0.5rem' }}>
              <div style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
                padding: '8px',
                borderRadius: '10px',
                display: 'flex',
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
              }}>
                <ShieldCheck size={24} color="#ffffff" />
              </div>
              <div>
                <h1 style={{ fontSize: '1.15rem', fontWeight: 800, background: 'linear-gradient(90deg, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  CPA MANAGE
                </h1>
                <span style={{ fontSize: '0.7rem', color: '#6366f1', fontWeight: 600, letterSpacing: '0.5px' }}>TRUST & SAFETY PLATFORM</span>
              </div>
            </div>

            {/* Nav Menu */}
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {[
                { id: 'overview', label: 'Overview & Stats', icon: PieChart },
                { id: 'tickets', label: 'Support Queue', icon: Ticket, badge: tickets.length > 0 ? String(tickets.length) : null },
                { id: 'copyright', label: 'Copyright & DMCA', icon: Scale, badge: copyrightClaims.length > 0 ? String(copyrightClaims.length) : null },
                { id: 'institutions', label: 'Institution Claims', icon: Building2 },
                { id: 'moderation', label: 'User Moderation', icon: UserX },
                { id: 'email', label: 'Email Campaigns', icon: Mail },
                { id: 'audit', label: 'Audit Logs', icon: FileText },
                ...(adminUser.is_root ? [{ id: 'admins', label: 'Admin Access Control', icon: Users }] : [])
              ].map((item) => {
                const IconComponent = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      fontSize: '0.88rem',
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? '#ffffff' : '#94a3b8',
                      background: isActive ? 'linear-gradient(90deg, rgba(99, 102, 241, 0.25) 0%, rgba(99, 102, 241, 0.05) 100%)' : 'transparent',
                      borderLeft: isActive ? '3px solid #6366f1' : '3px solid transparent',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <IconComponent size={18} color={isActive ? '#818cf8' : '#64748b'} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span style={{ fontSize: '0.7rem', padding: '2px 7px', borderRadius: '12px', backgroundColor: isActive ? '#6366f1' : '#334155', color: '#fff' }}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* User Profile Card Footer */}
          <div className="glass-panel" style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ overflow: 'hidden' }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{adminUser.display_name}</p>
              <span style={{ fontSize: '0.72rem', color: adminUser.is_root ? '#a855f7' : '#34d399', fontWeight: 600 }}>
                {adminUser.is_root ? '👑 Root Administrator' : '🛡️ Moderation Worker'}
              </span>
            </div>
            <button onClick={handleLogout} title="Logout" style={{ background: 'transparent', border: 'none', color: '#f87171', padding: '6px', cursor: 'pointer' }}>
              <LogOut size={18} />
            </button>
          </div>
        </aside>
      )}

      {/* Main App Content Body */}
      <main style={{ flex: 1, padding: '1.5rem 2rem', overflowY: 'auto' }}>
        {/* Top Navbar Header */}
        <header style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '2rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid var(--border-color)'
        }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, textTransform: 'capitalize' }}>
              {activeTab === 'overview' && 'System Overview & Moderation Analytics'}
              {activeTab === 'tickets' && 'Support & Ticket Operations Queue'}
              {activeTab === 'copyright' && 'Copyright & DMCA Content Claims'}
              {activeTab === 'institutions' && 'Institution Profile Claims'}
              {activeTab === 'moderation' && 'User Moderation & Strike Center'}
              {activeTab === 'email' && 'Email Digest & Campaign Manager'}
              {activeTab === 'audit' && 'Append-Only Audit Log Viewer'}
              {activeTab === 'admins' && 'Admin Accounts & IAM Permission Matrix'}
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '2px' }}>
              Logged in as <strong style={{ color: '#fff' }}>{adminUser ? adminUser.email : 'Guest'}</strong> • Live Database Active
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '0.8rem',
              backgroundColor: backendStatus === 'online' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              color: backendStatus === 'online' ? '#34d399' : '#f87171',
              border: `1px solid ${backendStatus === 'online' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
            }}>
              <Server size={14} />
              <span style={{ fontWeight: 600 }}>API Engine: {backendStatus.toUpperCase()}</span>
            </div>
          </div>
        </header>

        {/* Tab 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Open Support Tickets</span>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '8px' }}>
                  <h3 style={{ fontSize: '2rem', fontWeight: 800, color: '#818cf8' }}>{tickets.length}</h3>
                  <span style={{ fontSize: '0.75rem', color: '#34d399', backgroundColor: 'rgba(52, 211, 153, 0.15)', padding: '2px 8px', borderRadius: '10px' }}>Live Sync</span>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Pending Copyright Claims</span>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '8px' }}>
                  <h3 style={{ fontSize: '2rem', fontWeight: 800, color: '#ec4899' }}>{copyrightClaims.length}</h3>
                  <span style={{ fontSize: '0.75rem', color: '#38bdf8', backgroundColor: 'rgba(56, 189, 248, 0.15)', padding: '2px 8px', borderRadius: '10px' }}>Live Sync</span>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Moderation Reports</span>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '8px' }}>
                  <h3 style={{ fontSize: '2rem', fontWeight: 800, color: '#ef4444' }}>{users.length}</h3>
                  <span style={{ fontSize: '0.75rem', color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.15)', padding: '2px 8px', borderRadius: '10px' }}>Live Sync</span>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Audit Entries Logged</span>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '8px' }}>
                  <h3 style={{ fontSize: '2rem', fontWeight: 800, color: '#34d399' }}>{auditLogs.length}</h3>
                  <span style={{ fontSize: '0.75rem', color: '#34d399', backgroundColor: 'rgba(52, 211, 153, 0.15)', padding: '2px 8px', borderRadius: '10px' }}>Database Verified</span>
                </div>
              </div>
            </div>

            {/* Support Queue Live List */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>Active Support Queue</h3>
              {tickets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                  <Inbox size={40} style={{ marginBottom: '12px', color: '#475569' }} />
                  <p style={{ fontWeight: 600, color: '#f8fafc' }}>No active tickets in queue</p>
                  <span style={{ fontSize: '0.85rem' }}>When users report issues or copyright claims, they will appear here in real-time.</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {tickets.map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                      <p style={{ fontWeight: 600 }}>{t.type} — {t.reporter_email}</p>
                      <span style={{ fontSize: '0.8rem', color: '#818cf8' }}>{t.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: SUPPORT QUEUE */}
        {activeTab === 'tickets' && (
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Support & Ticket Operations Queue</h3>
            {tickets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                <Inbox size={48} style={{ marginBottom: '12px', color: '#475569' }} />
                <p style={{ fontWeight: 600, color: '#f8fafc', fontSize: '1.05rem' }}>No open tickets in queue</p>
                <span style={{ fontSize: '0.85rem' }}>All submitted user tickets, copyright complaints, and institution verification requests will populate here directly from the database.</span>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: '#94a3b8' }}>
                    <th style={{ padding: '12px' }}>ID</th>
                    <th style={{ padding: '12px' }}>Type</th>
                    <th style={{ padding: '12px' }}>Reporter</th>
                    <th style={{ padding: '12px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                      <td style={{ padding: '12px', fontWeight: 700, color: '#818cf8' }}>{t.id}</td>
                      <td style={{ padding: '12px' }}>{t.type}</td>
                      <td style={{ padding: '12px' }}>{t.reporter_email}</td>
                      <td style={{ padding: '12px' }}>{t.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 3: COPYRIGHT */}
        {activeTab === 'copyright' && (
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Copyright & DMCA Content Claims</h3>
            {copyrightClaims.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                <Scale size={48} style={{ marginBottom: '12px', color: '#475569' }} />
                <p style={{ fontWeight: 600, color: '#f8fafc', fontSize: '1.05rem' }}>No pending copyright claims</p>
                <span style={{ fontSize: '0.85rem' }}>Claims filed by creators or rights owners will be listed here for approval or dismissal.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {copyrightClaims.map(c => (
                  <div key={c.id} style={{ padding: '1rem', backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                    <p style={{ fontWeight: 600 }}>Claim #{c.id}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 5: MODERATION */}
        {activeTab === 'moderation' && (
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>User Moderation & Strike Center</h3>
            {users.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                <UserX size={48} style={{ marginBottom: '12px', color: '#475569' }} />
                <p style={{ fontWeight: 600, color: '#f8fafc', fontSize: '1.05rem' }}>No active user moderation flags</p>
                <span style={{ fontSize: '0.85rem' }}>Flagged user accounts, strikes, and suspension histories will load here directly from the database.</span>
              </div>
            ) : (
              <div>{/* Render user moderation records */}</div>
            )}
          </div>
        )}

        {/* Tab 7: AUDIT */}
        {activeTab === 'audit' && (
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Append-Only System Audit Log</h3>
            {auditLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                <FileText size={48} style={{ marginBottom: '12px', color: '#475569' }} />
                <p style={{ fontWeight: 600, color: '#f8fafc', fontSize: '1.05rem' }}>No audit log entries recorded yet</p>
                <span style={{ fontSize: '0.85rem' }}>Every write operation performed by admins will be recorded in the immutable audit log table.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {auditLogs.map(a => (
                  <div key={a.id} style={{ padding: '12px', backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                    <p style={{ fontWeight: 600 }}>{a.action} by {a.actor_admin_id}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 8: ADMIN ACCESS CONTROL (Root Only) */}
        {activeTab === 'admins' && adminUser?.is_root && (
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>IAM Permission Matrix & Worker Management</h3>
            <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '1.5rem' }}>As Root Administrator, you can assign any of the 21 fixed permissions to worker accounts. (`admin.manage` is root-only and non-assignable).</p>
            <div style={{ padding: '1rem', backgroundColor: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '10px', color: '#818cf8', fontSize: '0.85rem' }}>
              🔐 <strong>Root Gate Enforcement:</strong> All write actions require non-root worker accounts to hold explicit permission keys in `admin_user_permissions`. Root accounts bypass permission checks.
            </div>
          </div>
        )}
      </main>
    </div>
  );

  return (
    <main style={{ minHeight: '100vh', padding: '2rem 1rem', maxWidth: '420px', margin: '4rem auto 0 auto' }}>
      {/* Login Card */}
      <div className="glass-panel" style={{ padding: '2rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)' }}>
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
                className="glass-input"
                style={{ width: '100%', paddingLeft: '38px' }}
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
                className="glass-input"
                style={{ width: '100%', paddingLeft: '38px' }}
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
                className="glass-input"
                style={{ width: '100%', letterSpacing: '4px', textAlign: 'center', borderColor: '#6366f1' }}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem', opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? 'Authenticating...' : totpRequired ? 'Verify 2FA & Sign In' : 'Sign In to Admin Portal'}
          </button>
        </form>
      </div>
    </main>
  );
}
