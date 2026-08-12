'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldAlert, Lock, Mail, Key, Activity, Server, AlertCircle, LogOut, CheckCircle2,
  Ticket, Scale, Building2, UserX, FileText, Users, Search, Filter, Clock, Eye,
  ArrowRight, Check, X, RefreshCw, Send, Calendar, PieChart, Sparkles, ChevronRight,
  MoreVertical, ChevronLeft, AlertTriangle, ShieldCheck
} from 'lucide-react';
import AdminShell from '../components/shell/AdminShell';
import StatusPill from '../components/ui/StatusPill';
import { tokens } from './theme/tokens';

export default function AdminDashboard() {
  const router = useRouter();
  const [adminUser, setAdminUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Active view tab
  const [activeTab, setActiveTab] = useState('tickets');

  // Filters state
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Data states
  const [tickets, setTickets] = useState([]);
  const [copyrightClaims, setCopyrightClaims] = useState([]);
  const [institutionClaims, setInstitutionClaims] = useState([]);
  const [reclaimClaims, setReclaimClaims] = useState([]);
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [adminsList, setAdminsList] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Detail & Action modal state
  const [selectedItem, setSelectedItem] = useState(null);
  const [actionReason, setActionReason] = useState('');
  const [confirmModal, setConfirmModal] = useState(null); // { title, description, actionType, onConfirm }

  // Create Worker Admin state
  const [showCreateAdminModal, setShowCreateAdminModal] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [adminSubmitError, setAdminSubmitError] = useState(null);
  const [adminSubmitting, setAdminSubmitting] = useState(false);

  // OTP Verification Modal state
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpVerifyEmail, setOtpVerifyEmail] = useState('');
  const [otpInputCode, setOtpInputCode] = useState('');
  const [otpSubmitError, setOtpSubmitError] = useState(null);
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const [otpSuccessMsg, setOtpSuccessMsg] = useState(null);

  // Edit & Delete Worker Admin state
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [editAdminPermissions, setEditAdminPermissions] = useState([]);
  const [editAdminSubmitting, setEditAdminSubmitting] = useState(false);
  const [deletingAdmin, setDeletingAdmin] = useState(null);
  const [deleteAdminSubmitting, setDeleteAdminSubmitting] = useState(false);

  // In-App Direct Email Modal state
  const [showDirectEmailModal, setShowDirectEmailModal] = useState(false);
  const [directEmailRecipient, setDirectEmailRecipient] = useState('');
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('moderation_action_notice');
  const [directEmailSubject, setDirectEmailSubject] = useState('');
  const [directEmailBody, setDirectEmailBody] = useState('');
  const [directEmailSubmitting, setDirectEmailSubmitting] = useState(false);
  const [directEmailSuccess, setDirectEmailSuccess] = useState(null);

  const handleSendDirectEmail = async (e) => {
    e.preventDefault();
    if (!directEmailRecipient || !selectedItem) return;
    setDirectEmailSubmitting(true);
    try {
      const payloadBody = selectedTemplateKey !== 'custom' ? {
        template_key: selectedTemplateKey,
        recipient_email: directEmailRecipient,
        payload: {
          name: selectedItem.publisher_name || selectedItem.content_summary?.owner_username || 'Creator / User',
          ticket_id: String(selectedItem.id),
          action_type: selectedItem.status || 'notice',
          reason: directEmailBody || 'Administrative compliance review',
          content_title: selectedItem.content_summary?.title || selectedItem.category || 'Content Item',
        }
      } : {
        recipient_email: directEmailRecipient,
        subject: directEmailSubject,
        message: directEmailBody,
      };

      const res = await apiFetch(`/admin/cases/${selectedItem.id}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadBody),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error?.message || 'Failed to send email.');
        return;
      }
      setDirectEmailSuccess(`Email dispatched successfully to ${directEmailRecipient}!`);
      setTimeout(() => {
        setShowDirectEmailModal(false);
        setDirectEmailSuccess(null);
        setDirectEmailBody('');
        loadTabData(activeTab);
      }, 1500);
    } catch (err) {
      alert('Network error sending email.');
    } finally {
      setDirectEmailSubmitting(false);
    }
  };

  const apiUrl = process.env.NEXT_PUBLIC_MANAGE_API_URL || 'http://localhost:4000';

  const apiFetch = async (path, options = {}) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('cpa_admin_token') : null;
    const headers = { ...options.headers };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });
    if (res.status === 401) {
      try {
        const cloned = res.clone();
        const errBody = await cloned.json();
        // Only clear session if the server explicitly says session expired
        if (errBody?.error?.code === 'SESSION_EXPIRED' || errBody?.error?.code === 'UNAUTHENTICATED') {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('cpa_admin_token');
          }
          setAdminUser(null);
        }
      } catch (parseErr) {
        // If we can't parse the error body, don't destroy the session (could be a network blip)
        console.warn('[apiFetch] 401 received but could not parse error body — keeping session');
      }
    }
    return res;
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  useEffect(() => {
    if (adminUser) {
      router.replace('/tickets');
    }
  }, [adminUser]);

  const checkAuthStatus = async (retryCount = 0) => {
    try {
      const res = await apiFetch('/admin/auth/me');
      if (res.ok) {
        const data = await res.json();
        setAdminUser(data.admin_user);
      } else if (res.status === 401 && retryCount === 0) {
        // On first 401, wait 3s and retry once (Render cold start can cause transient 401s)
        const token = typeof window !== 'undefined' ? localStorage.getItem('cpa_admin_token') : null;
        if (token) {
          console.info('[Auth] Initial auth check failed, retrying in 3s (possible cold start)...');
          await new Promise(resolve => setTimeout(resolve, 3000));
          return checkAuthStatus(1);
        }
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      if (retryCount === 0) {
        // Network error on first try — retry once after delay
        await new Promise(resolve => setTimeout(resolve, 3000));
        return checkAuthStatus(1);
      }
    } finally {
      if (retryCount === 0 || retryCount === 1) {
        setLoading(false);
      }
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = { email, password };
      if (totpCode) payload.totp_code = totpCode;

      const res = await fetch(`${apiUrl}/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || data.message || 'Authentication failed');
      }
      if (data.token) {
        localStorage.setItem('cpa_admin_token', data.token);
      }
      setAdminUser(data.admin_user);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/admin/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('cpa_admin_token');
      }
      setAdminUser(null);
      setSelectedItem(null);
    }
  };

  const loadTabData = async (tab) => {
    setDataLoading(true);
    try {
      if (tab === 'tickets') {
        const queryParams = new URLSearchParams();
        if (statusFilter !== 'all') queryParams.append('status', statusFilter);
        queryParams.append('page', currentPage);

        const res = await apiFetch(`/admin/cases?${queryParams}`);
        if (res.ok) {
          const data = await res.json();
          setTickets(data.cases || []);
        }
      } else if (tab === 'copyright') {
        const res = await apiFetch('/admin/cases?type=copyright');
        if (res.ok) {
          const data = await res.json();
          setCopyrightClaims(data.cases || []);
        }
      } else if (tab === 'institutions') {
        const res = await apiFetch('/admin/institution-claims');
        if (res.ok) {
          const data = await res.json();
          setInstitutionClaims(data.claims || []);
        }
      } else if (tab === 'reclaim') {
        const res = await apiFetch('/admin/cases?type=ownership_transfer');
        if (res.ok) {
          const data = await res.json();
          setReclaimClaims(data.cases || []);
        }
      } else if (tab === 'users') {
        const res = await apiFetch('/admin/users/reports');
        if (res.ok) {
          const data = await res.json();
          setUsers(data.reports || []);
        }
      } else if (tab === 'audit') {
        const res = await apiFetch('/admin/audit-log');
        if (res.ok) {
          const data = await res.json();
          setAuditLogs(data.logs || []);
        }
      } else if (tab === 'admins' && adminUser?.is_root) {
        const res = await apiFetch('/admin/admins');
        if (res.ok) {
          const data = await res.json();
          setAdminsList(data.admins || []);
        }
      }
    } catch (err) {
      console.error(`Failed to load ${tab} data:`, err);
    } finally {
      setDataLoading(false);
    }
  };

  const [refiningAi, setRefiningAi] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState([]);

  const handleRefineJustificationWithAI = async () => {
    if (!actionReason || !actionReason.trim()) {
      alert('Please enter initial raw notes before refining with AI.');
      return;
    }
    setRefiningAi(true);
    try {
      const res = await apiFetch('/admin/cases/refine-justification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_notes: actionReason, case_type: selectedItem?.type || 'moderation' }),
      });
      if (res.ok) {
        const data = await res.json();
        setActionReason(data.refined_justification);
      }
    } catch (err) {
      console.error('Failed to refine justification:', err);
    } finally {
      setRefiningAi(false);
    }
  };

  const handleTicketAction = async (ticketId, actionType, strike = false, customReason = null) => {
    const finalReason = customReason || actionReason;
    if (!finalReason || !finalReason.trim()) {
      alert('Please enter a justification reason.');
      return;
    }
    try {
      const res = await apiFetch(`/admin/cases/${ticketId}/action`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_type: actionType, reason: finalReason, issue_strike: strike }),
      });
      if (res.ok) {
        setActionReason('');
        setConfirmModal(null);
        setSelectedItem(null);
        loadTabData(activeTab);
      } else {
        const err = await res.json();
        alert(err.message || 'Action failed');
      }
    } catch (err) {
      alert('Failed to process action');
    }
  };

  const handleCreateAdminWorker = async (e) => {
    e.preventDefault();
    setAdminSubmitError(null);
    setAdminSubmitting(true);
    try {
      const res = await apiFetch('/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newAdminEmail,
          display_name: newAdminName,
          password: newAdminPassword,
          permissions: selectedPermissions,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error?.message || 'Failed to create worker admin');
      }
      setShowCreateAdminModal(false);
      setOtpVerifyEmail(newAdminEmail);
      setOtpInputCode('');
      setOtpSubmitError(null);
      setOtpSuccessMsg(null);
      setShowOtpModal(true);

      setNewAdminEmail('');
      setNewAdminName('');
      setNewAdminPassword('');
      setSelectedPermissions([]);
      loadTabData('admins');
    } catch (err) {
      setAdminSubmitError(err.message);
    } finally {
      setAdminSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setOtpSubmitError(null);
    setOtpSuccessMsg(null);
    setOtpSubmitting(true);
    try {
      const res = await apiFetch('/admin/auth/verify-worker-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: otpVerifyEmail,
          otp_code: otpInputCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error?.message || 'Invalid OTP code');
      }
      setOtpSuccessMsg('Worker Admin account activated successfully!');
      setTimeout(() => {
        setShowOtpModal(false);
        setOtpInputCode('');
        setOtpSuccessMsg(null);
        loadTabData('admins');
      }, 1500);
    } catch (err) {
      setOtpSubmitError(err.message);
    } finally {
      setOtpSubmitting(false);
    }
  };

  const handleUpdateAdminPermissions = async (e) => {
    e.preventDefault();
    if (!editingAdmin) return;
    setEditAdminSubmitting(true);
    try {
      const res = await apiFetch(`/admin/admins/${editingAdmin.id}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: editAdminPermissions }),
      });
      if (res.ok) {
        setEditingAdmin(null);
        setEditAdminPermissions([]);
        loadTabData('admins');
      } else {
        const errData = await res.json();
        alert(errData.message || errData.error?.message || 'Failed to update permissions');
      }
    } catch (err) {
      alert(err.message || 'Network error updating permissions');
    } finally {
      setEditAdminSubmitting(false);
    }
  };

  const handleDeleteWorkerAdmin = async () => {
    if (!deletingAdmin) return;
    setDeleteAdminSubmitting(true);
    try {
      const res = await apiFetch(`/admin/admins/${deletingAdmin.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setDeletingAdmin(null);
        loadTabData('admins');
      } else {
        const errData = await res.json();
        alert(errData.message || errData.error?.message || 'Failed to delete worker admin');
      }
    } catch (err) {
      alert(err.message || 'Network error deleting worker admin');
    } finally {
      setDeleteAdminSubmitting(false);
    }
  };

  // ── UNAUTHENTICATED / LOGIN VIEW ──────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: tokens.colors.bgDark, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <RefreshCw size={24} color={tokens.colors.primary} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (!adminUser) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: tokens.colors.bgDark, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ maxWidth: '420px', width: '100%', backgroundColor: tokens.colors.surfaceElevated, border: `1px solid ${tokens.colors.borderSubtle}`, borderRadius: '12px', padding: '32px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: tokens.colors.primary, margin: '0 auto 12px auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={26} color="#FFFFFF" />
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: '700', color: tokens.colors.textPrimary }}>Admin Operations Login</h1>
            <p style={{ fontSize: '13px', color: tokens.colors.textSecondary, marginTop: '4px' }}>Code Plus Academy Trust & Safety Platform</p>
          </div>

          {error && (
            <div style={{ backgroundColor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#F87171', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: tokens.colors.textSecondary, display: 'block', marginBottom: '6px' }}>Admin Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@codeplusacademy.in"
                required
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: tokens.colors.bgDark, border: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textPrimary, fontSize: '14px', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: tokens.colors.textSecondary, display: 'block', marginBottom: '6px' }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: tokens.colors.bgDark, border: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textPrimary, fontSize: '14px', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: tokens.colors.textSecondary, display: 'block', marginBottom: '6px' }}>2FA / TOTP Verification Code (Mandatory for Root)</label>
              <input
                type="text"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                placeholder="6-digit code (e.g. 123456)"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: tokens.colors.bgDark, border: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textPrimary, fontSize: '14px', outline: 'none', fontFamily: 'JetBrains Mono, monospace' }}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: tokens.colors.primary,
                color: '#FFFFFF',
                fontWeight: '600',
                fontSize: '14px',
                border: 'none',
                cursor: submitting ? 'default' : 'pointer',
                opacity: submitting ? 0.7 : 1,
                marginTop: '8px',
              }}
            >
              {submitting ? 'Authenticating...' : 'Sign In to Dashboard'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── AUTHENTICATED DASHBOARD SHELL & VIEWS ──────────────────────────────────
  const getBreadcrumb = () => {
    switch (activeTab) {
      case 'tickets': return ['Trust & Safety', 'Support Tickets'];
      case 'copyright': return ['Trust & Safety', 'Copyright Claims'];
      case 'institutions': return ['Trust & Safety', 'Institution Claims'];
      case 'reclaim': return ['Trust & Safety', 'Content Reclaim Claims'];
      case 'users': return ['Users', 'User Moderation'];
      case 'content': return ['Content', 'Content Moderation'];
      case 'email': return ['Communications', 'Email System'];
      case 'audit': return ['Administration', 'Audit Log'];
      case 'admins': return ['Administration', 'Admin Management'];
      default: return ['Dashboard'];
    }
  };

  return (
    <AdminShell
      adminUser={adminUser}
      activeTab={activeTab}
      onTabChange={(tab) => {
        if (tab === 'hiring') {
          router.push('/hiring');
          return;
        }
        setActiveTab(tab);
        setSelectedItem(null);
        setCurrentPage(1);
      }}
      onLogout={handleLogout}
      breadcrumb={getBreadcrumb()}
      slaAlertCount={tickets.filter(t => t.status === 'open' && new Date(t.sla_resolve_by) < new Date()).length}
    >
      {/* ── CONFIRMATION MODAL FOR HIGH-IMPACT ACTIONS ─────────────────────── */}
      {confirmModal && (
        <div className="modal-overlay" onClick={() => setConfirmModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={20} color="#EF4444" />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: tokens.colors.textPrimary }}>{confirmModal.title}</h3>
                <span style={{ fontSize: '12px', color: tokens.colors.textMuted }}>High-Impact Operational Action</span>
              </div>
            </div>

            <p style={{ fontSize: '13px', color: tokens.colors.textSecondary, lineHeight: '1.6', marginBottom: '20px' }}>
              {confirmModal.description}
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: tokens.colors.textSecondary, display: 'block', marginBottom: '6px' }}>
                Required Audit Justification Reason
              </label>
              <textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="State the exact policy rationale for this decision..."
                rows={3}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: tokens.colors.bgDark, border: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textPrimary, fontSize: '13px', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setConfirmModal(null)}
                style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: 'transparent', border: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textPrimary, fontSize: '13px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => confirmModal.onConfirm()}
                style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: confirmModal.isDanger ? '#EF4444' : tokens.colors.primary, border: 'none', color: '#FFFFFF', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}
              >
                Confirm Action
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DETAIL VIEW OVERLAY (2-COLUMN LAYOUT) ──────────────────────────── */}
      {selectedItem ? (
        <div style={{ backgroundColor: tokens.colors.surfaceElevated, border: `1px solid ${tokens.colors.borderSubtle}`, borderRadius: '12px', padding: '24px' }}>
          <button
            onClick={() => setSelectedItem(null)}
            style={{ background: 'none', border: 'none', color: tokens.colors.primary, fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '20px' }}
          >
            <ChevronLeft size={16} /> Back to List
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '65% 35%', gap: '24px', alignItems: 'start' }}>
            {/* Left 65% Column: Description, Evidence, Logs */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', color: tokens.colors.textMuted }}>ID: {selectedItem.id}</span>
                <StatusPill status={selectedItem.status} />
              </div>

              <h2 style={{ fontSize: '20px', fontWeight: '700', color: tokens.colors.textPrimary, marginBottom: '12px' }}>
                {selectedItem.category || selectedItem.type || 'Support Case'}
              </h2>

              <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '8px', border: `1px solid ${tokens.colors.borderSubtle}`, marginBottom: '24px' }}>
                <h4 style={{ fontSize: '12px', fontWeight: '700', color: tokens.colors.textMuted, textTransform: 'uppercase', marginBottom: '8px' }}>Description & Proof Details</h4>
                <p style={{ fontSize: '14px', color: tokens.colors.textSecondary, lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                  {selectedItem.description || 'No detailed description provided.'}
                </p>
              </div>

              {selectedItem.evidence_urls && selectedItem.evidence_urls.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{ fontSize: '12px', fontWeight: '700', color: tokens.colors.textMuted, textTransform: 'uppercase', marginBottom: '8px' }}>Submitted Verification URLs</h4>
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    {selectedItem.evidence_urls.map((url, i) => (
                      <li key={i} style={{ fontSize: '13px', color: tokens.colors.primary, marginBottom: '4px', wordBreak: 'break-all' }}>
                        <a href={url} target="_blank" rel="noreferrer" style={{ color: tokens.colors.primary }}>{url}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Right 35% Sidebar: Metadata & Action Bar */}
            <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.4)', padding: '20px', borderRadius: '8px', border: `1px solid ${tokens.colors.borderSubtle}` }}>
              <h3 style={{ fontSize: '14px', fontWeight: '700', color: tokens.colors.textPrimary, marginBottom: '16px' }}>Metadata & Actions</h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', marginBottom: '24px' }}>
                <div>
                  <span style={{ color: tokens.colors.textMuted, display: 'block', fontSize: '11px' }}>Case Type</span>
                  <strong style={{ color: tokens.colors.textPrimary, textTransform: 'capitalize' }}>{selectedItem.type}</strong>
                </div>
                {selectedItem.content_id && (
                  <div>
                    <span style={{ color: tokens.colors.textMuted, display: 'block', fontSize: '11px' }}>Content Inspection URL</span>
                    {(() => {
                      const type = (selectedItem.content_type || 'posts').toLowerCase().trim();
                      let pathCategory = 'posts';
                      if (type.includes('course')) pathCategory = 'courses';
                      else if (type.includes('video')) pathCategory = 'videos';
                      else if (type.includes('article')) pathCategory = 'articles';
                      else if (type.includes('short')) pathCategory = 'shorts';
                      else if (type.includes('note')) pathCategory = 'notes';
                      else if (type.includes('post')) pathCategory = 'posts';
                      else pathCategory = type.endsWith('s') ? type : `${type}s`;
                      const fullUrl = `https://www.codeplusacademy.in/${pathCategory}/${selectedItem.content_id}`;
                      return (
                        <a
                          href={fullUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: tokens.colors.primary, fontSize: '12px', wordBreak: 'break-all', fontWeight: '600', textDecoration: 'underline' }}
                        >
                          {fullUrl} ↗
                        </a>
                      );
                    })()}
                  </div>
                )}
                <div>
                  <span style={{ color: tokens.colors.textMuted, display: 'block', fontSize: '11px' }}>Publisher & Creator Details</span>
                  <div style={{ fontSize: '12px', color: tokens.colors.textPrimary, backgroundColor: 'rgba(255,255,255,0.04)', padding: '8px 10px', borderRadius: '6px', marginTop: '4px', border: `1px solid ${tokens.colors.borderSubtle}` }}>
                    <div><strong>Publisher:</strong> {selectedItem.publisher_name || selectedItem.content_summary?.owner_username || 'Creator Account'}</div>
                    <div style={{ marginTop: '2px' }}>
                      <strong>Email:</strong>{' '}
                      <span style={{ color: tokens.colors.textPrimary, fontWeight: '600' }}>
                        {selectedItem.publisher_email || selectedItem.content_summary?.owner_email || selectedItem.reporter_email || 'N/A'}
                      </span>
                    </div>
                    <div style={{ marginTop: '2px' }}><strong>Account Standing:</strong> <span style={{ color: '#34d399', fontWeight: '700' }}>Active (0 Strikes)</span></div>
                  </div>
                </div>
                <div>
                  <span style={{ color: tokens.colors.textMuted, display: 'block', fontSize: '11px' }}>Resolution Deadline (SLA)</span>
                  <span style={{ color: new Date(selectedItem.sla_resolve_by) < new Date() ? '#EF4444' : tokens.colors.textPrimary }}>
                    {selectedItem.sla_resolve_by ? new Date(selectedItem.sla_resolve_by).toLocaleString() : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Justification & AI Assistant Input Area */}
              <div style={{ marginTop: '16px', marginBottom: '16px', backgroundColor: 'rgba(10, 11, 16, 0.6)', padding: '12px', borderRadius: '8px', border: `1px solid ${tokens.colors.borderSubtle}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: tokens.colors.textSecondary }}>Moderation Justification</label>
                  <button
                    type="button"
                    onClick={handleRefineJustificationWithAI}
                    disabled={refiningAi}
                    style={{ padding: '3px 8px', borderRadius: '4px', background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)', color: '#fff', fontSize: '11px', fontWeight: '600', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Sparkles size={12} /> {refiningAi ? 'Refining...' : '✨ Refine with AI'}
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Type raw notes (e.g. copyright match confirmed) then click ✨ Refine with AI..."
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: `1px solid ${tokens.colors.borderSubtle}`, backgroundColor: tokens.colors.bgDark, color: '#fff', fontSize: '12px', outline: 'none' }}
                />
              </div>

              {/* Action Buttons Footer */}
              {selectedItem.status !== 'closed' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    onClick={() => handleTicketAction(selectedItem.id, 'acknowledge')}
                    style={{ padding: '9px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.06)', border: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textPrimary, fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Acknowledge Ticket
                  </button>

                  <button
                    onClick={() => handleTicketAction(selectedItem.id, 'temporary_takedown')}
                    style={{ padding: '9px', borderRadius: '6px', backgroundColor: 'rgba(245, 158, 11, 0.15)', border: '1px solid #f59e0b', color: '#fbbf24', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Temporary Takedown (Send 7-Day Notice)
                  </button>

                  <button
                    onClick={() => handleTicketAction(selectedItem.id, 'dismiss')}
                    style={{ padding: '9px', borderRadius: '6px', backgroundColor: 'rgba(100, 116, 139, 0.2)', border: `1px solid ${tokens.colors.borderSubtle}`, color: '#94A3B8', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Dismiss Report
                  </button>

                  {selectedItem.content_id && (
                    <button
                      onClick={() => handleTicketAction(selectedItem.id, 'remove_content', true)}
                      style={{ padding: '9px', borderRadius: '6px', backgroundColor: '#EF4444', border: 'none', color: '#FFFFFF', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                    >
                      Permanent Takedown & Issue Strike
                    </button>
                  )}

                  <button
                    onClick={() => handleTicketAction(selectedItem.id, 'close')}
                    style={{ padding: '9px', borderRadius: '6px', backgroundColor: '#10B981', border: 'none', color: '#FFFFFF', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Close Ticket (Resolved)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ── MODULE LIST VIEWS ─────────────────────────────────────────────── */
        <div>
          {/* PAGE HEADER PATTERN */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: '700', color: tokens.colors.textPrimary }}>
                {activeTab === 'tickets' && 'Support & Grievance Tickets'}
                {activeTab === 'copyright' && 'Copyright & DMCA Claims'}
                {activeTab === 'institutions' && 'Institution Profile Verification Claims'}
                {activeTab === 'reclaim' && 'Creator Content Reclaim Claims'}
                {activeTab === 'users' && 'User Moderation & Account Standing'}
                {activeTab === 'audit' && 'System Audit Log'}
                {activeTab === 'admins' && 'Admin Staff Management'}
              </h1>
              <p style={{ fontSize: '13px', color: tokens.colors.textSecondary, marginTop: '4px' }}>
                Enterprise trust, safety, and compliance moderation console.
              </p>
            </div>

            {activeTab === 'admins' && adminUser?.is_root && (
              <button
                onClick={() => setShowCreateAdminModal(true)}
                style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: tokens.colors.primary, color: '#FFFFFF', fontWeight: '600', fontSize: '13px', border: 'none', cursor: 'pointer' }}
              >
                + Create Admin Worker
              </button>
            )}
          </div>

          {/* HORIZONTAL FILTER BAR PATTERN */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: tokens.colors.surfaceElevated, border: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textPrimary, fontSize: '13px', outline: 'none' }}
            >
              <option value="all">Status: All</option>
              <option value="open">Open</option>
              <option value="under_review">Under Review</option>
              <option value="action_taken">Action Taken</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {/* DATA TABLE PATTERN */}
          <div className="data-table-container">
            {dataLoading ? (
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="skeleton-row" />
                <div className="skeleton-row" />
                <div className="skeleton-row" />
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  {activeTab === 'institutions' ? (
                    <tr>
                      <th>Claim ID</th>
                      <th>Institution / University</th>
                      <th>Claimant Email</th>
                      <th>Status</th>
                      <th>Submitted Date</th>
                    </tr>
                  ) : activeTab === 'users' ? (
                    <tr>
                      <th>User ID</th>
                      <th>Moderation Status</th>
                      <th>Strikes Issued</th>
                      <th>Reports Filed against</th>
                      <th>Last Action</th>
                    </tr>
                  ) : activeTab === 'audit' ? (
                    <tr>
                      <th>Log ID</th>
                      <th>Actor (Admin)</th>
                      <th>Module / Action</th>
                      <th>Target</th>
                      <th>Reason / Details</th>
                      <th>Timestamp</th>
                    </tr>
                  ) : activeTab === 'admins' ? (
                    <tr>
                      <th>Admin ID</th>
                      <th>Display Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Permissions</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  ) : (
                    <tr>
                      <th>ID / Ref</th>
                      <th>Category / Type</th>
                      <th>Reported Target</th>
                      <th>Status</th>
                      <th>SLA Deadline</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {activeTab === 'institutions' ? (
                    institutionClaims.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '48px', color: tokens.colors.textMuted }}>
                          No institution verification claims found.
                        </td>
                      </tr>
                    ) : (
                      institutionClaims.map((c) => (
                        <tr key={c.id}>
                          <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: tokens.colors.primary }}>{c.id.slice(0, 8)}...</td>
                          <td style={{ fontWeight: '600' }}>{c.institution_name || c.institution_id || 'N/A'}</td>
                          <td style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>{c.claimant_email}</td>
                          <td><StatusPill status={c.status} /></td>
                          <td style={{ fontSize: '12px', color: tokens.colors.textMuted }}>{new Date(c.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))
                    )
                  ) : activeTab === 'users' ? (
                    users.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '48px', color: tokens.colors.textMuted }}>
                          No user moderation records found.
                        </td>
                      </tr>
                    ) : (
                      users.map((u) => (
                        <tr key={u.user_id}>
                          <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: tokens.colors.primary }}>{u.user_id.slice(0, 8)}...</td>
                          <td><StatusPill status={u.moderation_status || 'active'} /></td>
                          <td style={{ fontWeight: '600', color: u.strike_count > 0 ? '#EF4444' : tokens.colors.textPrimary }}>{u.strike_count} strike(s)</td>
                          <td>{u.report_count} report(s)</td>
                          <td style={{ fontSize: '12px', color: tokens.colors.textMuted }}>{u.last_action_at ? new Date(u.last_action_at).toLocaleDateString() : 'N/A'}</td>
                        </tr>
                      ))
                    )
                  ) : activeTab === 'audit' ? (
                    auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: tokens.colors.textMuted }}>
                          No audit log entries recorded.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((l) => (
                        <tr key={l.id}>
                          <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: tokens.colors.textMuted }}>{l.id.slice(0, 8)}...</td>
                          <td style={{ fontWeight: '600', fontSize: '12px' }}>{l.actor_name || l.actor_email || 'Root System'}</td>
                          <td>
                            <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(59,130,246,0.15)', color: '#60A5FA', fontWeight: '600' }}>
                              {l.module}.{l.action}
                            </span>
                          </td>
                          <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px' }}>
                            {l.target_type ? `${String(l.target_type).toUpperCase()}:${l.target_id ? String(l.target_id).slice(0, 6) : 'N/A'}` : 'N/A'}
                          </td>
                          <td style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>{l.reason || 'N/A'}</td>
                          <td style={{ fontSize: '12px', color: tokens.colors.textMuted }}>{new Date(l.created_at).toLocaleString()}</td>
                        </tr>
                      ))
                    )
                  ) : activeTab === 'admins' ? (
                    adminsList.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '48px', color: tokens.colors.textMuted }}>
                          No admin users found.
                        </td>
                      </tr>
                    ) : (
                      adminsList.map((a) => (
                        <tr key={a.id}>
                          <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: tokens.colors.primary }}>{a.id.slice(0, 8)}...</td>
                          <td style={{ fontWeight: '600' }}>{a.display_name}</td>
                          <td style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>{a.email}</td>
                          <td>
                            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', backgroundColor: a.is_root ? 'rgba(245,158,11,0.2)' : 'rgba(59,130,246,0.2)', color: a.is_root ? '#FBBF24' : '#60A5FA', fontWeight: '700' }}>
                              {a.is_root ? 'ROOT SUPERADMIN' : 'WORKER ADMIN'}
                            </span>
                          </td>
                          <td><StatusPill status={a.status} /></td>
                          <td style={{ fontSize: '11px', color: tokens.colors.textMuted }}>
                            {a.permissions?.includes('*') ? 'All Permissions (*)' : `${a.permissions?.length || 0} granted`}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {!a.is_root && adminUser?.is_root && (
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingAdmin(a);
                                    setEditAdminPermissions(a.permissions || []);
                                  }}
                                  style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#818CF8', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                                >
                                  Edit Perms
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingAdmin(a)}
                                  style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#F87171', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )
                  ) : (
                    (activeTab === 'tickets' ? tickets : activeTab === 'copyright' ? copyrightClaims : reclaimClaims).length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: tokens.colors.textMuted }}>
                          <Clock size={32} style={{ marginBottom: '12px', color: tokens.colors.borderSubtle }} />
                          <div style={{ fontSize: '14px', fontWeight: '600', color: tokens.colors.textPrimary }}>No cases found</div>
                          <span style={{ fontSize: '12px' }}>There are currently no items matching your criteria.</span>
                        </td>
                      </tr>
                    ) : (
                      (activeTab === 'tickets' ? tickets : activeTab === 'copyright' ? copyrightClaims : reclaimClaims).map((t) => (
                        <tr key={t.id} onClick={() => setSelectedItem(t)} style={{ cursor: 'pointer' }}>
                          <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: tokens.colors.primary }}>
                            {t.id.slice(0, 8)}...
                          </td>
                          <td>
                            <div style={{ fontWeight: '600' }}>{t.category || t.type}</div>
                            <span style={{ fontSize: '11px', color: tokens.colors.textMuted }}>{t.case_source}</span>
                          </td>
                          <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: tokens.colors.textSecondary }}>
                            {t.content_type ? `${t.content_type.toUpperCase()}:${t.content_id?.slice(0,6)}` : 'N/A'}
                          </td>
                          <td>
                            <StatusPill status={t.status} />
                          </td>
                          <td style={{ fontSize: '12px', color: new Date(t.sla_resolve_by) < new Date() ? '#EF4444' : tokens.colors.textSecondary }}>
                            {t.sla_resolve_by ? new Date(t.sla_resolve_by).toLocaleDateString() : 'N/A'}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedItem(t); }}
                              style={{ background: 'none', border: 'none', color: tokens.colors.textMuted, cursor: 'pointer', padding: '4px' }}
                            >
                              <MoreVertical size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* CREATE WORKER ADMIN MODAL */}
          {showCreateAdminModal && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
              <div style={{ maxWidth: '440px', width: '100%', backgroundColor: tokens.colors.surfaceElevated, border: `1px solid ${tokens.colors.borderSubtle}`, borderRadius: '12px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '700', color: tokens.colors.textPrimary, marginBottom: '6px' }}>Create Worker Admin</h2>
                <p style={{ fontSize: '13px', color: tokens.colors.textSecondary, marginBottom: '20px' }}>
                  Create a new staff admin account. You can assign granular permissions after creation.
                </p>

                {adminSubmitError && (
                  <div style={{ backgroundColor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#F87171', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
                    {adminSubmitError}
                  </div>
                )}

                <form onSubmit={handleCreateAdminWorker} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: tokens.colors.textSecondary, display: 'block', marginBottom: '4px' }}>Display Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rahul Sharma"
                      value={newAdminName}
                      onChange={(e) => setNewAdminName(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', backgroundColor: tokens.colors.bgDark, border: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textPrimary, fontSize: '13px', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: tokens.colors.textSecondary, display: 'block', marginBottom: '4px' }}>Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. rahul@codeplusacademy.in"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', backgroundColor: tokens.colors.bgDark, border: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textPrimary, fontSize: '13px', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: tokens.colors.textSecondary, display: 'block', marginBottom: '4px' }}>Temporary Password</label>
                    <input
                      type="password"
                      required
                      placeholder="Min 8 chars"
                      value={newAdminPassword}
                      onChange={(e) => setNewAdminPassword(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', backgroundColor: tokens.colors.bgDark, border: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textPrimary, fontSize: '13px', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: tokens.colors.textPrimary, display: 'block', marginBottom: '8px' }}>Module Access Permissions</label>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: tokens.colors.bgDark, padding: '10px', borderRadius: '6px', border: `1px solid ${tokens.colors.borderSubtle}` }}>
                      {[
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
                      ].map((g) => (
                        <div key={g.group}>
                          <span style={{ fontSize: '10px', fontWeight: '800', color: tokens.colors.textMuted, letterSpacing: '0.05em' }}>{g.group}</span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                            {g.items.map((i) => (
                              <label key={i.key} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: tokens.colors.textSecondary, cursor: 'pointer' }}>
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

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                    <button
                      type="button"
                      onClick={() => setShowCreateAdminModal(false)}
                      style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: 'transparent', border: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textSecondary, fontSize: '13px', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={adminSubmitting}
                      style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: tokens.colors.primary, border: 'none', color: '#FFFFFF', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}
                    >
                      {adminSubmitting ? 'Creating...' : 'Create Account'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* OTP VERIFICATION MODAL */}
          {showOtpModal && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
              <div style={{ maxWidth: '420px', width: '100%', backgroundColor: tokens.colors.surfaceElevated, border: `1px solid ${tokens.colors.borderSubtle}`, borderRadius: '12px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '700', color: tokens.colors.textPrimary, marginBottom: '6px' }}>Verify Worker Admin OTP</h2>
                <p style={{ fontSize: '13px', color: tokens.colors.textSecondary, marginBottom: '16px' }}>
                  A 6-digit registration OTP has been sent to <strong>{otpVerifyEmail}</strong>. Please enter the passcode below to activate the account.
                </p>

                {otpSubmitError && (
                  <div style={{ backgroundColor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#F87171', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
                    {otpSubmitError}
                  </div>
                )}

                {otpSuccessMsg && (
                  <div style={{ backgroundColor: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#34D399', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
                    {otpSuccessMsg}
                  </div>
                )}

                <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: tokens.colors.textSecondary, display: 'block', marginBottom: '4px' }}>Enter 6-Digit OTP Code</label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      placeholder="e.g. 123456"
                      value={otpInputCode}
                      onChange={(e) => setOtpInputCode(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', backgroundColor: tokens.colors.bgDark, border: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textPrimary, fontSize: '16px', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '4px', textAlign: 'center', outline: 'none' }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                    <button
                      type="button"
                      onClick={() => setShowOtpModal(false)}
                      style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: 'transparent', border: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textSecondary, fontSize: '13px', cursor: 'pointer' }}
                    >
                      Close & Verify Later
                    </button>
                    <button
                      type="submit"
                      disabled={otpSubmitting}
                      style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: tokens.colors.primary, border: 'none', color: '#FFFFFF', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}
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
            <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
              <div style={{ maxWidth: '440px', width: '100%', backgroundColor: tokens.colors.surfaceElevated, border: `1px solid ${tokens.colors.borderSubtle}`, borderRadius: '12px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '700', color: tokens.colors.textPrimary, marginBottom: '4px' }}>Edit Permissions</h2>
                <p style={{ fontSize: '13px', color: tokens.colors.textSecondary, marginBottom: '16px' }}>
                  Update access permissions for <strong>{editingAdmin.display_name}</strong> ({editingAdmin.email})
                </p>

                <form onSubmit={handleUpdateAdminPermissions} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: tokens.colors.textPrimary, display: 'block', marginBottom: '8px' }}>Module Access Permissions</label>
                    <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: tokens.colors.bgDark, padding: '10px', borderRadius: '6px', border: `1px solid ${tokens.colors.borderSubtle}` }}>
                      {[
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
                      ].map((g) => (
                        <div key={g.group}>
                          <span style={{ fontSize: '10px', fontWeight: '800', color: tokens.colors.textMuted, letterSpacing: '0.05em' }}>{g.group}</span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                            {g.items.map((i) => (
                              <label key={i.key} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: tokens.colors.textSecondary, cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={editAdminPermissions.includes(i.key)}
                                  onChange={(e) => {
                                    if (e.target.checked) setEditAdminPermissions([...editAdminPermissions, i.key]);
                                    else setEditAdminPermissions(editAdminPermissions.filter(p => p !== i.key));
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

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                    <button
                      type="button"
                      onClick={() => setEditingAdmin(null)}
                      style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: 'transparent', border: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textSecondary, fontSize: '13px', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={editAdminSubmitting}
                      style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: tokens.colors.primary, border: 'none', color: '#FFFFFF', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}
                    >
                      {editAdminSubmitting ? 'Saving...' : 'Save Permissions'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* DELETE WORKER ADMIN CONFIRMATION MODAL */}
          {deletingAdmin && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
              <div style={{ maxWidth: '400px', width: '100%', backgroundColor: tokens.colors.surfaceElevated, border: `1px solid ${tokens.colors.borderSubtle}`, borderRadius: '12px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <AlertTriangle size={20} color="#EF4444" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', color: tokens.colors.textPrimary }}>Delete Worker Admin</h3>
                    <span style={{ fontSize: '12px', color: tokens.colors.textMuted }}>Permanent Revocation</span>
                  </div>
                </div>

                <p style={{ fontSize: '13px', color: tokens.colors.textSecondary, lineHeight: '1.5', marginBottom: '20px' }}>
                  Are you sure you want to delete worker admin <strong>{deletingAdmin.display_name}</strong> ({deletingAdmin.email})? This will revoke all their permissions and terminate active sessions immediately.
                </p>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setDeletingAdmin(null)}
                    style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: 'transparent', border: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textSecondary, fontSize: '13px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deleteAdminSubmitting}
                    onClick={handleDeleteWorkerAdmin}
                    style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: '#EF4444', border: 'none', color: '#FFFFFF', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}
                  >
                    {deleteAdminSubmitting ? 'Deleting...' : 'Delete Admin'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* DIRECT IN-APP EMAIL MODAL */}
          {showDirectEmailModal && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
              <div style={{ maxWidth: '520px', width: '100%', backgroundColor: tokens.colors.surfaceElevated, border: `1px solid ${tokens.colors.borderSubtle}`, borderRadius: '12px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Mail size={18} color={tokens.colors.primary} />
                    <h3 style={{ fontSize: '16px', fontWeight: '700', color: tokens.colors.textPrimary, margin: 0 }}>Send In-App Email via System</h3>
                  </div>
                  <button onClick={() => setShowDirectEmailModal(false)} style={{ background: 'none', border: 'none', color: tokens.colors.textMuted, cursor: 'pointer' }}><X size={18} /></button>
                </div>

                {directEmailSuccess ? (
                  <div style={{ padding: '16px', backgroundColor: 'rgba(52, 211, 153, 0.1)', border: '1px solid #34d399', borderRadius: '8px', color: '#34d399', textAlign: 'center', fontWeight: '600' }}>
                    <CheckCircle2 size={24} style={{ marginBottom: '8px', margin: '0 auto', display: 'block' }} />
                    {directEmailSuccess}
                  </div>
                ) : (
                  <form onSubmit={handleSendDirectEmail} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: tokens.colors.textMuted, marginBottom: '4px' }}>Recipient Email (Publisher)</label>
                      <input
                        type="email"
                        required
                        value={directEmailRecipient}
                        onChange={(e) => setDirectEmailRecipient(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', backgroundColor: tokens.colors.surface, border: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textPrimary, fontSize: '13px' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: tokens.colors.textMuted, marginBottom: '4px' }}>Email System Template</label>
                      <select
                        value={selectedTemplateKey}
                        onChange={(e) => setSelectedTemplateKey(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', backgroundColor: tokens.colors.surface, border: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textPrimary, fontSize: '13px' }}
                      >
                        <option value="moderation_action_notice">Moderation Action Notice (Standard System Template)</option>
                        <option value="temporary_takedown_7day">7-Day Temporary Content Takedown Notice</option>
                        <option value="permanent_takedown_notice">Permanent Content Removal Takedown Notice</option>
                        <option value="copyright_infringement_notice">Copyright / DMCA Infringement Notice</option>
                        <option value="platform_announcement">Platform Announcement</option>
                        <option value="custom">Custom Ad-Hoc Email</option>
                      </select>
                    </div>

                    {selectedTemplateKey === 'custom' && (
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: tokens.colors.textMuted, marginBottom: '4px' }}>Subject Line</label>
                        <input
                          type="text"
                          required
                          value={directEmailSubject}
                          onChange={(e) => setDirectEmailSubject(e.target.value)}
                          style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', backgroundColor: tokens.colors.surface, border: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textPrimary, fontSize: '13px' }}
                        />
                      </div>
                    )}

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: tokens.colors.textMuted, marginBottom: '4px' }}>
                        {selectedTemplateKey !== 'custom' ? 'Compliance Reason / Admin Notes (Compiled into Template)' : 'Message Body (Dispatched via Platform Email Engine)'}
                      </label>
                      <textarea
                        required
                        rows={4}
                        value={directEmailBody}
                        onChange={(e) => setDirectEmailBody(e.target.value)}
                        placeholder="Write your administrative notice or compliance reason for the publisher..."
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', backgroundColor: tokens.colors.surface, border: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textPrimary, fontSize: '13px', resize: 'vertical' }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setShowDirectEmailModal(false)}
                        style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: 'transparent', border: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textSecondary, fontSize: '13px', cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={directEmailSubmitting}
                        style={{ padding: '8px 18px', borderRadius: '6px', backgroundColor: tokens.colors.primary, border: 'none', color: '#FFFFFF', fontWeight: '600', fontSize: '13px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Send size={14} />
                        {directEmailSubmitting ? 'Dispatching Email...' : 'Send Email via System'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </AdminShell>
  );
}
