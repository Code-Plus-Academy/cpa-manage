'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ShieldCheck, ArrowLeft, Clock, CheckCircle2, AlertCircle, FileText, Scale, UserX, Send } from 'lucide-react';

export default function AdminTicketDetailPage() {
  const params = useParams();
  const ticketId = params?.id;
  const router = useRouter();

  const [ticket, setTicket] = useState(null);
  const [actions, setActions] = useState([]);
  const [appeals, setAppeals] = useState([]);
  const [contentSummary, setContentSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [actionType, setActionType] = useState('acknowledge');
  const [reason, setReason] = useState('');
  const [issueStrike, setIssueStrike] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_MANAGE_API_URL || 'https://cpa-manage.onrender.com';

  useEffect(() => {
    if (ticketId) {
      loadTicket();
    }
  }, [ticketId]);

  const loadTicket = async () => {
    try {
      const res = await fetch(`${apiUrl}/admin/cases/${ticketId}`, { credentials: 'include' });
      if (!res.ok) {
        throw new Error('Ticket not found or permission denied.');
      }
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

  const handleExecuteAction = async (e) => {
    e.preventDefault();
    if (!reason) return;
    setSubmitting(true);

    try {
      const res = await fetch(`${apiUrl}/admin/cases/${ticketId}/action`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_type: actionType,
          reason,
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
      loadTicket();
    } catch (err) {
      alert('Network error executing action.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#090d16' }}>
        <p style={{ color: '#94a3b8' }}>Loading Ticket #{ticketId}...</p>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div style={{ maxWidth: 600, margin: '4rem auto', padding: 24, className: 'glass-panel', textAlign: 'center', color: '#f87171' }}>
        <AlertCircle size={40} style={{ marginBottom: 12 }} />
        <h2>Ticket Not Found</h2>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: 8 }}>{error}</p>
        <button onClick={() => router.push('/')} className="btn-secondary" style={{ marginTop: 16 }}>Back to Admin Dashboard</button>
      </div>
    );
  }

  return (
    <main style={{ minHeight: '100vh', padding: '2rem', maxWidth: 1100, margin: '0 auto', color: '#f8fafc' }}>
      <button onClick={() => router.push('/')} className="btn-secondary" style={{ marginBottom: 20, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: '0.8rem', color: '#818cf8', fontWeight: 700 }}>Ticket ID: {ticket.id}</span>
            <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 700, backgroundColor: '#334155', color: '#34d399' }}>
              {ticket.status?.toUpperCase()}
            </span>
          </div>

          <h1 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 8 }}>{ticket.category}</h1>
          <p style={{ fontSize: '0.9rem', color: '#cbd5e1', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: 20 }}>{ticket.description}</p>

          <div style={{ padding: 12, backgroundColor: 'rgba(15, 23, 42, 0.6)', borderRadius: 8, border: '1px solid var(--border-color)', marginBottom: 20 }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>Reporter Identity</span>
            <strong style={{ fontSize: '0.9rem', color: '#fff' }}>{ticket.reporter_email || `User #${ticket.user_id}`}</strong>
          </div>

          {contentSummary && (
            <div style={{ padding: 14, backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: 8, border: '1px solid rgba(99, 102, 241, 0.3)', marginBottom: 20 }}>
              <span style={{ fontSize: '0.75rem', color: '#818cf8', fontWeight: 700, display: 'block' }}>gRPC Fetched Content Details</span>
              <p style={{ fontWeight: 700, fontSize: '1rem', color: '#fff', margin: '4px 0' }}>{contentSummary.title}</p>
              <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>Owner: {contentSummary.owner_username} ({contentSummary.owner_id}) • Status: {contentSummary.moderation_status}</span>
            </div>
          )}

          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12 }}>Case Action Audit Trail</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {actions.map(act => (
              <div key={act.id} style={{ padding: 12, backgroundColor: 'rgba(15, 23, 42, 0.6)', borderRadius: 8, borderLeft: '3px solid #6366f1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#94a3b8', marginBottom: 4 }}>
                  <strong style={{ color: '#38bdf8' }}>{act.action_type}</strong>
                  <span>{new Date(act.created_at).toLocaleString()}</span>
                </div>
                <p style={{ fontSize: '0.85rem', color: '#f8fafc' }}>{act.reason}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>Take Moderation Action</h3>

          <form onSubmit={handleExecuteAction}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: 6 }}>Action Type</label>
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
                className="glass-input"
                style={{ width: '100%' }}
              >
                <option value="acknowledge">Acknowledge Ticket</option>
                <option value="dismiss">Dismiss Claim</option>
                <option value="remove_content">Remove Content (gRPC setContentStatus)</option>
                <option value="approve_claim">Approve Copyright Claim</option>
                <option value="transfer_ownership">Transfer Ownership (gRPC transferOwnership)</option>
                <option value="close">Close Ticket (Resolved)</option>
              </select>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: 6 }}>Public Justification / Reason</label>
              <textarea
                required
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="State clearly the factual justification for this moderation decision..."
                className="glass-input"
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: '#f59e0b', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={issueStrike}
                  onChange={(e) => setIssueStrike(e.target.checked)}
                />
                <span>Issue Copyright / Conduct Strike to User</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {submitting ? 'Executing & Audit Logging...' : 'Execute & Log Action'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
