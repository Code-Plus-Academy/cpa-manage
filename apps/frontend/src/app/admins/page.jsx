'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, ArrowLeft, ShieldCheck, AlertTriangle, Key, Trash2, Edit3, Check, X } from 'lucide-react';
import AdminShell from '../../components/shell/AdminShell';

export default function AdminIAMPage() {
  const router = useRouter();
  const [adminUser, setAdminUser] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);

  // New admin form state
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  // OTP Verification Modal state
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpVerifyEmail, setOtpVerifyEmail] = useState('');
  const [otpInputCode, setOtpInputCode] = useState('');
  const [otpSubmitError, setOtpSubmitError] = useState(null);
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const [otpSuccessMsg, setOtpSuccessMsg] = useState(null);

  // Edit Permissions Modal state
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [editPermissions, setEditPermissions] = useState([]);
  const [editingSubmitting, setEditingSubmitting] = useState(false);
  const [editError, setEditError] = useState(null);

  // Delete Worker Admin state
  const [deletingAdmin, setDeletingAdmin] = useState(null);
  const [deletingSubmitting, setDeletingSubmitting] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_MANAGE_API_URL || 'http://localhost:4000';

  const PERMISSION_GROUPS = [
    {
      group: 'TRUST & SAFETY',
      items: [
        { key: 'support.view', label: 'Support Tickets' },
        { key: 'claims.copyright.view', label: 'Copyright Claims' },
        { key: 'claims.institution.view', label: 'Institution Claims' },
        { key: 'claims.reclaim.view', label: 'Content Reclaim Claims' }
      ]
    },
    {
      group: 'HIRING & RECRUITMENT',
      items: [
        { key: 'hiring.manage', label: 'Careers & Hiring' }
      ]
    },
    {
      group: 'USERS',
      items: [
        { key: 'users.reports.view', label: 'User Moderation' }
      ]
    },
    {
      group: 'CONTENT',
      items: [
        { key: 'content.moderation.view', label: 'Content Moderation' }
      ]
    },
    {
      group: 'COMMUNICATIONS',
      items: [
        { key: 'email.templates.edit', label: 'Email System' }
      ]
    },
    {
      group: 'ADMINISTRATION',
      items: [
        { key: 'audit.view', label: 'Audit Log' },
        { key: 'system.status.view', label: 'System Status' }
      ]
    }
  ];

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
    setCreateError(null);
    setCreating(true);

    try {
      const res = await fetch(`${apiUrl}/admin/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          display_name: displayName,
          password,
          permissions: selectedPermissions,
        }),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error?.message || 'Failed to create worker admin.');
      }

      setOtpVerifyEmail(email);
      setOtpInputCode('');
      setOtpSubmitError(null);
      setOtpSuccessMsg(null);
      setShowOtpModal(true);

      setEmail('');
      setDisplayName('');
      setPassword('');
      setSelectedPermissions([]);
      loadAdmins();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setOtpSubmitError(null);
    setOtpSuccessMsg(null);
    setOtpSubmitting(true);

    try {
      const res = await fetch(`${apiUrl}/admin/auth/verify-worker-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: otpVerifyEmail, otp_code: otpInputCode }),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error?.message || 'Invalid registration OTP code.');
      }

      setOtpSuccessMsg('Worker Admin account activated successfully!');
      setTimeout(() => {
        setShowOtpModal(false);
        setOtpInputCode('');
        setOtpSuccessMsg(null);
        loadAdmins();
      }, 1500);
    } catch (err) {
      setOtpSubmitError(err.message);
    } finally {
      setOtpSubmitting(false);
    }
  };

  const handleSavePermissions = async (e) => {
    e.preventDefault();
    if (!editingAdmin) return;
    setEditError(null);
    setEditingSubmitting(true);

    try {
      const res = await fetch(`${apiUrl}/admin/admins/${editingAdmin.id}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: editPermissions }),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error?.message || 'Failed to update permissions.');
      }

      setEditingAdmin(null);
      setEditPermissions([]);
      loadAdmins();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditingSubmitting(false);
    }
  };

  const handleDeleteAdmin = async () => {
    if (!deletingAdmin) return;
    setDeletingSubmitting(true);

    try {
      const res = await fetch(`${apiUrl}/admin/admins/${deletingAdmin.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error?.message || 'Failed to delete worker admin.');
      }

      setDeletingAdmin(null);
      loadAdmins();
    } catch (err) {
      alert(err.message || 'Error deleting admin.');
    } finally {
      setDeletingSubmitting(false);
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
            <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Root-only management of worker admin accounts, role permissions, and OTP activations</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 24 }}>
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
                      <div>
                        <strong style={{ fontSize: '1rem', color: '#fff' }}>{a.display_name}</strong>
                        <span style={{ marginLeft: 8, fontSize: '0.75rem', padding: '2px 8px', borderRadius: 10, backgroundColor: a.is_root ? '#a855f7' : '#334155', color: '#fff', fontWeight: 600 }}>
                          {a.is_root ? 'ROOT ADMIN' : 'WORKER'}
                        </span>
                        <span style={{ marginLeft: 6, fontSize: '0.7rem', padding: '2px 6px', borderRadius: 10, backgroundColor: a.status === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: a.status === 'active' ? '#34d399' : '#fbbf24', border: a.status === 'active' ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(245,158,11,0.3)', fontWeight: 600 }}>
                          {a.status?.toUpperCase()}
                        </span>
                      </div>

                      {!a.is_root && adminUser?.is_root && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAdmin(a);
                              setEditPermissions(a.permissions || []);
                              setEditError(null);
                            }}
                            style={{ padding: '4px 10px', borderRadius: 6, backgroundColor: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            <Edit3 size={12} /> Edit Perms
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingAdmin(a)}
                            style={{ padding: '4px 10px', borderRadius: 6, backgroundColor: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      )}
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
            
            {createError && (
              <div style={{ backgroundColor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#F87171', padding: '10px 14px', borderRadius: 8, fontSize: '0.8rem', marginBottom: 16 }}>
                {createError}
              </div>
            )}

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

              {/* Module Access Permissions */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc', marginBottom: 8 }}>Module Access Permissions</label>
                <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, backgroundColor: 'rgba(15,23,42,0.6)', padding: 10, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  {PERMISSION_GROUPS.map(g => (
                    <div key={g.group}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.05em' }}>{g.group}</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                        {g.items.map(i => (
                          <label key={i.key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: '#cbd5e1', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={selectedPermissions.includes(i.key)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedPermissions([...selectedPermissions, i.key]);
                                else setSelectedPermissions(selectedPermissions.filter(p => p !== i.key));
                              }}
                            />
                            {i.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button type="submit" disabled={creating} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                {creating ? 'Creating Account...' : 'Create Worker Admin'}
              </button>
            </form>
          </div>
        </div>

        {/* OTP VERIFICATION MODAL */}
        {showOtpModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ maxWidth: 420, width: '100%', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 12, padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', marginBottom: 6 }}>Verify Worker Admin OTP</h2>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: 16 }}>
                A 6-digit registration OTP has been sent to <strong>{otpVerifyEmail}</strong>. Please enter the passcode below to activate the worker account.
              </p>

              {otpSubmitError && (
                <div style={{ backgroundColor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#F87171', padding: '10px 14px', borderRadius: 8, fontSize: '0.8rem', marginBottom: 16 }}>
                  {otpSubmitError}
                </div>
              )}

              {otpSuccessMsg && (
                <div style={{ backgroundColor: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#34D399', padding: '10px 14px', borderRadius: 8, fontSize: '0.8rem', marginBottom: 16 }}>
                  {otpSuccessMsg}
                </div>
              )}

              <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Enter 6-Digit OTP Code</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="e.g. 123456"
                    value={otpInputCode}
                    onChange={(e) => setOtpInputCode(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 6, backgroundColor: '#020617', border: '1px solid #334155', color: '#f8fafc', fontSize: '1.2rem', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '4px', textAlign: 'center', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                  <button
                    type="button"
                    onClick={() => setShowOtpModal(false)}
                    className="btn-secondary"
                  >
                    Close & Verify Later
                  </button>
                  <button
                    type="submit"
                    disabled={otpSubmitting}
                    className="btn-primary"
                  >
                    {otpSubmitting ? 'Verifying...' : 'Verify & Activate Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* EDIT WORKER ADMIN PERMISSIONS MODAL */}
        {editingAdmin && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ maxWidth: 440, width: '100%', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 12, padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', marginBottom: 4 }}>Edit Permissions</h2>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: 16 }}>
                Update access permissions for <strong>{editingAdmin.display_name}</strong> ({editingAdmin.email})
              </p>

              {editError && (
                <div style={{ backgroundColor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#F87171', padding: '10px 14px', borderRadius: 8, fontSize: '0.8rem', marginBottom: 16 }}>
                  {editError}
                </div>
              )}

              <form onSubmit={handleSavePermissions} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc', display: 'block', marginBottom: 8 }}>Module Access Permissions</label>
                  <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, backgroundColor: '#020617', padding: 10, borderRadius: 6, border: '1px solid #334155' }}>
                    {PERMISSION_GROUPS.map(g => (
                      <div key={g.group}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.05em' }}>{g.group}</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                          {g.items.map(i => (
                            <label key={i.key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: '#cbd5e1', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={editPermissions.includes(i.key)}
                                onChange={(e) => {
                                  if (e.target.checked) setEditPermissions([...editPermissions, i.key]);
                                  else setEditPermissions(editPermissions.filter(p => p !== i.key));
                                }}
                              />
                              {i.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                  <button
                    type="button"
                    onClick={() => setEditingAdmin(null)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editingSubmitting}
                    className="btn-primary"
                  >
                    {editingSubmitting ? 'Saving...' : 'Save Permissions'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* DELETE WORKER ADMIN CONFIRMATION MODAL */}
        {deletingAdmin && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ maxWidth: 400, width: '100%', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 12, padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <AlertTriangle size={20} color="#EF4444" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>Delete Worker Admin</h3>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Permanent Account Revocation</span>
                </div>
              </div>

              <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.5, marginBottom: 20 }}>
                Are you sure you want to delete worker admin <strong>{deletingAdmin.display_name}</strong> ({deletingAdmin.email})? This will revoke all their permissions and terminate active sessions immediately.
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setDeletingAdmin(null)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deletingSubmitting}
                  onClick={handleDeleteAdmin}
                  style={{ padding: '8px 16px', borderRadius: 6, backgroundColor: '#EF4444', border: 'none', color: '#FFFFFF', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  {deletingSubmitting ? 'Deleting...' : 'Delete Admin'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
