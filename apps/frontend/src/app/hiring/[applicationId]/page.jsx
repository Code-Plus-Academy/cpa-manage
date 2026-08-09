'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AdminShell from '../../../components/shell/AdminShell';
import { apiFetch } from '../../../lib/apiClient';
import {
  ArrowLeft, MessageSquare, Send, CheckCircle2, Clock, XCircle, AlertCircle,
  FileText, Sparkles, User, ShieldCheck, Plus, Check, Award, Maximize2, ZoomIn, ZoomOut, Minimize2
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
  const [showOfferFullscreenPreview, setShowOfferFullscreenPreview] = useState(false);
  const [offerPreviewZoom, setOfferPreviewZoom] = useState(1);
  const [selectedOfferTemplateFile, setSelectedOfferTemplateFile] = useState('offer_letter.html');
  const [detectedOfferVariables, setDetectedOfferVariables] = useState([]);
  const [dynamicOfferFormFields, setDynamicOfferFormFields] = useState({});

  const [offerPreviewHtml, setOfferPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [approving, setApproving] = useState(false);

  // Certificate / Document Generation Preview Modal
  const [showCertModal, setShowCertModal] = useState(false);
  const [showFullscreenPreview, setShowFullscreenPreview] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [availableTemplates, setAvailableTemplates] = useState([]);
  const [selectedTemplateFile, setSelectedTemplateFile] = useState('certificate.html');
  const [detectedVariables, setDetectedVariables] = useState([]);
  const [dynamicFormFields, setDynamicFormFields] = useState({});

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
          return data.templates;
        }
      }
    } catch (err) {
      console.error('Failed to fetch PolyCert templates:', err);
    }
    return [];
  };

  const openCertIssuanceModal = async () => {
    const tList = await fetchPolyCertTemplates();
    const defaultTemplate = tList[0]?.filename || selectedTemplateFile || 'certificate.html';
    setSelectedTemplateFile(defaultTemplate);

    const tObj = tList.find(t => t.filename === defaultTemplate);
    const vars = tObj?.variables || ['name', 'role', 'organization_name', 'duration', 'date', 'signatory', 'signatory_role', 'signature_text'];
    setDetectedVariables(vars);

    const initFields = {};
    vars.forEach(v => {
      if (v === 'name') initFields[v] = application?.candidate_name || '';
      else if (v === 'role' || v === 'role_title') initFields[v] = application?.position_title || 'Software Developer';
      else if (v === 'company_name' || v === 'organization_name') initFields[v] = 'Code Plus Academy';
      else if (v === 'holding_company') initFields[v] = 'Code Plus Education';
      else if (v === 'duration') initFields[v] = '6 Months';
      else if (v === 'signatory' || v === 'program_lead') initFields[v] = 'Dr. Alex Vance';
      else if (v === 'signatory_role' || v === 'signatory_title' || v === 'program_lead_title') initFields[v] = 'Director of Engineering';
      else if (v === 'signature_text') initFields[v] = 'Dr. Alex Vance';
      else if (v === 'date' || v === 'start_date') initFields[v] = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      else if (v === 'end_date') initFields[v] = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      else if (v === 'status') initFields[v] = 'SUCCESSFULLY COMPLETED';
      else if (v === 'compensation') initFields[v] = '$85,000 / Year';
      else initFields[v] = '';
    });
    setDynamicFormFields(initFields);
    setShowCertModal(true);
  };

  const openOfferIssuanceModal = async () => {
    const tList = await fetchPolyCertTemplates();
    const defaultTemplate = tList.find(t => t.filename.includes('offer'))?.filename || tList[0]?.filename || 'offer_letter.html';
    setSelectedOfferTemplateFile(defaultTemplate);

    const tObj = tList.find(t => t.filename === defaultTemplate);
    const vars = tObj?.variables || ['name', 'role', 'company_name', 'organization_name', 'compensation', 'start_date', 'date', 'signatory', 'signatory_role', 'signature_text'];
    setDetectedOfferVariables(vars);

    const initFields = {};
    vars.forEach(v => {
      if (v === 'name') initFields[v] = application?.candidate_name || '';
      else if (v === 'role' || v === 'role_title' || v === 'offer_title') initFields[v] = application?.position_title || 'Software Developer';
      else if (v === 'company_name' || v === 'organization_name') initFields[v] = 'Code Plus Academy';
      else if (v === 'holding_company') initFields[v] = 'Code Plus Education';
      else if (v === 'duration') initFields[v] = '6 Months';
      else if (v === 'compensation') initFields[v] = '$85,000 / Year';
      else if (v === 'start_date' || v === 'date') initFields[v] = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      else if (v === 'manager_name' || v === 'signatory') initFields[v] = 'Dr. Alex Vance';
      else if (v === 'signatory_role' || v === 'signatory_title') initFields[v] = 'Director of Engineering';
      else if (v === 'signature_text') initFields[v] = 'Dr. Alex Vance';
      else initFields[v] = '';
    });
    setDynamicOfferFormFields(initFields);
    setShowOfferModal(true);
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
    if (e && e.preventDefault) e.preventDefault();
    try {
      setPreviewLoading(true);
      const res = await apiFetch(`/admin/hiring/applications/${applicationId}/approve-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_name: selectedOfferTemplateFile,
          data: dynamicOfferFormFields
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setOfferPreviewHtml(data.preview_html);
        if (data.variables_detected && data.variables_detected.length > 0) {
          setDetectedOfferVariables(data.variables_detected);
        }
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
        body: JSON.stringify({
          template_name: selectedOfferTemplateFile,
          data: dynamicOfferFormFields
        }),
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
    if (e && e.preventDefault) e.preventDefault();
    try {
      setCertPreviewLoading(true);
      const res = await apiFetch(`/admin/hiring/applications/${applicationId}/issue-certificate-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_name: selectedTemplateFile,
          data: dynamicFormFields
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCertPreviewHtml(data.preview_html);
        if (data.variables_detected && data.variables_detected.length > 0) {
          setDetectedVariables(data.variables_detected);
        }
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
        body: JSON.stringify({
          template_name: selectedTemplateFile,
          data: dynamicFormFields
        }),
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

            {/* Offer Letter Action Button */}
            <button
              onClick={openOfferIssuanceModal}
              style={{
                padding: '10px 18px', borderRadius: '8px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff', fontWeight: '700', border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                display: 'inline-flex', alignItems: 'center', gap: '6px'
              }}
            >
              <FileText size={16} /> {history.some(h => h.event_type === 'approved' || h.event_type === 'offer_letter') || application?.status === 'approved' ? 'Re-issue Offer Letter' : 'Approve & Issue Offer Letter'}
            </button>

            {/* Certificate of Completion Action Button (Requires Offer Letter First) */}
            {(() => {
              const hasOffer = history.some(h => h.event_type === 'approved' || h.event_type === 'offer_letter' || h.event_type === 'certificate_issued') || application?.status === 'approved';
              return (
                <button
                  onClick={() => {
                    if (!hasOffer) {
                      alert('⚠️ Offer Letter Required First!\n\nAn Offer Letter must be issued to the candidate before generating a Certificate of Completion.');
                      return;
                    }
                    openCertIssuanceModal();
                  }}
                  style={{
                    padding: '10px 18px', borderRadius: '8px',
                    background: !hasOffer ? 'rgba(255, 255, 255, 0.08)' : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    color: !hasOffer ? '#9ca3af' : '#ffffff',
                    fontWeight: '700', border: !hasOffer ? '1px solid rgba(255,255,255,0.1)' : 'none',
                    cursor: !hasOffer ? 'not-allowed' : 'pointer',
                    boxShadow: !hasOffer ? 'none' : '0 4px 14px rgba(99, 102, 241, 0.35)',
                    display: 'inline-flex', alignItems: 'center', gap: '6px', opacity: !hasOffer ? 0.6 : 1
                  }}
                  title={!hasOffer ? "Offer Letter must be issued before generating Certificate of Completion" : "Issue Certificate of Completion"}
                >
                  <Award size={16} /> {hasOffer ? 'Issue & Send Certificate' : '🔒 Certificate (Offer First)'}
                </button>
              );
            })()}
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

        {/* Offer Letter Approval Modal with Live PolyCert HTML Preview & Fullscreen Pop-up */}
        {showOfferModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ background: '#12141d', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px', padding: '24px', width: '92%', maxWidth: '840px', maxHeight: '92vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <FileText style={{ color: '#10b981' }} size={22} /> Issue Offer Letter (PolyCert Studio)
                </h2>
                <span style={{ fontSize: '12px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '4px 10px', borderRadius: '12px', fontWeight: '600', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  Dynamic Offer Engine
                </span>
              </div>

              <form onSubmit={handlePreviewOffer} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
                {/* STEP 1: Select PolyCert Offer Template */}
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                    1. Select PolyCert Offer Letter Template
                  </label>
                  <select
                    value={selectedOfferTemplateFile}
                    onChange={(e) => {
                      const newFile = e.target.value;
                      setSelectedOfferTemplateFile(newFile);
                      const tObj = availableTemplates.find(t => t.filename === newFile);
                      const vars = tObj?.variables || ['name', 'role', 'company_name', 'organization_name', 'compensation', 'start_date', 'date', 'signatory', 'signatory_role', 'signature_text'];
                      setDetectedOfferVariables(vars);
                      
                      const initFields = {};
                      vars.forEach(v => {
                        if (v === 'name') initFields[v] = application?.candidate_name || '';
                        else if (v === 'role' || v === 'role_title' || v === 'offer_title') initFields[v] = application?.position_title || 'Software Developer';
                        else if (v === 'company_name' || v === 'organization_name') initFields[v] = 'Code Plus Academy';
                        else if (v === 'holding_company') initFields[v] = 'Code Plus Education';
                        else if (v === 'duration') initFields[v] = '6 Months';
                        else if (v === 'compensation') initFields[v] = '$85,000 / Year';
                        else if (v === 'start_date' || v === 'date') initFields[v] = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                        else if (v === 'manager_name' || v === 'signatory') initFields[v] = 'Dr. Alex Vance';
                        else if (v === 'signatory_role' || v === 'signatory_title') initFields[v] = 'Director of Engineering';
                        else if (v === 'signature_text') initFields[v] = 'Dr. Alex Vance';
                        else initFields[v] = '';
                      });
                      setDynamicOfferFormFields(initFields);
                    }}
                    required
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: '#0a0b10', color: '#fff', fontSize: '14px', fontWeight: '600' }}
                  >
                    {availableTemplates.length > 0 ? (
                      availableTemplates.map((t) => (
                        <option key={t.filename} value={t.filename}>
                          📄 {t.name || t.filename} ({t.filename}) {t.is_custom ? '— Custom Template' : ''}
                        </option>
                      ))
                    ) : (
                      <option value="offer_letter.html">📄 Offer Letter (offer_letter.html)</option>
                    )}
                  </select>
                </div>

                {/* STEP 2: Dynamic Jinja2 Placeholders Form */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      2. Offer Letter Fields &amp; Placeholders ({detectedOfferVariables.length > 0 ? detectedOfferVariables.length : 8} Detected)
                    </label>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {(detectedOfferVariables.length > 0 ? detectedOfferVariables : ['name', 'role', 'company_name', 'compensation', 'start_date', 'signatory', 'signatory_role', 'signature_text']).map((varName) => {
                      if (varName === 'serial_no' || varName === 'signature_image') return null;
                      const fieldLabel = varName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                      return (
                        <div key={varName}>
                          <label style={{ fontSize: '11px', color: '#9ca3af', display: 'flex', gap: '4px', alignItems: 'center', marginBottom: '4px' }}>
                            <span>{fieldLabel}</span>
                            <span style={{ fontSize: '10px', color: '#34d399', fontFamily: 'monospace' }}>({`{{ ${varName} }}`})</span>
                          </label>
                          <input
                            type="text"
                            value={dynamicOfferFormFields[varName] !== undefined ? dynamicOfferFormFields[varName] : ''}
                            onChange={(e) => setDynamicOfferFormFields({ ...dynamicOfferFormFields, [varName]: e.target.value })}
                            placeholder={`Enter ${fieldLabel}...`}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: '#0a0b10', color: '#fff', fontSize: '13px' }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button type="submit" disabled={previewLoading} style={{ padding: '12px', borderRadius: '8px', background: 'linear-gradient(90deg, #10b981, #059669)', color: '#fff', border: 'none', fontWeight: '700', cursor: 'pointer', fontSize: '14px', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)' }}>
                  {previewLoading ? 'Fetching Jinja2 Offer Template & Rendering...' : '✨ Render & Preview Offer Letter HTML'}
                </button>
              </form>

              {/* Rendered Preview Bar & Interactive Controls */}
              {offerPreviewHtml && (
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', marginBottom: '20px', padding: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      👁️ Live Offer Preview ({selectedOfferTemplateFile})
                    </span>
                    <button
                      onClick={() => setShowOfferFullscreenPreview(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.4)', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      <Maximize2 size={14} /> Open Fullscreen Pop-up Preview
                    </button>
                  </div>

                  <div style={{ background: '#ffffff', borderRadius: '8px', padding: '4px', overflow: 'hidden', height: '360px' }}>
                    <iframe
                      srcDoc={offerPreviewHtml}
                      title="PolyCert Offer Letter Preview"
                      style={{ width: '100%', height: '100%', border: 'none', borderRadius: '6px', background: '#ffffff' }}
                    />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setShowOfferModal(false)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', cursor: 'pointer', fontWeight: '600' }}>
                  Cancel
                </button>
                <button
                  onClick={handleConfirmApproval}
                  disabled={approving || !offerPreviewHtml}
                  style={{
                    flex: 1.5, padding: '12px', borderRadius: '8px', border: 'none',
                    background: approving ? '#9ca3af' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
                  }}
                >
                  {approving ? 'Generating & Dispatching Offer Letter...' : '🚀 Confirm & Dispatch Offer Letter'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FULL-SCREEN ADAPTIVE POP-UP PREVIEW MODAL FOR OFFER LETTERS */}
        {showOfferFullscreenPreview && offerPreviewHtml && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(16px)', zIndex: 200, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', background: '#12141d', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <FileText style={{ color: '#10b981' }} size={24} />
                <span style={{ fontSize: '16px', fontWeight: '800', color: '#fff' }}>
                  PolyCert Offer Letter Pop-up Preview — {selectedOfferTemplateFile}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button onClick={() => setOfferPreviewZoom(prev => Math.max(0.5, prev - 0.15))} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ZoomOut size={16} /> Zoom Out
                </button>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#34d399', width: '50px', textAlign: 'center' }}>
                  {Math.round(offerPreviewZoom * 100)}%
                </span>
                <button onClick={() => setOfferPreviewZoom(prev => Math.min(2.0, prev + 0.15))} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ZoomIn size={16} /> Zoom In
                </button>
                <button onClick={() => setOfferPreviewZoom(1.0)} style={{ padding: '8px 12px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}>
                  Fit Width
                </button>

                <button onClick={() => setShowOfferFullscreenPreview(false)} style={{ padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', marginLeft: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Minimize2 size={16} /> Close Pop-up
                </button>
              </div>
            </div>

            <div style={{ flex: 1, padding: '24px', overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0b10' }}>
              <div style={{ width: '100%', height: '100%', maxWidth: '1100px', background: '#ffffff', borderRadius: '12px', boxShadow: '0 25px 60px rgba(0,0,0,0.8)', overflow: 'hidden', transform: `scale(${offerPreviewZoom})`, transformOrigin: 'top center', transition: 'transform 0.2s ease-in-out' }}>
                <iframe
                  srcDoc={offerPreviewHtml}
                  title="PolyCert Fullscreen Offer Letter Preview"
                  style={{ width: '100%', height: '100%', minHeight: '750px', border: 'none', background: '#ffffff' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Certificate / Document Generation Modal with Live HTML Preview & Fullscreen Pop-up */}
        {showCertModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ background: '#12141d', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px', padding: '24px', width: '92%', maxWidth: '840px', maxHeight: '92vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <Award style={{ color: '#818cf8' }} size={22} /> Issue Document &amp; Certificate (PolyCert Studio)
                </h2>
                <span style={{ fontSize: '12px', background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', padding: '4px 10px', borderRadius: '12px', fontWeight: '600', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                  Dynamic Jinja2 Template Engine
                </span>
              </div>

              <form onSubmit={handlePreviewCert} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
                {/* STEP 1: Select PolyCert Template */}
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                    1. Select PolyCert Studio Template
                  </label>
                  <select
                    value={selectedTemplateFile}
                    onChange={(e) => {
                      const newFile = e.target.value;
                      setSelectedTemplateFile(newFile);
                      const tObj = availableTemplates.find(t => t.filename === newFile);
                      const vars = tObj?.variables || ['name', 'role', 'organization_name', 'duration', 'date', 'signatory', 'signatory_role', 'signature_text'];
                      setDetectedVariables(vars);
                      
                      // Auto-initialize default values for variables
                      const initFields = {};
                      vars.forEach(v => {
                        if (v === 'name') initFields[v] = application?.candidate_name || '';
                        else if (v === 'role' || v === 'role_title') initFields[v] = application?.position_title || 'Software Developer';
                        else if (v === 'company_name' || v === 'organization_name') initFields[v] = 'Code Plus Academy';
                        else if (v === 'holding_company') initFields[v] = 'Code Plus Education';
                        else if (v === 'duration') initFields[v] = '6 Months';
                        else if (v === 'signatory' || v === 'program_lead') initFields[v] = 'Dr. Alex Vance';
                        else if (v === 'signatory_role' || v === 'signatory_title' || v === 'program_lead_title') initFields[v] = 'Director of Engineering';
                        else if (v === 'signature_text') initFields[v] = 'Dr. Alex Vance';
                        else if (v === 'date' || v === 'start_date') initFields[v] = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                        else if (v === 'end_date') initFields[v] = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                        else if (v === 'status') initFields[v] = 'SUCCESSFULLY COMPLETED';
                        else if (v === 'compensation') initFields[v] = '$85,000 / Year';
                        else initFields[v] = '';
                      });
                      setDynamicFormFields(initFields);
                    }}
                    required
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: '#0a0b10', color: '#fff', fontSize: '14px', fontWeight: '600' }}
                  >
                    {availableTemplates.length > 0 ? (
                      availableTemplates.map((t) => (
                        <option key={t.filename} value={t.filename}>
                          📄 {t.name || t.filename} ({t.filename}) {t.is_custom ? '— Custom Template' : ''}
                        </option>
                      ))
                    ) : (
                      <option value="certificate.html">📄 Certificate (certificate.html)</option>
                    )}
                  </select>
                </div>

                {/* STEP 2: Dynamic Jinja2 Placeholders Form */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      2. Template Fields &amp; Jinja2 Placeholders ({detectedVariables.length > 0 ? detectedVariables.length : 8} Detected)
                    </label>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {(detectedVariables.length > 0 ? detectedVariables : ['name', 'role', 'organization_name', 'duration', 'date', 'signatory', 'signatory_role', 'signature_text']).map((varName) => {
                      if (varName === 'serial_no' || varName === 'signature_image') return null; // Auto-generated
                      const fieldLabel = varName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                      return (
                        <div key={varName}>
                          <label style={{ fontSize: '11px', color: '#9ca3af', display: 'flex', gap: '4px', alignItems: 'center', marginBottom: '4px' }}>
                            <span>{fieldLabel}</span>
                            <span style={{ fontSize: '10px', color: '#6366f1', fontFamily: 'monospace' }}>({`{{ ${varName} }}`})</span>
                          </label>
                          <input
                            type="text"
                            value={dynamicFormFields[varName] !== undefined ? dynamicFormFields[varName] : ''}
                            onChange={(e) => setDynamicFormFields({ ...dynamicFormFields, [varName]: e.target.value })}
                            placeholder={`Enter ${fieldLabel}...`}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: '#0a0b10', color: '#fff', fontSize: '13px' }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button type="submit" disabled={certPreviewLoading} style={{ padding: '12px', borderRadius: '8px', background: 'linear-gradient(90deg, #6366f1, #4f46e5)', color: '#fff', border: 'none', fontWeight: '700', cursor: 'pointer', fontSize: '14px', boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)' }}>
                  {certPreviewLoading ? 'Fetching Jinja2 Template & Rendering Preview...' : '✨ Render & Preview Jinja2 Document'}
                </button>
              </form>

              {/* Rendered Preview Bar & Interactive Controls */}
              {certPreviewHtml && (
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', marginBottom: '20px', padding: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      👁️ Live Rendered Preview ({selectedTemplateFile})
                    </span>
                    <button
                      onClick={() => setShowFullscreenPreview(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.4)', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      <Maximize2 size={14} /> Open Fullscreen Pop-up Preview
                    </button>
                  </div>

                  <div style={{ background: '#ffffff', borderRadius: '8px', padding: '4px', overflow: 'hidden', height: '360px' }}>
                    <iframe
                      srcDoc={certPreviewHtml}
                      title="PolyCert Document Preview"
                      style={{ width: '100%', height: '100%', border: 'none', borderRadius: '6px', background: '#ffffff' }}
                    />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setShowCertModal(false)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', cursor: 'pointer', fontWeight: '600' }}>
                  Cancel
                </button>
                <button
                  onClick={handleConfirmIssueCert}
                  disabled={issuingCert || !certPreviewHtml}
                  style={{
                    flex: 1.5, padding: '12px', borderRadius: '8px', border: 'none',
                    background: issuingCert ? '#9ca3af' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
                  }}
                >
                  {issuingCert ? 'Generating & Dispatching Document...' : '🚀 Confirm & Issue Document'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FULL-SCREEN ADAPTIVE POP-UP PREVIEW MODAL */}
        {showFullscreenPreview && certPreviewHtml && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(16px)', zIndex: 200, display: 'flex', flexDirection: 'column' }}>
            {/* Top Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', background: '#12141d', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Award style={{ color: '#818cf8' }} size={24} />
                <span style={{ fontSize: '16px', fontWeight: '800', color: '#fff' }}>
                  PolyCert Studio Pop-up Preview — {selectedTemplateFile}
                </span>
              </div>

              {/* Zoom & Viewport Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button onClick={() => setPreviewZoom(prev => Math.max(0.5, prev - 0.15))} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ZoomOut size={16} /> Zoom Out
                </button>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#818cf8', width: '50px', textAlign: 'center' }}>
                  {Math.round(previewZoom * 100)}%
                </span>
                <button onClick={() => setPreviewZoom(prev => Math.min(2.0, prev + 0.15))} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ZoomIn size={16} /> Zoom In
                </button>
                <button onClick={() => setPreviewZoom(1.0)} style={{ padding: '8px 12px', background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}>
                  Fit Width
                </button>

                <button onClick={() => setShowFullscreenPreview(false)} style={{ padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', marginLeft: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Minimize2 size={16} /> Close Pop-up
                </button>
              </div>
            </div>

            {/* Adaptive Content Area */}
            <div style={{ flex: 1, padding: '24px', overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0b10' }}>
              <div style={{ width: '100%', height: '100%', maxWidth: '1200px', background: '#ffffff', borderRadius: '12px', boxShadow: '0 25px 60px rgba(0,0,0,0.8)', overflow: 'hidden', transform: `scale(${previewZoom})`, transformOrigin: 'top center', transition: 'transform 0.2s ease-in-out' }}>
                <iframe
                  srcDoc={certPreviewHtml}
                  title="PolyCert Fullscreen Pop-up Preview"
                  style={{ width: '100%', height: '100%', minHeight: '750px', border: 'none', background: '#ffffff' }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
