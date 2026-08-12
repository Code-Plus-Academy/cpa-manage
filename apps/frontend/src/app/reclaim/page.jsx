'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, RefreshCw, Eye, ArrowRight, CheckCircle2, ShieldCheck, Clock, X } from 'lucide-react';
import AdminShell from '../../components/shell/AdminShell';
import StatusPill from '../../components/ui/StatusPill';
import { tokens } from '../theme/tokens';
import { apiFetch } from '../../lib/apiClient';

export default function StandaloneReclaimPage() {
  const router = useRouter();
  const [adminUser, setAdminUser] = useState(null);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  // Selected claim detail overlay
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [claimDetails, setClaimDetails] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Transfer action form state
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    checkAuthStatus();
    loadReclaimClaims();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const res = await apiFetch('/admin/auth/me');
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

  const loadReclaimClaims = async () => {
    setDataLoading(true);
    try {
      const res = await apiFetch('/admin/cases?type=ownership_transfer');
      if (res.ok) {
        const data = await res.json();
        setClaims(data.cases || []);
      }
    } catch (err) {
      console.error('Failed to load reclaim claims:', err);
    } finally {
      setDataLoading(false);
    }
  };

  const openClaimDetail = async (claim) => {
    setSelectedClaim(claim);
    setClaimDetails(null);
    setDetailLoading(true);
    setReason('');

    try {
      const res = await apiFetch(`/admin/cases/${claim.id}`);
      if (res.ok) {
        const data = await res.json();
        setClaimDetails(data);
      } else {
        setClaimDetails({ ticket: claim, actions: [], appeals: [], content_summary: null });
      }
    } catch (err) {
      console.error('Failed to fetch claim detail:', err);
      setClaimDetails({ ticket: claim, actions: [], appeals: [], content_summary: null });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleTransferOwnership = async (e) => {
    e.preventDefault();
    if (!reason || !selectedClaim) return;
    setSubmitting(true);

    try {
      const res = await apiFetch(`/admin/cases/${selectedClaim.id}/action`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_type: 'transfer_ownership',
          reason,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error?.message || data.message || 'Failed to transfer ownership.');
        return;
      }

      alert(`Ownership transfer executed successfully for Ticket #${selectedClaim.id}.`);
      setReason('');
      setSelectedClaim(null);
      loadReclaimClaims();
    } catch (err) {
      alert(err.message || 'Network error performing transfer.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminShell
      adminUser={adminUser}
      activeTab="reclaim"
      breadcrumb={['Trust & Safety', 'Content Reclaim Claims']}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Header Title Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: tokens.typography.title.fontSize, fontWeight: tokens.typography.title.fontWeight, color: tokens.colors.textPrimary, margin: 0 }}>
              Content Reclaim & Ownership Transfer Claims
            </h1>
            <p style={{ fontSize: tokens.typography.small.fontSize, color: tokens.colors.textSecondary, margin: '4px 0 0 0' }}>
              Verify author identity proof and execute gRPC ownership transfer actions
            </p>
          </div>
          <button
            onClick={loadReclaimClaims}
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

        {/* Claims Data Table */}
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
              Loading ownership reclaim queue...
            </div>
          ) : claims.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: tokens.colors.textMuted }}>
              <FileText size={44} color={tokens.colors.textMuted} style={{ marginBottom: '12px' }} />
              <p style={{ fontSize: '15px', fontWeight: '600', color: tokens.colors.textPrimary, margin: 0 }}>No pending reclaim tickets</p>
              <span style={{ fontSize: '13px' }}>Ownership transfer claims submitted by creators will populate here.</span>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${tokens.colors.borderSubtle}`, backgroundColor: 'rgba(15, 23, 42, 0.4)', color: tokens.colors.textMuted }}>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>TICKET ID</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>CLAIMING CREATOR</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>TARGET CONTENT ID</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>STATUS</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>SUBMITTED</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600', textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((c) => (
                  <tr
                    key={c.id}
                    style={{
                      borderBottom: `1px solid ${tokens.colors.borderSubtle}`,
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '12px 16px', fontFamily: tokens.typography.mono.fontFamily, fontWeight: '700', color: tokens.colors.primary }}>
                      #{c.id}
                    </td>
                    <td style={{ padding: '12px 16px', color: tokens.colors.textPrimary, fontWeight: '600' }}>
                      {c.reporter_email || `User #${c.user_id}`}
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: tokens.typography.mono.fontFamily, color: tokens.colors.textSecondary }}>
                      {c.content_type && c.content_id ? `${c.content_type}:${c.content_id}` : 'N/A'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <StatusPill status={c.status} />
                    </td>
                    <td style={{ padding: '12px 16px', color: tokens.colors.textMuted, fontSize: '12px' }}>
                      {c.created_at ? new Date(c.created_at).toLocaleString() : 'N/A'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        onClick={() => openClaimDetail(c)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          backgroundColor: tokens.colors.primary,
                          border: 'none',
                          color: '#FFFFFF',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                        }}
                      >
                        <Eye size={14} /> Review Proof
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Reclaim Proof & Action Overlay Modal */}
        {selectedClaim && (
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
                maxWidth: '900px',
                maxHeight: '90vh',
                backgroundColor: tokens.colors.surfaceElevated,
                border: `1px solid ${tokens.colors.borderSubtle}`,
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
              }}
            >
              {/* Modal Top Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: `1px solid ${tokens.colors.borderSubtle}`, backgroundColor: tokens.colors.bgDark }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '800', color: tokens.colors.primary, fontFamily: tokens.typography.mono.fontFamily }}>
                    Reclaim Claim #{selectedClaim.id}
                  </span>
                  <StatusPill status={selectedClaim.status} />
                </div>
                <button
                  onClick={() => setSelectedClaim(null)}
                  style={{ background: 'none', border: 'none', color: tokens.colors.textMuted, cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Content Body */}
              <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Proof & Details */}
                <div>
                  <h4 style={{ fontSize: '12px', fontWeight: '700', color: tokens.colors.textMuted, textTransform: 'uppercase', marginBottom: '8px' }}>
                    Author Ownership Proof & Claim Details
                  </h4>
                  <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: tokens.colors.bgDark, border: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textPrimary, fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                    {selectedClaim.description}
                  </div>
                </div>

                {/* gRPC Fetched Content & Owner comparison */}
                {claimDetails?.content_summary && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', padding: '16px', borderRadius: '8px', backgroundColor: 'rgba(124, 58, 237, 0.08)', border: `1px solid ${tokens.colors.primaryGlow}` }}>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: tokens.colors.textMuted, textTransform: 'uppercase' }}>Original / Current Owner</span>
                      <p style={{ margin: '4px 0 0 0', fontSize: '13px', fontWeight: '700', color: tokens.colors.textPrimary }}>
                        {claimDetails.content_summary.owner_username} ({claimDetails.content_summary.owner_id})
                      </p>
                    </div>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: tokens.colors.primary, textTransform: 'uppercase' }}>Claiming Creator</span>
                      <p style={{ margin: '4px 0 0 0', fontSize: '13px', fontWeight: '700', color: tokens.colors.primary }}>
                        {selectedClaim.reporter_email || `User #${selectedClaim.user_id}`}
                      </p>
                    </div>
                  </div>
                )}

                {/* Transfer Action Form */}
                <form onSubmit={handleTransferOwnership} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: tokens.colors.textMuted, marginBottom: '6px' }}>Transfer Justification / Reason</label>
                    <textarea
                      required
                      rows={3}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="State justification for executing ownership transfer..."
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

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedClaim(null)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        backgroundColor: tokens.colors.bgDark,
                        border: `1px solid ${tokens.colors.borderSubtle}`,
                        color: tokens.colors.textPrimary,
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        backgroundColor: tokens.colors.primary,
                        border: 'none',
                        color: '#FFFFFF',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: submitting ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {submitting ? 'Executing Transfer...' : 'Execute transferOwnership'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
