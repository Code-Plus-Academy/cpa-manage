'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, CheckCircle2, MessageSquare, Send, FileText, User, Mail,
  Clock, Plus, AlertCircle, Award, Sparkles, XCircle
} from 'lucide-react';
import AdminShell from '../../../components/shell/AdminShell';

export default function AdminApplicationDetailPage() {
  const { applicationId } = useParams();
  const router = useRouter();

  const [adminUser, setAdminUser] = useState(null);
  const [application, setApplication] = useState(null);
  const [messages, setMessages] = useState([]);
  const [tasks, setTasks] = useState([]);

  const [loading, setLoading] = useState(true);
  const [chatDraft, setChatDraft] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [approving, setApproving] = useState(false);
  const [documentStatus, setDocumentStatus] = useState(null);

  // New task form state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [addingTask, setAddingTask] = useState(false);

  const messagesEndRef = useRef(null);
  const apiUrl = process.env.NEXT_PUBLIC_MANAGE_API_URL || 'http://localhost:4000';

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (adminUser && applicationId) {
      loadApplicationDetails();
      loadMessages();
      loadTasks();
    }
  }, [adminUser, applicationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const checkAuth = async () => {
    try {
      const res = await fetch(`${apiUrl}/admin/auth/me`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAdminUser(data.admin_user);
      } else {
        setAdminUser({ name: 'Admin', role: 'root' });
      }
    } catch (err) {
      setAdminUser({ name: 'Admin', role: 'root' });
    }
  };

  const loadApplicationDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${apiUrl}/admin/hiring/applications/${applicationId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setApplication(data);
      }
    } catch (err) {
      console.error('Failed to load application:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    try {
      const res = await fetch(`${apiUrl}/admin/hiring/applications/${applicationId}/messages`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  const loadTasks = async () => {
    try {
      const res = await fetch(`${apiUrl}/admin/hiring/applications/${applicationId}/tasks`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (err) {
      console.error('Failed to load tasks:', err);
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    try {
      const res = await fetch(`${apiUrl}/admin/hiring/applications/${applicationId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setApplication(updated);
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleApproveCandidate = async () => {
    try {
      setApproving(true);
      const res = await fetch(`${apiUrl}/admin/hiring/applications/${applicationId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ approved_by: adminUser?.id || 'admin' }),
      });
      if (res.ok) {
        const data = await res.json();
        setApplication(data.application);
        setDocumentStatus(data.document_trigger_status || 'stubbed');
      }
    } catch (err) {
      console.error('Failed to approve candidate:', err);
    } finally {
      setApproving(false);
    }
  };

  const handleSendAdminMessage = async (e) => {
    e.preventDefault();
    if (!chatDraft.trim()) return;

    try {
      setSendingChat(true);
      const res = await fetch(`${apiUrl}/admin/hiring/applications/${applicationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ body: chatDraft.trim() }),
      });
      if (res.ok) {
        const msg = await res.json();
        setMessages((prev) => [...prev, msg]);
        setChatDraft('');
      }
    } catch (err) {
      console.error('Failed to send admin message:', err);
    } finally {
      setSendingChat(false);
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      setAddingTask(true);
      const res = await fetch(`${apiUrl}/admin/hiring/applications/${applicationId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: newTaskTitle.trim(), progress: 0, status: 'pending' }),
      });
      if (res.ok) {
        const task = await res.json();
        setTasks((prev) => [...prev, task]);
        setNewTaskTitle('');
      }
    } catch (err) {
      console.error('Failed to add task:', err);
    } finally {
      setAddingTask(false);
    }
  };

  return (
    <AdminShell user={adminUser}>
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Back Link */}
        <Link
          href="/hiring"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            color: '#9ca3af',
            textDecoration: 'none',
            fontSize: '14px',
            marginBottom: '20px',
          }}
        >
          <ArrowLeft size={16} /> Back to Applications Pipeline
        </Link>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>Loading application details...</div>
        ) : !application ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#ef4444' }}>Application not found.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px' }}>
            {/* Left Area: Chat & Intern Tasks */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Header Details Banner */}
              <div
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  padding: '24px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px',
                }}
              >
                <div>
                  <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 4px 0', color: '#f9fafb' }}>
                    {application.candidate_name || 'Applicant'}
                  </h1>
                  <div style={{ fontSize: '13px', color: '#9ca3af' }}>
                    Applying for: <strong style={{ color: '#6366f1' }}>{application.position_title || application.position_id}</strong>
                  </div>
                </div>

                {/* Status Dropdown & Approval Trigger */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <select
                    value={application.status}
                    onChange={(e) => handleUpdateStatus(e.target.value)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      background: 'rgba(0,0,0,0.4)',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.15)',
                      fontSize: '13px',
                      fontWeight: 600,
                      outline: 'none',
                    }}
                  >
                    <option value="applied">Applied</option>
                    <option value="in_review">In Review</option>
                    <option value="interview">Interview</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>

                  <button
                    onClick={handleApproveCandidate}
                    disabled={approving || application.status === 'approved'}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      background: application.status === 'approved' ? 'rgba(16,185,129,0.2)' : '#10b981',
                      color: application.status === 'approved' ? '#10b981' : '#ffffff',
                      fontWeight: 700,
                      fontSize: '13px',
                      border: 'none',
                      cursor: approving || application.status === 'approved' ? 'default' : 'pointer',
                    }}
                  >
                    <CheckCircle2 size={16} />
                    {application.status === 'approved' ? 'Approved' : approving ? 'Approving...' : 'Approve & Trigger Document'}
                  </button>
                </div>
              </div>

              {/* Document Trigger Banner (if triggered) */}
              {documentStatus && (
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '10px',
                    background: 'rgba(16,185,129,0.1)',
                    border: '1px solid rgba(16,185,129,0.3)',
                    color: '#10b981',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <Sparkles size={18} />
                  <div>
                    <strong>Candidate Approved!</strong> Document generation RPC triggered status:{' '}
                    <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px' }}>{documentStatus}</code>
                  </div>
                </div>
              )}

              {/* Admin-Candidate Chat Panel */}
              <div
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '460px',
                }}
              >
                <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MessageSquare size={16} style={{ color: '#6366f1' }} /> Admin &amp; Candidate Live Chat
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {messages.length === 0 ? (
                    <div style={{ margin: 'auto', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                      No messages sent yet. Send a message to contact the applicant directly.
                    </div>
                  ) : (
                    messages.map((m, idx) => {
                      const isAdmin = m.sender_role?.toLowerCase() === 'admin' || m.senderRole?.toLowerCase() === 'admin';
                      return (
                        <div
                          key={m.id || idx}
                          style={{
                            alignSelf: isAdmin ? 'flex-end' : 'flex-start',
                            maxWidth: '75%',
                            padding: '10px 14px',
                            borderRadius: isAdmin ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                            background: isAdmin ? '#6366f1' : 'rgba(255,255,255,0.08)',
                            color: '#fff',
                            fontSize: '13px',
                          }}
                        >
                          <div style={{ fontSize: '10px', opacity: 0.7, marginBottom: '2px', fontWeight: 600 }}>
                            {isAdmin ? 'Admin' : 'Candidate'}
                          </div>
                          <div>{m.body}</div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <form onSubmit={handleSendAdminMessage} style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Type message to candidate..."
                    value={chatDraft}
                    onChange={(e) => setChatDraft(e.target.value)}
                    style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '13px', outline: 'none' }}
                  />
                  <button
                    type="submit"
                    disabled={sendingChat || !chatDraft.trim()}
                    style={{ padding: '10px 16px', borderRadius: '8px', background: '#6366f1', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}
                  >
                    <Send size={16} />
                  </button>
                </form>
              </div>

              {/* Intern Tasks Management Section */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 16px 0', color: '#f3f4f6' }}>
                  Intern Assigned Tasks
                </h3>

                {/* Add Task Form */}
                <form onSubmit={handleAddTask} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <input
                    type="text"
                    placeholder="Assign a new task (e.g. Complete gRPC endpoint testing)..."
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: '#fff', fontSize: '13px', outline: 'none' }}
                  />
                  <button type="submit" disabled={addingTask || !newTaskTitle.trim()} style={{ padding: '8px 14px', borderRadius: '6px', background: '#6366f1', color: '#fff', border: 'none', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                    <Plus size={16} /> Add Task
                  </button>
                </form>

                {/* Task List */}
                {tasks.length === 0 ? (
                  <div style={{ fontSize: '13px', color: '#9ca3af' }}>No tasks assigned yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {tasks.map((task) => (
                      <div key={task.id} style={{ padding: '10px 14px', borderRadius: '6px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '13px', color: '#e5e7eb' }}>{task.title}</div>
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: task.status === 'done' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)', color: task.status === 'done' ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                          {task.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Area: Candidate Information Card */}
            <div>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#f3f4f6' }}>Applicant Info</h3>

                <div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600 }}>EMAIL</div>
                  <div style={{ fontSize: '13px', color: '#e5e7eb', marginTop: '2px' }}>{application.candidate_email}</div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600 }}>PHONE</div>
                  <div style={{ fontSize: '13px', color: '#e5e7eb', marginTop: '2px' }}>{application.candidate_phone || 'N/A'}</div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, marginBottom: '4px' }}>RESUME LINK</div>
                  {application.resume_url ? (
                    <a href={application.resume_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', color: '#6366f1', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                      <FileText size={14} /> Open Resume PDF
                    </a>
                  ) : (
                    <div style={{ fontSize: '13px', color: '#6b7280' }}>No resume link provided</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
