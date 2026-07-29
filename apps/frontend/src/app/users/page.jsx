'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserX, Search, RefreshCw, AlertTriangle, ShieldAlert, Ban, Clock, X } from 'lucide-react';
import AdminShell from '../../components/shell/AdminShell';
import StatusPill from '../../components/ui/StatusPill';
import { tokens } from '../theme/tokens';

export default function StandaloneUsersPage() {
  const router = useRouter();
  const [adminUser, setAdminUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Action modal states: { type: 'strike' | 'suspend' | 'ban', userId: string }
  const [activeModal, setActiveModal] = useState(null);
  const [reason, setReason] = useState('');
  const [suspendedUntil, setSuspendedUntil] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_MANAGE_API_URL || 'http://localhost:4000';

  useEffect(() => {
    checkAuthStatus();
  }, []);

  useEffect(() => {
    if (adminUser) {
      loadUsers();
    }
  }, [adminUser]);

  const checkAuthStatus = async () => {
    try {
      const res = await fetch(`${apiUrl}/admin/auth/me`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAdminUser(data.admin_user);
      }
    } catch (err) {
      console.error('Auth check failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    setDataLoading(true);
    try {
      const res = await fetch(`${apiUrl}/admin/users`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error('Failed to load user moderation data:', err);
    } finally {
      setDataLoading(false);
    }
  };

  const handleExecuteUserAction = async (e) => {
    e.preventDefault();
    if (!reason || !activeModal) return;
    setSubmitting(true);

    const { type, userId } = activeModal;
    let endpoint = `${apiUrl}/admin/users/${userId}/${type === 'strike' ? 'strikes' : type}`;

    const payload = { reason };
    if (type === 'suspend' && suspendedUntil) {
      payload.until = suspendedUntil;
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error?.message || data.message || `Failed to execute ${type} action.`);
        return;
      }

      alert(`Successfully executed ${type.toUpperCase()} for User ${userId}.`);
      setActiveModal(null);
      setReason('');
      setSuspendedUntil('');
      loadUsers();
    } catch (err) {
      alert(err.message || `Network error executing ${type} action.`);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredUsers = users.filter(u => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return String(u.user_id).toLowerCase().includes(q);
  });

  return (
    <AdminShell
      adminUser={adminUser}
      activeTab="users"
      breadcrumb={['Users', 'User Moderation']}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Header Title Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: tokens.typography.title.fontSize, fontWeight: tokens.typography.title.fontWeight, color: tokens.colors.textPrimary, margin: 0 }}>
              User Moderation & Account Discipline
            </h1>
            <p style={{ fontSize: tokens.typography.small.fontSize, color: tokens.colors.textSecondary, margin: '4px 0 0 0' }}>
              Issue warnings/strikes, temporary account suspensions, or permanent bans
            </p>
          </div>
          <button
            onClick={loadUsers}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '6px',
              backgroundColor: tokens.colors.surfaceElevated,
              border: `1px solid ${tokens.colors.borderSubtle}`,
              color: tokens.colors.textPrimary,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} className={dataLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Filter Toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px 18px',
            borderRadius: '10px',
            backgroundColor: tokens.colors.surfaceElevated,
            border: `1px solid ${tokens.colors.borderSubtle}`,
          }}
        >
          <div style={{ position: 'relative', flex: 1, maxWidth: '360px' }}>
            <Search size={14} color={tokens.colors.textMuted} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search by User UUID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px 8px 32px',
                borderRadius: '6px',
                backgroundColor: tokens.colors.bgDark,
                border: `1px solid ${tokens.colors.borderSubtle}`,
                color: tokens.colors.textPrimary,
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Users Data Table */}
        <div
          style={{
            borderRadius: '10px',
            backgroundColor: tokens.colors.surfaceElevated,
            border: `1px solid ${tokens.colors.borderSubtle}`,
            overflow: 'hidden',
          }}
        >
          {dataLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: tokens.colors.textMuted }}>
              Loading user moderation status list...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: tokens.colors.textMuted }}>
              <UserX size={44} color={tokens.colors.textMuted} style={{ marginBottom: '12px' }} />
              <p style={{ fontSize: '15px', fontWeight: '600', color: tokens.colors.textPrimary, margin: 0 }}>No flagged users found</p>
              <span style={{ fontSize: '13px' }}>Users with active strikes, suspensions, or reported cases will appear here.</span>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${tokens.colors.borderSubtle}`, backgroundColor: 'rgba(15, 23, 42, 0.4)', color: tokens.colors.textMuted }}>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>USER ID</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>MODERATION STATUS</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>STRIKES COUNT</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>ACTIVE REPORTS</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr
                    key={u.user_id}
                    style={{
                      borderBottom: `1px solid ${tokens.colors.borderSubtle}`,
                    }}
                  >
                    <td style={{ padding: '12px 16px', fontFamily: tokens.typography.mono.fontFamily, fontWeight: '700', color: tokens.colors.textPrimary }}>
                      {u.user_id}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <StatusPill status={u.moderation_status || 'active'} />
                      {u.suspended_until && (
                        <span style={{ display: 'block', fontSize: '11px', color: tokens.colors.textMuted, marginTop: '2px' }}>
                          Until: {new Date(u.suspended_until).toLocaleDateString()}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '700',
                          backgroundColor: u.strike_count >= 3 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                          color: u.strike_count >= 3 ? '#F87171' : '#FBBF24',
                        }}
                      >
                        {u.strike_count || 0} / 3 Strikes
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: tokens.colors.textSecondary }}>
                      {u.report_count || 0} Reports
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button
                          onClick={() => setActiveModal({ type: 'strike', userId: u.user_id })}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(245, 158, 11, 0.15)',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            color: '#FBBF24',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                          }}
                        >
                          Strike
                        </button>
                        <button
                          onClick={() => setActiveModal({ type: 'suspend', userId: u.user_id })}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#F87171',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                          }}
                        >
                          Suspend
                        </button>
                        <button
                          onClick={() => setActiveModal({ type: 'ban', userId: u.user_id })}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            backgroundColor: '#EF4444',
                            border: 'none',
                            color: '#FFFFFF',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                          }}
                        >
                          Ban
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* User Moderation Action Modal */}
        {activeModal && (
          <div
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(4px)',
              zIndex: 50,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '480px',
                backgroundColor: tokens.colors.surfaceElevated,
                border: `1px solid ${tokens.colors.borderSubtle}`,
                borderRadius: '12px',
                padding: '24px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: tokens.colors.textPrimary, margin: 0, textTransform: 'capitalize' }}>
                  Execute {activeModal.type} Action
                </h3>
                <button onClick={() => setActiveModal(null)} style={{ background: 'none', border: 'none', color: tokens.colors.textMuted, cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>

              <p style={{ fontSize: '13px', color: tokens.colors.textSecondary, marginBottom: '16px' }}>
                Target User UUID: <strong style={{ color: tokens.colors.primary, fontFamily: tokens.typography.mono.fontFamily }}>{activeModal.userId}</strong>
              </p>

              <form onSubmit={handleExecuteUserAction} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: tokens.colors.textMuted, marginBottom: '6px' }}>Reason / Justification</label>
                  <textarea
                    required
                    rows={4}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Enter factual moderation reason for this action..."
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      backgroundColor: tokens.colors.bgDark,
                      border: `1px solid ${tokens.colors.borderSubtle}`,
                      color: tokens.colors.textPrimary,
                      fontSize: '13px',
                      outline: 'none',
                      resize: 'vertical',
                    }}
                  />
                </div>

                {activeModal.type === 'suspend' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: tokens.colors.textMuted, marginBottom: '6px' }}>Suspended Until Date (Optional)</label>
                    <input
                      type="date"
                      value={suspendedUntil}
                      onChange={(e) => setSuspendedUntil(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        backgroundColor: tokens.colors.bgDark,
                        border: `1px solid ${tokens.colors.borderSubtle}`,
                        color: tokens.colors.textPrimary,
                        fontSize: '13px',
                        outline: 'none',
                      }}
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    backgroundColor: activeModal.type === 'ban' ? '#EF4444' : tokens.colors.primary,
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {submitting ? 'Executing...' : `Confirm & Apply ${activeModal.type.toUpperCase()}`}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
