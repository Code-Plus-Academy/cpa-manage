'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Ticket, Search, Filter, RefreshCw, Eye, ArrowRight, CheckCircle2,
  AlertCircle, FileText, Scale, UserX, Clock, ChevronLeft, ChevronRight, X, Mail, Send
} from 'lucide-react';
import AdminShell from '../../components/shell/AdminShell';
import StatusPill from '../../components/ui/StatusPill';
import LottieLoader from '../../components/ui/LottieLoader';
import { tokens } from '../theme/tokens';

export default function StandaloneTicketsPage() {
  const router = useRouter();
  const [adminUser, setAdminUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters & Pagination
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Data states
  const [tickets, setTickets] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Detail Modal / Overlay State (2-column layout)
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketDetails, setTicketDetails] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Action form state
  const [actionType, setActionType] = useState('acknowledge');
  const [actionReason, setActionReason] = useState('');
  const [issueStrike, setIssueStrike] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [refiningAi, setRefiningAi] = useState(false);

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
    if (!directEmailRecipient || !selectedTicket) return;
    setDirectEmailSubmitting(true);
    try {
      const payloadBody = selectedTemplateKey !== 'custom' ? {
        template_key: selectedTemplateKey,
        recipient_email: directEmailRecipient,
        payload: {
          name: selectedTicket.publisher_name || selectedTicket.content_summary?.owner_username || 'Creator / User',
          ticket_id: String(selectedTicket.id),
          action_type: selectedTicket.status || 'notice',
          reason: directEmailBody || 'Administrative compliance review',
          content_title: selectedTicket.content_summary?.title || selectedTicket.category || 'Content Item',
        }
      } : {
        recipient_email: directEmailRecipient,
        subject: directEmailSubject,
        message: directEmailBody,
      };

      const res = await fetch(`${apiUrl}/admin/cases/${selectedTicket.id}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadBody),
        credentials: 'include',
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
        fetchTickets();
      }, 1500);
    } catch (err) {
      alert('Network error sending email.');
    } finally {
      setDirectEmailSubmitting(false);
    }
  };

  const handleRefineJustificationWithAI = async () => {
    if (!actionReason || !actionReason.trim()) {
      alert('Please enter initial raw notes before refining with AI.');
      return;
    }
    setRefiningAi(true);
    try {
      const res = await fetch(`${apiUrl}/admin/cases/refine-justification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ raw_notes: actionReason, case_type: selectedTicket?.type || 'moderation' }),
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

  const apiUrl = process.env.NEXT_PUBLIC_MANAGE_API_URL || 'http://localhost:4000';

  useEffect(() => {
    checkAuthStatus();
  }, []);

  useEffect(() => {
    if (adminUser) {
      loadTickets();
    }
  }, [adminUser, statusFilter, categoryFilter, currentPage]);

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

  const loadTickets = async () => {
    setDataLoading(true);
    try {
      let url = `${apiUrl}/admin/cases?page=${currentPage}&limit=15`;
      if (statusFilter !== 'all') url += `&status=${encodeURIComponent(statusFilter)}`;
      if (categoryFilter !== 'all') url += `&type=${encodeURIComponent(categoryFilter)}`;

      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setTickets(data.cases || []);
        if (data.pagination) {
          setTotalCount(data.pagination.total_count || 0);
          setTotalPages(Math.ceil((data.pagination.total_count || 1) / 15));
        }
      }
    } catch (err) {
      console.error('Failed to load tickets:', err);
    } finally {
      setDataLoading(false);
    }
  };

  const openTicketDetail = async (ticket) => {
    setSelectedTicket(ticket);
    setTicketDetails(null);
    setDetailLoading(true);
    setActionType('acknowledge');
    setActionReason('');
    setIssueStrike(false);

    try {
      const res = await fetch(`${apiUrl}/admin/cases/${ticket.id}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setTicketDetails(data);
      } else {
        setTicketDetails({ ticket, actions: [], appeals: [], content_summary: null });
      }
    } catch (err) {
      console.error('Failed to fetch ticket detail:', err);
      setTicketDetails({ ticket, actions: [], appeals: [], content_summary: null });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleExecuteAction = async (e) => {
    e.preventDefault();
    if (!actionReason || !selectedTicket) return;
    setSubmittingAction(true);

    try {
      const res = await fetch(`${apiUrl}/admin/cases/${selectedTicket.id}/action`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action_type: actionType,
          reason: actionReason,
          issue_strike: issueStrike,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error?.message || data.message || 'Failed to execute moderation action.');
        return;
      }

      alert(`Action '${actionType}' executed successfully.`);
      setActionReason('');
      setIssueStrike(false);
      // Reload ticket detail and list
      openTicketDetail(selectedTicket);
      loadTickets();
    } catch (err) {
      alert(err.message || 'Network error executing action.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Client-side search filtering
  const filteredTickets = tickets.filter(t => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (t.id && String(t.id).toLowerCase().includes(q)) ||
      (t.category && t.category.toLowerCase().includes(q)) ||
      (t.type && t.type.toLowerCase().includes(q)) ||
      (t.description && t.description.toLowerCase().includes(q)) ||
      (t.reporter_email && t.reporter_email.toLowerCase().includes(q))
    );
  });

  return (
    <AdminShell
      adminUser={adminUser}
      activeTab="tickets"
      breadcrumb={['Trust & Safety', 'Support Tickets']}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Header Title Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: tokens.typography.title.fontSize, fontWeight: tokens.typography.title.fontWeight, color: tokens.colors.textPrimary, margin: 0 }}>
              Support Tickets & Moderation Queue
            </h1>
            <p style={{ fontSize: tokens.typography.small.fontSize, color: tokens.colors.textSecondary, margin: '4px 0 0 0' }}>
              Manage inbound reports, DMCA notices, and user moderation requests
            </p>
          </div>
          <button
            onClick={loadTickets}
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
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'center',
            padding: '14px 18px',
            borderRadius: '10px',
            backgroundColor: tokens.colors.surfaceElevated,
            border: `1px solid ${tokens.colors.borderSubtle}`,
          }}
        >
          {/* Search Box */}
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search size={14} color={tokens.colors.textMuted} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search by ticket ID, email, description..."
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

          {/* Category Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: tokens.colors.textMuted }}>Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                backgroundColor: tokens.colors.bgDark,
                border: `1px solid ${tokens.colors.borderSubtle}`,
                color: tokens.colors.textPrimary,
                fontSize: '13px',
                outline: 'none',
              }}
            >
              <option value="all">All Categories</option>
              <option value="general-support">General Support</option>
              <option value="copyright">Copyright Claims</option>
              <option value="institution_claim">Institution Claims</option>
              <option value="ownership_transfer">Ownership Transfer</option>
              <option value="harassment">Harassment</option>
              <option value="privacy-access">Privacy Access</option>
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: tokens.colors.textMuted }}>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                backgroundColor: tokens.colors.bgDark,
                border: `1px solid ${tokens.colors.borderSubtle}`,
                color: tokens.colors.textPrimary,
                fontSize: '13px',
                outline: 'none',
              }}
            >
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="under_review">Under Review</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="action_taken">Action Taken</option>
              <option value="closed">Closed</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>
        </div>

        {/* Tickets Data Table */}
        <div
          style={{
            borderRadius: '10px',
            backgroundColor: tokens.colors.surfaceElevated,
            border: `1px solid ${tokens.colors.borderSubtle}`,
            overflowX: 'auto',
          }}
        >
          {dataLoading ? (
            <LottieLoader type="search" message="Fetching support tickets queue..." />
          ) : filteredTickets.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: tokens.colors.textMuted }}>
              <Ticket size={44} color={tokens.colors.textMuted} style={{ marginBottom: '12px' }} />
              <p style={{ fontSize: '15px', fontWeight: '600', color: tokens.colors.textPrimary, margin: 0 }}>No tickets found</p>
              <span style={{ fontSize: '13px' }}>Try adjusting your search query or filter selection.</span>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${tokens.colors.borderSubtle}`, backgroundColor: 'rgba(15, 23, 42, 0.4)', color: tokens.colors.textMuted }}>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>TICKET ID</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>CATEGORY / TYPE</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>REPORTER</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>STATUS</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>SUBMITTED</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600', textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((t) => (
                  <tr
                    key={t.id}
                    style={{
                      borderBottom: `1px solid ${tokens.colors.borderSubtle}`,
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '12px 16px', fontFamily: tokens.typography.mono.fontFamily, fontWeight: '700', color: tokens.colors.primary }}>
                      #{t.id}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontWeight: '600', color: tokens.colors.textPrimary }}>{t.category || t.type}</span>
                      {t.source_surface && (
                        <span style={{ display: 'block', fontSize: '11px', color: tokens.colors.textMuted }}>
                          Surface: {t.source_surface}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', color: tokens.colors.textSecondary }}>
                      {t.reporter_email || `User #${t.user_id}`}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <StatusPill status={t.status} />
                    </td>
                    <td style={{ padding: '12px 16px', color: tokens.colors.textMuted, fontSize: '12px' }}>
                      {t.created_at ? new Date(t.created_at).toLocaleString() : 'N/A'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        onClick={() => openTicketDetail(t)}
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
                        <Eye size={14} /> Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: `1px solid ${tokens.colors.borderSubtle}` }}>
              <span style={{ fontSize: '12px', color: tokens.colors.textMuted }}>
                Showing page {currentPage} of {totalPages} ({totalCount} total entries)
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    backgroundColor: tokens.colors.bgDark,
                    border: `1px solid ${tokens.colors.borderSubtle}`,
                    color: currentPage <= 1 ? tokens.colors.textMuted : tokens.colors.textPrimary,
                    fontSize: '12px',
                    cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <ChevronLeft size={14} /> Previous
                </button>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    backgroundColor: tokens.colors.bgDark,
                    border: `1px solid ${tokens.colors.borderSubtle}`,
                    color: currentPage >= totalPages ? tokens.colors.textMuted : tokens.colors.textPrimary,
                    fontSize: '12px',
                    cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 2-Column Ticket Detail Overlay Modal */}
        {selectedTicket && (
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
                maxWidth: '1200px',
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
              {/* Modal Top Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: `1px solid ${tokens.colors.borderSubtle}`, backgroundColor: tokens.colors.bgDark }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '800', color: tokens.colors.primary, fontFamily: tokens.typography.mono.fontFamily }}>
                    Ticket #{selectedTicket.id}
                  </span>
                  <StatusPill status={selectedTicket.status} />
                </div>
                <button
                  onClick={() => { setSelectedTicket(null); setTicketDetails(null); }}
                  style={{ background: 'none', border: 'none', color: tokens.colors.textMuted, cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body: 2-Column Layout (65% Left, 35% Right) */}
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '65% 35%', overflow: 'hidden' }}>
                {/* LEFT COLUMN (65%): Description, Evidence, Audit Log */}
                <div style={{ padding: '24px', overflowY: 'auto', borderRight: `1px solid ${tokens.colors.borderSubtle}`, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', color: tokens.colors.textPrimary, margin: '0 0 8px 0' }}>
                      {selectedTicket.category || selectedTicket.type}
                    </h3>
                    <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: tokens.colors.bgDark, border: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textPrimary, fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                      {selectedTicket.description}
                    </div>
                  </div>

                  {/* Reporter Details */}
                  <div style={{ padding: '12px 16px', borderRadius: '8px', backgroundColor: 'rgba(124, 58, 237, 0.08)', border: `1px solid ${tokens.colors.primaryGlow}` }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: tokens.colors.primary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reporter Identification</span>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', fontWeight: '600', color: tokens.colors.textPrimary }}>
                      {selectedTicket.reporter_email || `User ID: ${selectedTicket.user_id}`}
                    </p>
                  </div>

                  {/* gRPC Evidence / Content Summary */}
                  {ticketDetails?.content_summary && (
                    <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#60A5FA', textTransform: 'uppercase' }}>gRPC Fetched Content Summary</span>
                      <h4 style={{ margin: '4px 0', fontSize: '14px', fontWeight: '700', color: '#FFFFFF' }}>{ticketDetails.content_summary.title}</h4>
                      <p style={{ margin: 0, fontSize: '12px', color: tokens.colors.textSecondary }}>
                        Owner: {ticketDetails.content_summary.owner_username} ({ticketDetails.content_summary.owner_id}) • Moderation Status: {ticketDetails.content_summary.moderation_status}
                      </p>
                    </div>
                  )}

                  {/* Action Audit Log Trail */}
                  <div>
                    <h4 style={{ fontSize: '13px', fontWeight: '700', color: tokens.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                      Case Action Audit Log
                    </h4>
                    {ticketDetails?.actions && ticketDetails.actions.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {ticketDetails.actions.map(act => (
                          <div key={act.id} style={{ padding: '10px 14px', borderRadius: '6px', backgroundColor: tokens.colors.bgDark, borderLeft: `3px solid ${tokens.colors.primary}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: tokens.colors.textMuted, marginBottom: '4px' }}>
                              <strong style={{ color: tokens.colors.primary }}>{act.action_type}</strong>
                              <span>{new Date(act.created_at).toLocaleString()}</span>
                            </div>
                            <p style={{ margin: 0, fontSize: '13px', color: tokens.colors.textPrimary }}>{act.reason}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ fontSize: '13px', color: tokens.colors.textMuted, margin: 0 }}>No prior actions recorded for this case.</p>
                    )}
                  </div>
                </div>

                {/* RIGHT COLUMN (35%): Metadata & Action Form */}
                <div style={{ padding: '24px', backgroundColor: tokens.colors.bgDark, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Metadata Header */}
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: '700', color: tokens.colors.textPrimary, marginBottom: '12px' }}>Ticket Metadata</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: tokens.colors.textSecondary }}>
                      <div><strong style={{ color: tokens.colors.textMuted }}>Category:</strong> {selectedTicket.category || selectedTicket.type}</div>
                      {selectedTicket.content_id && (
                        <div>
                          <strong style={{ color: tokens.colors.textMuted, display: 'block' }}>Content Inspection URL:</strong>
                          {(() => {
                            const type = (selectedTicket.content_type || 'posts').toLowerCase().trim();
                            let pathCategory = 'posts';
                            if (type.includes('course')) pathCategory = 'courses';
                            else if (type.includes('video')) pathCategory = 'videos';
                            else if (type.includes('article')) pathCategory = 'articles';
                            else if (type.includes('short')) pathCategory = 'shorts';
                            else if (type.includes('note')) pathCategory = 'notes';
                            else if (type.includes('post')) pathCategory = 'posts';
                            else pathCategory = type.endsWith('s') ? type : `${type}s`;
                            const fullUrl = `https://www.codeplusacademy.in/${pathCategory}/${selectedTicket.content_id}`;
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
                        <strong style={{ color: tokens.colors.textMuted, display: 'block' }}>Publisher & Creator Details:</strong>
                        <div style={{ fontSize: '11px', color: tokens.colors.textPrimary, backgroundColor: 'rgba(255,255,255,0.04)', padding: '6px 8px', borderRadius: '6px', marginTop: '2px', border: `1px solid ${tokens.colors.borderSubtle}` }}>
                          <div><strong>Publisher:</strong> {selectedTicket.publisher_name || selectedTicket.content_summary?.owner_username || 'Creator Account'}</div>
                          <div style={{ marginTop: '2px' }}>
                            <strong>Email:</strong>{' '}
                            <span style={{ color: tokens.colors.textPrimary, fontWeight: '600' }}>
                              {selectedTicket.publisher_email || selectedTicket.content_summary?.owner_email || selectedTicket.reporter_email || 'N/A'}
                            </span>
                          </div>
                          <div style={{ marginTop: '2px' }}><strong>Account Standing:</strong> <span style={{ color: '#34d399', fontWeight: '700' }}>Active (0 Strikes)</span></div>
                        </div>
                      </div>
                      <div><strong style={{ color: tokens.colors.textMuted }}>Submitted:</strong> {selectedTicket.created_at ? new Date(selectedTicket.created_at).toLocaleString() : 'N/A'}</div>
                      <div><strong style={{ color: tokens.colors.textMuted }}>Assigned Admin:</strong> {selectedTicket.assigned_admin_id || 'Unassigned'}</div>
                    </div>
                  </div>

                  <hr style={{ borderColor: tokens.colors.borderSubtle, margin: 0 }} />

                  {/* Take Action Form */}
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: '700', color: tokens.colors.textPrimary, marginBottom: '14px' }}>
                      Take Moderation Action
                    </h3>

                    <form onSubmit={handleExecuteAction} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: tokens.colors.textMuted, marginBottom: '6px' }}>Action Type</label>
                        <select
                          value={actionType}
                          onChange={(e) => setActionType(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: '6px',
                            backgroundColor: tokens.colors.surfaceElevated,
                            border: `1px solid ${tokens.colors.borderSubtle}`,
                            color: tokens.colors.textPrimary,
                            fontSize: '13px',
                            outline: 'none',
                          }}
                        >
                          <option value="acknowledge">Acknowledge Ticket</option>
                          <option value="temporary_takedown">Temporary Takedown (Send 7-Day Reply Notice)</option>
                          <option value="dismiss">Dismiss Claim</option>
                          <option value="remove_content">Remove Content (gRPC setContentStatus)</option>
                          <option value="approve_claim">Approve Copyright / Claim</option>
                          <option value="transfer_ownership">Transfer Ownership (gRPC transferOwnership)</option>
                          <option value="close">Close Ticket (Resolved)</option>
                        </select>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <label style={{ fontSize: '12px', color: tokens.colors.textMuted }}>Public Justification / Reason</label>
                          <button
                            type="button"
                            onClick={handleRefineJustificationWithAI}
                            disabled={refiningAi}
                            style={{ padding: '2px 6px', borderRadius: '4px', background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)', color: '#fff', fontSize: '11px', fontWeight: '600', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            {refiningAi ? 'Refining...' : '✨ Refine with AI'}
                          </button>
                        </div>
                        <textarea
                          required
                          rows={4}
                          value={actionReason}
                          onChange={(e) => setActionReason(e.target.value)}
                          placeholder="Provide clear justification for this moderation decision..."
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: '6px',
                            backgroundColor: tokens.colors.surfaceElevated,
                            border: `1px solid ${tokens.colors.borderSubtle}`,
                            color: tokens.colors.textPrimary,
                            fontSize: '13px',
                            outline: 'none',
                            resize: 'vertical',
                          }}
                        />
                      </div>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#F59E0B', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={issueStrike}
                          onChange={(e) => setIssueStrike(e.target.checked)}
                        />
                        <span>Issue Conduct / Copyright Strike to User</span>
                      </label>

                      <button
                        type="submit"
                        disabled={submittingAction}
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: '6px',
                          backgroundColor: tokens.colors.primary,
                          border: 'none',
                          color: '#FFFFFF',
                          fontSize: '13px',
                          fontWeight: '700',
                          cursor: submittingAction ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                      >
                        {submittingAction ? 'Executing Action...' : 'Execute & Log Action'}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        </div>
      </AdminShell>
  );
}
