'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Clock, CheckCircle2, AlertCircle, Send, Lock, Mail,
  User, ShieldCheck, ShieldAlert, Sparkles, RefreshCw, Eye, Check
} from 'lucide-react';
import LottieLoader from '../../../components/ui/LottieLoader';

function TicketDetailContent() {
  const searchParams = useSearchParams();
  const ticketId = searchParams.get('id');
  const router = useRouter();
  const messagesEndRef = useRef(null);

  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [actions, setActions] = useState([]);
  const [appeals, setAppeals] = useState([]);
  const [contentSummary, setContentSummary] = useState(null);
  const [senderEmails, setSenderEmails] = useState([]);
  const [activeLock, setActiveLock] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Reply Composer State
  const [replyText, setReplyText] = useState('');
  const [selectedSenderEmail, setSelectedSenderEmail] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Moderation Action Form State
  const [actionType, setActionType] = useState('acknowledge');
  const [reason, setReason] = useState('');
  const [issueStrike, setIssueStrike] = useState(false);
  const [executingAction, setExecutingAction] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_MANAGE_API_URL || 'http://localhost:4000';

  useEffect(() => {
    if (ticketId) {
      loadTicketDetails();
      loadMessagesAndLock();
      loadSenderEmails();
      acquireSoftLock();
    } else {
      setLoading(false);
      setError('No ticket ID provided.');
    }

    return () => {
      if (ticketId) {
        releaseSoftLock();
      }
    };
  }, [ticketId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadTicketDetails = async () => {
    try {
      const res = await fetch(`${apiUrl}/admin/cases/${ticketId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Ticket not found or permission denied.');
      const data = await res.json();
      setTicket(data.ticket);
      setActions(data.actions || []);
      setAppeals(data.appeals || []);
      setContentSummary(data.content_summary);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadMessagesAndLock = async () => {
    try {
      const res = await fetch(`${apiUrl}/admin/cases/${ticketId}/messages`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setActiveLock(data.active_lock || null);
      }
    } catch (err) {
      console.warn('Could not load email thread messages:', err);
    }
  };

  const loadSenderEmails = async () => {
    try {
      const res = await fetch(`${apiUrl}/admin/sender-emails`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const senders = data.sender_emails || [];
        setSenderEmails(senders);
        const defaultSender = senders.find(s => s.is_default);
        if (defaultSender) {
          setSelectedSenderEmail(defaultSender.email);
        } else if (senders.length > 0) {
          setSelectedSenderEmail(senders[0].email);
        }
      }
    } catch (err) {
      console.warn('Could not load sender emails:', err);
    }
  };

  const acquireSoftLock = async () => {
    try {
      await fetch(`${apiUrl}/admin/cases/${ticketId}/lock`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (e) {}
  };

  const releaseSoftLock = async () => {
    try {
      await fetch(`${apiUrl}/admin/cases/${ticketId}/lock`, {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch (e) {}
  };

  const handleSendReply = async (statusAction = 'keep_open') => {
    if (!replyText.trim()) return;
    setSendingReply(true);

    try {
      const res = await fetch(`${apiUrl}/admin/cases/${ticketId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_text: replyText.trim(),
          sender_email: selectedSenderEmail,
          status_action: statusAction,
        }),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error?.message || 'Failed to dispatch email reply.');
        return;
      }

      setReplyText('');
      loadMessagesAndLock();
      loadTicketDetails();
    } catch (err) {
      alert('Network error sending reply email.');
    } finally {
      setSendingReply(false);
    }
  };

  const handleExecuteAction = async (e) => {
    e.preventDefault();
    if (!reason.trim()) return;
    setExecutingAction(true);

    try {
      const res = await fetch(`${apiUrl}/admin/cases/${ticketId}/action`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_type: actionType,
          reason: reason.trim(),
          issue_strike: issueStrike,
        }),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error?.message || 'Failed to execute moderation action.');
        return;
      }

      setReason('');
      setIssueStrike(false);
      loadTicketDetails();
    } catch (err) {
      alert('Network error executing action.');
    } finally {
      setExecutingAction(false);
    }
  };

  if (loading) {
    return (
      <LottieLoader type="search" message={`Loading Workspace Ticket #${ticketId || ''}...`} variant="fullscreen" />
    );
  }

  if (error || !ticket) {
    return (
      <div style={{ maxWidth: 600, margin: '4rem auto', padding: 24, borderRadius: 12, backgroundColor: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(239, 68, 68, 0.3)', textAlign: 'center', color: '#f87171' }}>
        <AlertCircle size={44} style={{ marginBottom: 12 }} />
        <h2>Ticket Not Found</h2>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: 8 }}>{error}</p>
        <button onClick={() => router.push('/tickets')} style={{ marginTop: 20, padding: '10px 20px', borderRadius: 8, backgroundColor: '#334155', color: '#fff', border: 'none', cursor: 'pointer' }}>
          Back to Tickets Queue
        </button>
      </div>
    );
  }

  return (
    <main style={{ minHeight: '100vh', padding: '1.5rem 2rem', maxWidth: 1380, margin: '0 auto', color: '#f8fafc', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Top Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => router.push('/tickets')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, backgroundColor: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            <ArrowLeft size={16} /> Back to Queue
          </button>

          <span style={{ fontSize: '0.85rem', color: '#818cf8', fontWeight: 700, letterSpacing: '0.5px' }}>
            Ticket #{ticket.id.slice(0, 8)}
          </span>

          <span style={{
            padding: '4px 12px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 700,
            backgroundColor: ticket.status === 'resolved' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(99, 102, 241, 0.2)',
            color: ticket.status === 'resolved' ? '#34d399' : '#818cf8',
            border: `1px solid ${ticket.status === 'resolved' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(99, 102, 241, 0.4)'}`
          }}>
            {ticket.status?.toUpperCase()}
          </span>

          <span style={{ padding: '4px 12px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 700, backgroundColor: 'rgba(51, 65, 85, 0.6)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
            📫 {ticket.target_mailbox || 'support'}
          </span>
        </div>

        <button
          onClick={() => { loadTicketDetails(); loadMessagesAndLock(); }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, backgroundColor: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem' }}
        >
          <RefreshCw size={14} /> Refresh Thread
        </button>
      </div>

      {/* Active Soft Lock Banner Warning */}
      {activeLock && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderRadius: 10,
          backgroundColor: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)',
          color: '#fbbf24', marginBottom: 20, fontSize: '0.88rem'
        }}>
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', backgroundColor: '#f59e0b', boxShadow: '0 0 10px #f59e0b' }} />
          <Lock size={16} />
          <strong>{activeLock.admin_name}</strong> is currently viewing and drafting a response for this ticket.
        </div>
      )}

      {/* Main 2-Column Grid Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Left Column: Email Conversation Chat Timeline & Composer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          
          {/* Main Ticket Category Header */}
          <div style={{ padding: '1.2rem', borderRadius: 12, backgroundColor: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>{ticket.category}</h1>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={14} /> Received {new Date(ticket.created_at).toLocaleString()}
              </span>
            </div>
            <p style={{ fontSize: '0.92rem', color: '#cbd5e1', lineHeight: 1.6, margin: 0 }}>{ticket.description}</p>
          </div>

          {/* Chat Messages Conversation Thread Container */}
          <div style={{
            minHeight: 400, maxHeight: 600, overflowY: 'auto', padding: '1.2rem', borderRadius: 14,
            backgroundColor: 'rgba(11, 15, 25, 0.95)', border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex', flexDirection: 'column', gap: 16
          }}>
            {messages.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1rem', color: '#64748b', textAlign: 'center' }}>
                <Mail size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
                <p style={{ fontSize: '0.95rem', fontWeight: 600, margin: '0 0 4px' }}>No email thread messages yet</p>
                <p style={{ fontSize: '0.82rem', margin: 0 }}>Replies sent or received via email will appear in this live conversation timeline.</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isInbound = msg.direction === 'inbound';
                return (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isInbound ? 'flex-start' : 'flex-end',
                      width: '100%',
                    }}
                  >
                    <div style={{
                      maxWidth: '82%',
                      padding: '1rem 1.2rem',
                      borderRadius: isInbound ? '16px 16px 16px 4px' : '16px 16px 4px 16px',
                      backgroundColor: isInbound ? 'rgba(30, 58, 138, 0.35)' : 'rgba(79, 70, 229, 0.35)',
                      border: isInbound ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(99, 102, 241, 0.3)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      color: '#f8fafc',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 8, fontSize: '0.78rem', color: isInbound ? '#60a5fa' : '#a5b4fc', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 6 }}>
                        <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {isInbound ? <User size={14} /> : <ShieldCheck size={14} />}
                          {isInbound ? (msg.from_address || ticket.reporter_email) : `Admin: ${msg.sender_admin_name || 'Support Staff'}`}
                        </span>
                        <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>

                      <div style={{ fontSize: '0.9rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {msg.body_text || msg.body_html?.replace(/<[^>]+>/g, '') || msg.subject}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8, fontSize: '0.72rem', color: '#94a3b8' }}>
                        <span>{new Date(msg.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Admin Email Reply Composer Box */}
          <div style={{ padding: '1.2rem', borderRadius: 14, backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#818cf8', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Mail size={15} /> Compose Email Response
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>From:</span>
                <select
                  value={selectedSenderEmail}
                  onChange={(e) => setSelectedSenderEmail(e.target.value)}
                  style={{
                    backgroundColor: 'rgba(30, 41, 59, 0.9)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 6, padding: '4px 10px', fontSize: '0.78rem', cursor: 'pointer'
                  }}
                >
                  {senderEmails.map(s => (
                    <option key={s.id} value={s.email}>
                      {s.display_name ? `${s.display_name} <${s.email}>` : s.email} {s.is_default ? '(Default)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <textarea
              rows={4}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={`Write your response to ${ticket.reporter_email || 'the customer'}... (Reply will be sent via Resend with email threading)`}
              style={{
                width: '100%', minHeight: 90, padding: 12, borderRadius: 8,
                backgroundColor: 'rgba(9, 13, 22, 0.9)', border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#f8fafc', fontSize: '0.9rem', lineHeight: 1.5, resize: 'vertical', outline: 'none',
                boxSizing: 'border-box', marginBottom: 12
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                disabled={sendingReply || !replyText.trim()}
                onClick={() => handleSendReply('keep_open')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8,
                  backgroundColor: 'rgba(99, 102, 241, 0.8)', color: '#fff', border: 'none', fontWeight: 600,
                  fontSize: '0.85rem', cursor: sendingReply || !replyText.trim() ? 'not-allowed' : 'pointer',
                  opacity: sendingReply || !replyText.trim() ? 0.5 : 1
                }}
              >
                <Send size={14} /> Send & Keep Open
              </button>

              <button
                type="button"
                disabled={sendingReply || !replyText.trim()}
                onClick={() => handleSendReply('resolve')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8,
                  backgroundColor: 'rgba(16, 185, 129, 0.8)', color: '#fff', border: 'none', fontWeight: 600,
                  fontSize: '0.85rem', cursor: sendingReply || !replyText.trim() ? 'not-allowed' : 'pointer',
                  opacity: sendingReply || !replyText.trim() ? 0.5 : 1
                }}
              >
                <CheckCircle2 size={14} /> Send & Mark Resolved ✓
              </button>
            </div>
          </div>

        </div>

        {/* Right Column: Ticket Metadata & Moderation Action Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          
          {/* Metadata Card */}
          <div style={{ padding: '1.2rem', borderRadius: 12, backgroundColor: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 12px', color: '#f8fafc' }}>Reporter Details</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.75rem' }}>Email Address</span>
                <strong style={{ color: '#38bdf8' }}>{ticket.reporter_email || 'Unauthenticated'}</strong>
              </div>
              <div>
                <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.75rem' }}>Platform User ID</span>
                <span style={{ color: '#cbd5e1' }}>{ticket.user_id || 'N/A (External Email)'}</span>
              </div>
              <div>
                <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.75rem' }}>SLA Resolve Deadline</span>
                <span style={{ color: '#f59e0b', fontWeight: 600 }}>{new Date(ticket.sla_resolve_by).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* gRPC Fetched Content Summary Box */}
          {contentSummary && (
            <div style={{ padding: '1.2rem', borderRadius: 12, backgroundColor: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
              <span style={{ fontSize: '0.75rem', color: '#818cf8', fontWeight: 700, display: 'block' }}>gRPC Fetched Content</span>
              <p style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff', margin: '4px 0' }}>{contentSummary.title}</p>
              <span style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>Owner: {contentSummary.owner_username} • Status: {contentSummary.moderation_status}</span>
            </div>
          )}

          {/* Moderation Form Card */}
          <div style={{ padding: '1.2rem', borderRadius: 12, backgroundColor: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 12px', color: '#f8fafc' }}>Take Moderation Action</h3>
            <form onSubmit={handleExecuteAction}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: 4 }}>Action Type</label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, backgroundColor: 'rgba(30, 41, 59, 0.8)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.85rem' }}
                >
                  <option value="acknowledge">Acknowledge Ticket</option>
                  <option value="dismiss">Dismiss Claim</option>
                  <option value="remove_content">Remove Content (gRPC setContentStatus)</option>
                  <option value="approve_claim">Approve Copyright Claim</option>
                  <option value="close">Close Ticket (Resolved)</option>
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: 4 }}>Justification / Reason</label>
                <textarea
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason for audit log..."
                  style={{ width: '100%', padding: 8, borderRadius: 6, backgroundColor: 'rgba(30, 41, 59, 0.8)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#f59e0b', cursor: 'pointer' }}>
                  <input type="checkbox" checked={issueStrike} onChange={(e) => setIssueStrike(e.target.checked)} />
                  <span>Issue Strike to User</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={executingAction}
                style={{ width: '100%', padding: '9px 14px', borderRadius: 6, backgroundColor: '#4f46e5', color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.85rem', cursor: executingAction ? 'not-allowed' : 'pointer' }}
              >
                {executingAction ? 'Executing...' : 'Execute Action'}
              </button>
            </form>
          </div>

          {/* Audit Trail List */}
          <div style={{ padding: '1.2rem', borderRadius: 12, backgroundColor: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 10px' }}>Audit Log Activity</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
              {actions.length === 0 ? (
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>No moderation actions logged yet.</p>
              ) : (
                actions.map(act => (
                  <div key={act.id} style={{ padding: 8, borderRadius: 6, backgroundColor: 'rgba(30, 41, 59, 0.5)', borderLeft: '3px solid #6366f1', fontSize: '0.78rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#38bdf8', fontWeight: 700, marginBottom: 2 }}>
                      <span>{act.action_type}</span>
                      <span style={{ color: '#64748b', fontWeight: 400 }}>{new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p style={{ margin: 0, color: '#cbd5e1' }}>{act.reason}</p>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>
    </main>
  );
}

export default function AdminTicketDetailPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#090d16', color: '#94a3b8' }}>Loading Workspace...</div>}>
      <TicketDetailContent />
    </Suspense>
  );
}
