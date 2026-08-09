'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AdminShell from '../../../components/shell/AdminShell';
import { apiFetch } from '../../../lib/apiClient';
import {
  ArrowLeft, MessageSquare, Send, CheckCircle2, Clock, XCircle, AlertCircle,
  FileText, Sparkles, User, ShieldCheck, Plus, Check, Award
} from 'lucide-react';

export default function ApplicationDetailAdminPage() {
  const { applicationId } = useParams();

  const [application, setApplication] = useState(null);
  const [notes, setNotes] = useState([]);
  const [history, setHistory] = useState([]);
  const [messages, setMessages] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [newNote, setNewNote] = useState('');
  const [chatDraft, setChatDraft] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Offer Letter Approval Preview Modal
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerForm, setOfferForm] = useState({
    offer_title: '', start_date: '', compensation: '', manager_name: ''
  });
  const [offerPreviewHtml, setOfferPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [approving, setApproving] = useState(false);

  // Certificate Generation Preview Modal
  const [showCertModal, setShowCertModal] = useState(false);
  const [availableTemplates, setAvailableTemplates] = useState([]);
  const [certForm, setCertForm] = useState({
    role_title: '',
    duration: '6 Months',
    organization_name: 'Code Plus Academy',
    signatory: 'Dr. Alex Vance',
    signatory_role: 'Director of Engineering',
    signature_text: 'Dr. Alex Vance',
    template_name: 'certificate.html'
  });
  const [certPreviewHtml, setCertPreviewHtml] = useState('');
  const [certPreviewLoading, setCertPreviewLoading] = useState(false);
  const [issuingCert, setIssuingCert] = useState(false);

  const fetchPolyCertTemplates = async () => {
    try {
      const res = await apiFetch('/admin/hiring/polycert/templates');
      if (res.ok) {
        const data = await res.json();
        if (data.templates && data.templates.length > 0) {
          setAvailableTemplates(data.templates);
        }
      }
    } catch (err) {
      console.error('Failed to fetch PolyCert templates:', err);
    }
  };

  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (applicationId) {
      fetchDetail();
      fetchMessages();
      fetchTasks();
    }
  }, [applicationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`/admin/hiring/applications/${applicationId}`);
      if (res.ok) {
        const data = await res.json();
        setApplication(data.application);
        setNotes(data.notes || []);
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error('Failed to fetch application details:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      const res = await apiFetch(`/admin/hiring/applications/${applicationId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  };

  const fetchTasks = async () => {
    try {
      const res = await apiFetch(`/admin/hiring/applications/${applicationId}/tasks`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    try {
      const res = await apiFetch(`/admin/hiring/applications/${applicationId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: newNote.trim() }),
      });
      if (res.ok) {
        setNewNote('');
        fetchDetail();
      }
    } catch (err) {
      console.error('Failed to add note:', err);
    }
  };

  const handleSendAdminMessage = async (e) => {
    e.preventDefault();
    if (!chatDraft.trim()) return;

    try {
      const res = await apiFetch(`/admin/hiring/applications/${applicationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: chatDraft.trim() }),
      });
      if (res.ok) {
        setChatDraft('');
        fetchMessages();
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      const res = await apiFetch(`/admin/hiring/applications/${applicationId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTaskTitle.trim(), progress: 0 }),
      });
      if (res.ok) {
        setNewTaskTitle('');
        fetchTasks();
      }
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  };

  const handleToggleTaskStatus = async (task) => {
    const nextStatus = task.status === 'done' ? 'pending' : 'done';
    const nextProgress = nextStatus === 'done' ? 100 : 0;
    try {
      const res = await apiFetch(`/admin/hiring/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, progress: nextProgress }),
      });
      if (res.ok) fetchTasks();
    } catch (err) {
      console.error('Failed to toggle task:', err);
    }
  };

  const handlePreviewOffer = async (e) => {
    e.preventDefault();
    try {
      setPreviewLoading(true);
      const res = await apiFetch(`/admin/hiring/applications/${applicationId}/approve-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(offerForm),
      });
      if (res.ok) {
        const data = await res.json();
        setOfferPreviewHtml(data.preview_html);
      }
    } catch (err) {
      console.error('Failed offer preview:', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleConfirmApproval = async () => {
    try {
      setApproving(true);
      const res = await apiFetch(`/admin/hiring/applications/${applicationId}/approve-confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(offerForm),
      });
      if (res.ok) {
        setShowOfferModal(false);
        fetchDetail();
      }
    } catch (err) {
      console.error('Failed approval confirmation:', err);
    } finally {
      setApproving(false);
    }
  };

  const handlePreviewCert = async (e) => {
    e.preventDefault();
    try {
      setCertPreviewLoading(true);
      const res = await apiFetch(`/admin/hiring/applications/${applicationId}/issue-certificate-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(certForm),
      });
      if (res.ok) {
        const data = await res.json();
        setCertPreviewHtml(data.preview_html);
      }
    } catch (err) {
      console.error('Failed certificate preview:', err);
    } finally {
      setCertPreviewLoading(false);
    }
  };

  const handleConfirmIssueCert = async () => {
    try {
      setIssuingCert(true);
      const res = await apiFetch(`/admin/hiring/applications/${applicationId}/issue-certificate-confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(certForm),
      });
      if (res.ok) {
        setShowCertModal(false);
        fetchDetail();
      }
    } catch (err) {
      console.error('Failed certificate confirmation:', err);
    } finally {
      setIssuingCert(false);
    }
  };

  if (loading) {
    return (
      <AdminShell activeTab="hiring">
        <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>Loading application specification...</div>
      </AdminShell>
    );
  }

  return (
    <AdminShell activeTab="hiring">
      <div style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto', color: '#f3f4f6' }}>
        {/* Navigation */}
        <Link href="/hiring" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#9ca3af', textDecoration: 'none', fontSize: '13px', fontWeight: '600', marginBottom: '20px' }}>
          <ArrowLeft size={16} /> Back to Pipeline Dashboard
        </Link>

        {/* Application Banner */}
        <div style={{ background: 'rgba(18, 20, 29, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '24px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '800', margin: '0 0 6px 0', color: '#ffffff' }}>{application?.candidate_name}</h1>
            <div style={{ fontSize: '14px', color: '#9ca3af' }}>
              Applied for <strong style={{ color: '#818cf8' }}>{application?.position_title}</strong> ({application?.position_department}) • {application?.candidate_email}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ padding: '6px 14px', borderRadius: '9999px', fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
              {application?.status}
            </span>

            <button
              onClick={() => {
                fetchPolyCertTemplates();
                setCertForm({
                  role_title: application?.position_title || '',
                  duration: '6 Months',
                  organization_name: 'Code Plus Academy',
                  signatory: 'Dr. Alex Vance',
                  signatory_role: 'Director of Engineering',
                  signature_text: 'Dr. Alex Vance',
                  template_name: 'certificate.html'
                });
                setShowCertModal(true);
              }}
              style={{
                padding: '10px 18px', borderRadius: '8px', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                color: '#ffffff', fontWeight: '700', border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
                display: 'inline-flex', alignItems: 'center', gap: '6px'
              }}
            >
              <Award size={16} /> Issue &amp; Send Certificate
            </button>

            {application?.status !== 'approved' && (
              <button
                onClick={() => {
                  setOfferForm({ offer_title: application?.position_title || '', start_date: '', compensation: '', manager_name: '' });
                  setShowOfferModal(true);
                }}
                style={{
                  padding: '10px 18px', borderRadius: '8px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff', fontWeight: '700', border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
                }}
              >
                Approve &amp; Send Offer Letter
              </button>
            )}
          </div>
        </div>

        {/* 2-Column Content Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px' }}>
          {/* Main Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Multi-Note Thread */}
            <div style={{ background: 'rgba(18, 20, 29, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 16px 0', color: '#ffffff' }}>Internal Admin Notes</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                {notes.map((n) => (
                  <div key={n.id} style={{ background: 'rgba(10, 11, 16, 0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>
                      <strong style={{ color: '#818cf8' }}>{n.admin_name}</strong>
                      <span>{new Date(n.created_at).toLocaleString()}</span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#e5e7eb', lineHeight: 1.5 }}>{n.note}</div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddNote} style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  placeholder="Add timestamped internal note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(10, 11, 16, 0.6)', color: '#fff', fontSize: '13px', outline: 'none' }}
                />
                <button type="submit" style={{ padding: '10px 16px', borderRadius: '8px', background: '#6366f1', color: '#fff', border: 'none', fontWeight: '600', cursor: 'pointer' }}>
                  Post Note
                </button>
              </form>
            </div>

            {/* Direct Candidate Messenger */}
            <div style={{ background: 'rgba(18, 20, 29, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 16px 0', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageSquare size={18} style={{ color: '#6366f1' }} /> Candidate Direct Messenger
              </h3>
              <div style={{ height: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                {messages.map((m) => {
                  const isAdmin = m.sender_role === 'admin' || m.sender_role === 1;
                  return (
                    <div key={m.id} style={{ alignSelf: isAdmin ? 'flex-end' : 'flex-start', maxWidth: '80%', padding: '10px 14px', borderRadius: '10px', background: isAdmin ? '#6366f1' : 'rgba(255,255,255,0.08)', color: '#fff', fontSize: '13px' }}>
                      <div style={{ fontSize: '10px', opacity: 0.8, marginBottom: '2px' }}>{isAdmin ? 'Admin' : 'Candidate'}</div>
                      <div>{m.body}</div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSendAdminMessage} style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  placeholder="Send direct reply to candidate..."
                  value={chatDraft}
                  onChange={(e) => setChatDraft(e.target.value)}
                  style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(10, 11, 16, 0.6)', color: '#fff', fontSize: '13px', outline: 'none' }}
                />
                <button type="submit" style={{ padding: '10px 16px', borderRadius: '8px', background: '#6366f1', color: '#fff', border: 'none', fontWeight: '600', cursor: 'pointer' }}>
                  Send <Send size={14} />
                </button>
              </form>
            </div>

            {/* Intern Task Manager */}
            <div style={{ background: 'rgba(18, 20, 29, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 16px 0', color: '#ffffff' }}>Intern Tasks &amp; Checklist</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {tasks.map((t) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '8px', background: 'rgba(10, 11, 16, 0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button onClick={() => handleToggleTaskStatus(t)} style={{ background: t.status === 'done' ? '#10b981' : 'transparent', border: '1px solid #10b981', borderRadius: '4px', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
                        {t.status === 'done' && <Check size={14} />}
                      </button>
                      <span style={{ textDecoration: t.status === 'done' ? 'line-through' : 'none', color: t.status === 'done' ? '#9ca3af' : '#fff', fontSize: '13px' }}>{t.title}</span>
                    </div>
                    <span style={{ fontSize: '11px', color: t.status === 'done' ? '#34d399' : '#fbbf24', fontWeight: '700' }}>{t.status}</span>
                  </div>
                ))}
              </div>

              <form onSubmit={handleCreateTask} style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  placeholder="Assign new task..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(10, 11, 16, 0.6)', color: '#fff', fontSize: '13px', outline: 'none' }}
                />
                <button type="submit" style={{ padding: '8px 14px', borderRadius: '8px', background: '#3b82f6', color: '#fff', border: 'none', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>
                  Add Task
                </button>
              </form>
            </div>
          </div>

          {/* Sidebar Meta Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: 'rgba(18, 20, 29, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '20px' }}>
              <h4 style={{ fontSize: '12px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', margin: '0 0 12px 0' }}>Resume &amp; Attachments</h4>
              {application?.resume_url ? (
                <a href={application.resume_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#818cf8', textDecoration: 'none', fontWeight: '600', fontSize: '13px' }}>
                  <FileText size={16} /> Open Resume PDF
                </a>
              ) : (
                <span style={{ fontSize: '13px', color: '#9ca3af' }}>No resume uploaded</span>
              )}
            </div>

            <div style={{ background: 'rgba(18, 20, 29, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '20px' }}>
              <h4 style={{ fontSize: '12px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', margin: '0 0 12px 0' }}>Status Audit Trail</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {history.map((h) => (
                  <div key={h.id} style={{ fontSize: '12px', borderLeft: '2px solid #6366f1', paddingLeft: '10px' }}>
                    <div style={{ color: '#ffffff', fontWeight: '600' }}>{h.from_status} → {h.to_status}</div>
                    <div style={{ color: '#6b7280', fontSize: '10px' }}>By {h.changed_by_name || 'Admin'} • {new Date(h.created_at).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Offer Letter Approval Modal with Live HTML Preview */}
        {showOfferModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ background: '#12141d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '24px', width: '90%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '16px', color: '#ffffff' }}>Approve &amp; Generate Offer Letter</h2>

              <form onSubmit={handlePreviewOffer} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: '#9ca3af' }}>Offer Position Title</label>
                    <input type="text" value={offerForm.offer_title} onChange={(e) => setOfferForm({ ...offerForm, offer_title: e.target.value })} required style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: '#0a0b10', color: '#fff' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#9ca3af' }}>Start Date</label>
                    <input type="text" placeholder="e.g. October 1, 2026" value={offerForm.start_date} onChange={(e) => setOfferForm({ ...offerForm, start_date: e.target.value })} required style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: '#0a0b10', color: '#fff' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: '#9ca3af' }}>Compensation / Stipend</label>
                    <input type="text" placeholder="e.g. $1,500 / month" value={offerForm.compensation} onChange={(e) => setOfferForm({ ...offerForm, compensation: e.target.value })} required style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: '#0a0b10', color: '#fff' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#9ca3af' }}>Reporting Manager</label>
                    <input type="text" placeholder="e.g. Engineering Director" value={offerForm.manager_name} onChange={(e) => setOfferForm({ ...offerForm, manager_name: e.target.value })} required style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: '#0a0b10', color: '#fff' }} />
                  </div>
                </div>

                <button type="submit" style={{ padding: '8px', borderRadius: '6px', background: '#3b82f6', color: '#fff', border: 'none', fontWeight: '600', cursor: 'pointer' }}>
                  {previewLoading ? 'Generating Preview...' : 'Preview Offer Letter HTML'}
                </button>
              </form>

              {offerPreviewHtml && (
                <div style={{ background: '#ffffff', color: '#000000', padding: '20px', borderRadius: '8px', marginBottom: '20px', maxHeight: '250px', overflowY: 'auto' }}>
                  <div dangerouslySetInnerHTML={{ __html: offerPreviewHtml }} />
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setShowOfferModal(false)} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button
                  onClick={handleConfirmApproval}
                  disabled={approving || !offerPreviewHtml}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '6px', border: 'none',
                    background: approving ? '#9ca3af' : '#10b981', color: '#fff', fontWeight: '700', cursor: 'pointer'
                  }}
                >
                  {approving ? 'Dispatching Offer...' : 'Confirm & Dispatch Offer Letter'}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Certificate Generation Modal with Live HTML Preview */}
        {showCertModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ background: '#12141d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '24px', width: '90%', maxWidth: '720px', maxHeight: '90vh', overflowY: 'auto' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '16px', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Award style={{ color: '#818cf8' }} size={22} /> Issue &amp; Generate Certificate of Completion
              </h2>

              <form onSubmit={handlePreviewCert} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: '#9ca3af' }}>Certificate Role / Title</label>
                    <input type="text" value={certForm.role_title} onChange={(e) => setCertForm({ ...certForm, role_title: e.target.value })} required style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: '#0a0b10', color: '#fff' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#9ca3af' }}>Program Duration</label>
                    <input type="text" placeholder="e.g. 6 Months / 120 Hours" value={certForm.duration} onChange={(e) => setCertForm({ ...certForm, duration: e.target.value })} required style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: '#0a0b10', color: '#fff' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: '#9ca3af' }}>Organization Name</label>
                    <input type="text" value={certForm.organization_name} onChange={(e) => setCertForm({ ...certForm, organization_name: e.target.value })} required style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: '#0a0b10', color: '#fff' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#9ca3af' }}>PolyCert Studio Jinja2 Template</label>
                    <select
                      value={certForm.template_name}
                      onChange={(e) => setCertForm({ ...certForm, template_name: e.target.value })}
                      required
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: '#0a0b10', color: '#fff' }}
                    >
                      {availableTemplates.length > 0 ? (
                        availableTemplates.map((t) => (
                          <option key={t.filename} value={t.filename}>
                            {t.name || t.filename} ({t.filename})
                          </option>
                        ))
                      ) : (
                        <option value="certificate.html">Certificate (certificate.html)</option>
                      )}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: '#9ca3af' }}>Signatory Name</label>
                    <input type="text" value={certForm.signatory} onChange={(e) => setCertForm({ ...certForm, signatory: e.target.value })} required style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: '#0a0b10', color: '#fff' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#9ca3af' }}>Signatory Role</label>
                    <input type="text" value={certForm.signatory_role} onChange={(e) => setCertForm({ ...certForm, signatory_role: e.target.value })} required style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: '#0a0b10', color: '#fff' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#9ca3af' }}>Cursive Signature Text</label>
                    <input type="text" value={certForm.signature_text} onChange={(e) => setCertForm({ ...certForm, signature_text: e.target.value })} required style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: '#0a0b10', color: '#fff' }} />
                  </div>
                </div>

                <button type="submit" disabled={certPreviewLoading} style={{ padding: '10px', borderRadius: '6px', background: '#6366f1', color: '#fff', border: 'none', fontWeight: '600', cursor: 'pointer' }}>
                  {certPreviewLoading ? 'Fetching Jinja2 Template from PolyCert Studio...' : 'Preview Jinja2 Certificate HTML'}
                </button>
              </form>

              {certPreviewHtml && (
                <div style={{ background: '#ffffff', borderRadius: '8px', marginBottom: '20px', padding: '4px', border: '1px solid rgba(255,255,255,0.2)' }}>
                  <iframe
                    srcDoc={certPreviewHtml}
                    title="PolyCert Certificate Preview"
                    style={{ width: '100%', height: '320px', border: 'none', borderRadius: '6px', background: '#ffffff' }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setShowCertModal(false)} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button
                  onClick={handleConfirmIssueCert}
                  disabled={issuingCert || !certPreviewHtml}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '6px', border: 'none',
                    background: issuingCert ? '#9ca3af' : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: '#fff', fontWeight: '700', cursor: 'pointer'
                  }}
                >
                  {issuingCert ? 'Generating & Dispatching Certificate...' : 'Confirm & Issue Certificate'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
