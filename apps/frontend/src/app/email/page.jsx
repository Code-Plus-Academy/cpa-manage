'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mail, Calendar, Send, PieChart, Plus, RefreshCw, Eye, Edit3, Check, X, Clock, Play, Lock, ShieldCheck, Smartphone, Monitor
} from 'lucide-react';
import AdminShell from '../../components/shell/AdminShell';
import StatusPill from '../../components/ui/StatusPill';
import { tokens } from '../theme/tokens';

export default function StandaloneEmailPage() {
  const router = useRouter();
  const [adminUser, setAdminUser] = useState(null);
  const searchTab = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tab') : null;
  const [activeSubTab, setActiveSubTab] = useState(searchTab || 'templates'); // 'templates' | 'schedules' | 'campaigns' | 'analytics'
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  // Data states
  const [templates, setTemplates] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [sends, setSends] = useState([]);
  const [senderEmails, setSenderEmails] = useState([]);

  // Sender Email Modal States
  const [showSenderModal, setShowSenderModal] = useState(false);
  const [newSenderEmail, setNewSenderEmail] = useState('');
  const [newSenderName, setNewSenderName] = useState('');
  const [newSenderDefault, setNewSenderDefault] = useState(false);
  const [senderEmailId, setSenderEmailId] = useState('');

  // Template Modal States
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null); // null for create, template obj for edit
  const [templateKey, setTemplateKey] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateCategory, setTemplateCategory] = useState('transactional');
  // Template sender email state — stores the sender_email_id UUID (null = use platform default)
  const [selectedSenderEmailId, setSelectedSenderEmailId] = useState(null);
  const [replyToEmail, setReplyToEmail] = useState('support@codeplusacademy.in');
  const [subjectTemplate, setSubjectTemplate] = useState('');
  const [bodyHtmlTemplate, setBodyHtmlTemplate] = useState('');
  const [templateActive, setTemplateActive] = useState(true);
  const [templateSystemLocked, setTemplateSystemLocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Server-Side Live Render Preview Modal
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewViewport, setPreviewViewport] = useState('desktop'); // 'desktop' | 'mobile'
  const [mockPayloadJson, setMockPayloadJson] = useState(JSON.stringify({
    display_name: 'Rahul Sharma',
    name: 'Rahul Sharma',
    otp_code: '849201',
    expiry_minutes: '15',
    position: 'Senior Backend Engineer',
    startdate: '2026-09-01',
    action_link: 'https://codeplusacademy.in/action',
    ticket_id: '8492',
    action_type: 'temporary_takedown',
    reason: 'Copyright notice under DMCA section 512(c)'
  }, null, 2));
  const [renderedSubject, setRenderedSubject] = useState('');
  const [renderedBodyHtml, setRenderedBodyHtml] = useState('');
  const [renderingPreview, setRenderingPreview] = useState(false);

  // Live Debounced Placeholder Scanner & Validation
  const [detectedFields, setDetectedFields] = useState([]);
  const [invalidFields, setInvalidFields] = useState([]);

  const apiUrl = process.env.NEXT_PUBLIC_MANAGE_API_URL || 'http://localhost:4000';

  useEffect(() => {
    checkAuthStatus();
  }, []);

  // 300ms Debounced scanner for Handlebars placeholder variables
  useEffect(() => {
    const timer = setTimeout(() => {
      const combinedText = `${subjectTemplate} ${bodyHtmlTemplate}`;
      const regex = /\{\{\s*[#\/]?([a-zA-Z0-9_.]+)/g;
      const found = new Set();
      const ignoredKeywords = new Set(['if', 'unless', 'each', 'with', 'else', 'this']);
      let match;
      while ((match = regex.exec(combinedText)) !== null) {
        const varName = match[1];
        if (!ignoredKeywords.has(varName)) {
          found.add(varName);
        }
      }
      const vars = Array.from(found);
      setDetectedFields(vars);

      // In Create-New flow (editingTemplate is null), disable unsupported variable warnings
      if (!editingTemplate || !Array.isArray(editingTemplate.available_placeholders)) {
        setInvalidFields([]);
        return;
      }

      const allowedSet = new Set(editingTemplate.available_placeholders);
      const invalid = vars.filter(v => !allowedSet.has(v));
      setInvalidFields(invalid);
    }, 300);

    return () => clearTimeout(timer);
  }, [subjectTemplate, bodyHtmlTemplate, editingTemplate]);

  useEffect(() => {
    if (adminUser) {
      loadSubTabData(activeSubTab);
    }
  }, [adminUser, activeSubTab]);

  const getAuthHeaders = () => {
    const headers = { 'Content-Type': 'application/json' };
    const token = typeof window !== 'undefined' ? localStorage.getItem('cpa_admin_token') : null;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['X-Admin-Token'] = token;
    }
    return headers;
  };

  const apiFetch = async (endpoint, options = {}) => {
    const headers = { ...getAuthHeaders(), ...(options.headers || {}) };
    return fetch(`${apiUrl}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    });
  };

  const checkAuthStatus = async (retryCount = 0) => {
    try {
      const res = await apiFetch('/admin/auth/me');
      if (res.ok) {
        const data = await res.json();
        setAdminUser(data.admin_user);
      } else if (process.env.NODE_ENV === 'development') {
        setAdminUser({
          id: '1',
          display_name: 'Root Admin',
          is_root: true,
          permissions: ['email.templates.edit', 'email.analytics.view', 'email.schedule.manage', 'email.campaign.send'],
        });
      } else if (res.status === 401 && retryCount === 0) {
        // Retry once after 3s on transient cold start 401
        await new Promise(resolve => setTimeout(resolve, 3000));
        return checkAuthStatus(1);
      } else {
        setAdminUser(null);
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      if (retryCount === 0) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        return checkAuthStatus(1);
      }
      setAdminUser(null);
    } finally {
      setLoading(false);
    }
  };

  const loadSubTabData = async (subTab) => {
    setDataLoading(true);
    try {
      if (subTab === 'templates' || subTab === 'senders') {
        const [resTpl, resSenders] = await Promise.all([
          apiFetch('/admin/email/templates'),
          apiFetch('/admin/sender-emails'),
        ]);
        if (resTpl.ok) {
          const data = await resTpl.json();
          setTemplates(data.templates || []);
        }
        if (resSenders.ok) {
          const dataSenders = await resSenders.json();
          setSenderEmails(dataSenders.sender_emails || []);
        }
      } else if (subTab === 'schedules') {
        const res = await apiFetch('/admin/email/schedules');
        if (res.ok) {
          const data = await res.json();
          setSchedules(data.schedules || []);
        }
      } else if (subTab === 'campaigns') {
        const res = await apiFetch('/admin/email/campaigns');
        if (res.ok) {
          const data = await res.json();
          setCampaigns(data.campaigns || []);
        }
      } else if (subTab === 'analytics') {
        const [resAna, resSends] = await Promise.all([
          apiFetch('/admin/email/analytics'),
          apiFetch('/admin/email/sends'),
        ]);
        if (resAna.ok) {
          const dataAna = await resAna.json();
          setAnalytics(dataAna.analytics);
        }
        if (resSends.ok) {
          const dataSends = await resSends.json();
          setSends(dataSends.sends || []);
        }
      }
    } catch (err) {
      console.error(`Failed to load ${subTab}:`, err);
    } finally {
      setDataLoading(false);
    }
  };

  // Save Draft Template
  const handleSaveDraftTemplate = async (e) => {
    e?.preventDefault();
    setSubmitting(true);

    const isEdit = !!editingTemplate;
    const endpoint = isEdit
      ? `/admin/email/templates/${editingTemplate.key}`
      : `/admin/email/templates`;
    const method = isEdit ? 'PATCH' : 'POST';

    let availablePlaceholders = detectedFields.length > 0 ? detectedFields : [];
    if (availablePlaceholders.length === 0) {
      try {
        const parsed = JSON.parse(mockPayloadJson);
        availablePlaceholders = Object.keys(parsed);
      } catch (e) {
        availablePlaceholders = ['display_name', 'name', 'otp_code', 'position'];
      }
    }

    const payload = {
      name: templateName,
      category: templateCategory,
      subject_template: subjectTemplate,
      body_html_template: bodyHtmlTemplate,
      // Send sender_email_id (UUID FK) — null means "use platform default sender at send-time"
      sender_email_id: selectedSenderEmailId || null,
      reply_to_email: replyToEmail,
      available_placeholders: availablePlaceholders,
      is_active: templateActive,
      is_system_locked: templateSystemLocked,
    };
    if (!isEdit) payload.key = templateKey;

    try {
      const res = await apiFetch(endpoint, {
        method,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error?.message || data.message || 'Failed to save email template.');
        return;
      }

      alert(`Draft for template '${data.template.key}' saved successfully.`);
      setShowTemplateModal(false);
      resetTemplateForm();
      loadSubTabData('templates');
    } catch (err) {
      alert(err.message || 'Network error saving template.');
    } finally {
      setSubmitting(false);
    }
  };

  // Publish Draft → Live Template
  const handlePublishTemplate = async (key) => {
    if (!confirm(`Are you sure you want to publish the draft version of template '${key}'? This will make it live immediately.`)) return;
    try {
      const res = await apiFetch(`/admin/email/templates/${key}/publish`, {
        method: 'POST',
      });
      if (res.ok) {
        loadSubTabData('templates');
      } else {
        const data = await res.json();
        alert(data.error?.message || data.message || 'Failed to publish template');
      }
    } catch (err) {
      alert('Error publishing template');
    }
  };

  // Delete Template
  const handleDeleteTemplate = async (key) => {
    if (!confirm(`Are you sure you want to delete template '${key}'? This action cannot be undone.`)) return;
    try {
      const res = await apiFetch(`/admin/email/templates/${key}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        loadSubTabData('templates');
      } else {
        const data = await res.json();
        alert(data.error?.message || data.message || 'Failed to delete template');
      }
    } catch (err) {
      alert('Error deleting template');
    }
  };

  // Send Test Mail to Custom or Admin Email Address
  const handleSendTestMail = async (key) => {
    const defaultEmail = adminUser?.email || 'admin@codeplusacademy.in';
    const targetEmail = prompt(`Enter recipient email address to send test email for '${key}':`, defaultEmail);
    if (!targetEmail || !targetEmail.trim()) return;

    let parsedPayload = {};
    try {
      parsedPayload = JSON.parse(mockPayloadJson);
    } catch (e) {
      parsedPayload = { display_name: adminUser?.display_name || 'Admin', name: adminUser?.display_name || 'Admin' };
    }

    try {
      const res = await apiFetch(`/admin/email/templates/${key}/test-send`, {
        method: 'POST',
        body: JSON.stringify({
          recipient_email: targetEmail.trim(),
          payload: parsedPayload,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || `Test email sent successfully to ${targetEmail.trim()}!`);
      } else {
        alert(data.error?.message || data.message || 'Test send failed.');
      }
    } catch (err) {
      alert('Error sending test email');
    }
  };

  // Sender Email Handlers
  const handleCreateSender = async (e) => {
    e?.preventDefault();
    if (!newSenderEmail || !newSenderEmail.includes('@')) {
      alert('Please enter a valid email address.');
      return;
    }
    try {
      const res = await apiFetch('/admin/sender-emails', {
        method: 'POST',
        body: JSON.stringify({
          email: newSenderEmail.trim(),
          display_name: newSenderName.trim(),
          is_default: newSenderDefault,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowSenderModal(false);
        setNewSenderEmail('');
        setNewSenderName('');
        setNewSenderDefault(false);
        loadSubTabData('senders');
      } else {
        alert(data.error?.message || 'Failed to add sender email.');
      }
    } catch (err) {
      alert('Error adding sender email.');
    }
  };

  const handleSetDefaultSender = async (id) => {
    try {
      const res = await apiFetch(`/admin/sender-emails/${id}/set-default`, { method: 'POST' });
      if (res.ok) {
        loadSubTabData('senders');
      } else {
        const data = await res.json();
        alert(data.error?.message || 'Failed to set default sender.');
      }
    } catch (err) {
      alert('Error setting default sender.');
    }
  };

  const handleDeleteSender = async (id, email) => {
    if (!confirm(`Are you sure you want to delete sender address ${email}?`)) return;
    try {
      const res = await apiFetch(`/admin/sender-emails/${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadSubTabData('senders');
      } else {
        const data = await res.json();
        alert(data.error?.message || 'Failed to delete sender.');
      }
    } catch (err) {
      alert('Error deleting sender.');
    }
  };

  // Call Server-Side Handlebars Render Preview Endpoint
  const triggerServerSidePreview = async (subTpl, bodyTpl) => {
    setRenderingPreview(true);
    let parsedPayload = {};
    try {
      parsedPayload = JSON.parse(mockPayloadJson);
    } catch (e) {
      parsedPayload = { display_name: adminUser?.display_name || 'Admin', name: adminUser?.display_name || 'Admin' };
    }

    try {
      const res = await apiFetch('/admin/email/templates/render-preview', {
        method: 'POST',
        body: JSON.stringify({
          subject_template: subTpl || subjectTemplate,
          body_html_template: bodyTpl || bodyHtmlTemplate,
          payload: parsedPayload,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRenderedSubject(data.rendered_subject || '');
        setRenderedBodyHtml(data.rendered_body_html || '');
        setPreviewModalOpen(true);
      } else {
        alert(data.error?.message || 'Handlebars precompile error in template syntax.');
      }
    } catch (err) {
      alert('Error rendering preview on server');
    } finally {
      setRenderingPreview(false);
    }
  };

  const openCreateTemplateModal = () => {
    setEditingTemplate(null);
    resetTemplateForm();
    setShowTemplateModal(true);
  };

  const openEditTemplateModal = (tpl) => {
    setEditingTemplate(tpl);
    setTemplateKey(tpl.key);
    setTemplateName(tpl.name);
    setTemplateCategory(tpl.category);
    setSubjectTemplate(tpl.draft_subject_template || tpl.subject_template);
    setBodyHtmlTemplate(tpl.draft_body_html_template || tpl.body_html_template);
    // Pre-select the template's linked sender_email_id (null = platform default)
    setSelectedSenderEmailId(tpl.sender_email_id || null);
    setReplyToEmail(tpl.reply_to_email || 'support@codeplusacademy.in');
    setTemplateActive(tpl.is_active);
    setTemplateSystemLocked(tpl.is_system_locked || false);
    setShowTemplateModal(true);
  };

  const resetTemplateForm = () => {
    setTemplateKey('');
    setTemplateName('');
    setTemplateCategory('transactional');
    setSelectedSenderEmailId(null);
    setReplyToEmail('support@codeplusacademy.in');
    setSubjectTemplate('');
    setBodyHtmlTemplate('');
    setTemplateActive(true);
    setTemplateSystemLocked(false);
  };

  // Check if admin has email permissions or root access
  /*
   * NOTE: This client-side permission check is a UX convenience only to prevent displaying
   * an interactive studio form to unauthorized admins. The backend API route guards in
   * routes/email.js (e.g. requirePermission('email.templates.edit')) are the actual security
   * enforcement boundary.
   */
  const hasEmailPermission = adminUser?.is_root || (adminUser?.permissions || []).some(p => p.startsWith('email.'));

  if (loading) {
    return (
      <AdminShell title="Email System Studio" user={adminUser}>
        <div style={{ padding: '60px 20px', textAlign: 'center', color: tokens.colors.textMuted }}>Loading Email System Studio...</div>
      </AdminShell>
    );
  }

  if (!adminUser) {
    return (
      <AdminShell
        title="Email System Studio"
        subtitle="Authentication Required"
        currentRoute="/email"
        breadcrumb={['Communications', 'Email System']}
        user={null}
      >
        <div style={{ padding: '60px 20px', textAlign: 'center', backgroundColor: tokens.colors.surfaceElevated, borderRadius: '12px', border: `1px solid ${tokens.colors.borderSubtle}` }}>
          <Lock size={48} color="#f59e0b" style={{ marginBottom: '16px' }} />
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: tokens.colors.textPrimary, marginBottom: '8px' }}>Authentication Required</h2>
          <p style={{ fontSize: '14px', color: tokens.colors.textMuted, maxWidth: '480px', margin: '0 auto 20px auto' }}>
            You are not currently logged in to an active admin session. Please log in with your Root Admin credentials to access the Email System Studio.
          </p>
          <a href="/admin/auth/login" style={{ padding: '10px 20px', backgroundColor: '#6366f1', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontWeight: '600', fontSize: '13px', display: 'inline-block' }}>
            Go to Admin Login
          </a>
        </div>
      </AdminShell>
    );
  }

  if (!hasEmailPermission) {
    return (
      <AdminShell
        title="Email System Studio"
        subtitle="Access Restricted"
        currentRoute="/email"
        breadcrumb={['Communications', 'Email System']}
        user={adminUser}
      >
        <div style={{ padding: '60px 20px', textAlign: 'center', backgroundColor: tokens.colors.surfaceElevated, borderRadius: '12px', border: `1px solid ${tokens.colors.borderSubtle}` }}>
          <Lock size={48} color="#ef4444" style={{ marginBottom: '16px' }} />
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: tokens.colors.textPrimary, marginBottom: '8px' }}>403 — Access Restricted</h2>
          <p style={{ fontSize: '14px', color: tokens.colors.textMuted, maxWidth: '480px', margin: '0 auto' }}>
            Your admin account does not have permission to manage email templates or campaigns (<code style={{ color: '#818cf8' }}>email.templates.edit</code>). Please contact a Root Admin to request access.
          </p>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="Email System Studio"
      subtitle="Handlebars Email Compiler, Template Draft & Publish Engine, and Campaign Analytics"
      activeTab="email"
      currentRoute="/email"
      breadcrumb={['Communications', 'Email System']}
      user={adminUser}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '12px', borderBottom: `1px solid ${tokens.colors.borderSubtle}`, paddingBottom: '12px' }}>
          {[
            { id: 'templates', label: 'Email Templates', icon: Mail },
            { id: 'senders', label: 'Sender Addresses', icon: ShieldCheck },
            { id: 'schedules', label: 'Automated Schedules', icon: Calendar },
            { id: 'campaigns', label: 'Broadcast Campaigns', icon: Send },
            { id: 'analytics', label: 'Delivery Analytics', icon: PieChart }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: active ? tokens.colors.primary : 'transparent',
                  color: active ? '#FFFFFF' : tokens.colors.textMuted,
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab 1: Email Templates */}
        {activeSubTab === 'templates' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '700', color: tokens.colors.textPrimary, margin: 0 }}>System Email Templates</h2>
                <p style={{ fontSize: '13px', color: tokens.colors.textMuted, margin: '4px 0 0 0' }}>Manage Handlebars dynamic templates across Auth, Hiring, Support, and Social activity.</p>
              </div>
              <button
                onClick={openCreateTemplateModal}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  backgroundColor: tokens.colors.primary,
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                <Plus size={16} />
                Create Template
              </button>
            </div>

            <div style={{ backgroundColor: tokens.colors.surfaceElevated, border: `1px solid ${tokens.colors.borderSubtle}`, borderRadius: '12px', overflow: 'hidden' }}>
              {dataLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: tokens.colors.textMuted }}>Loading templates...</div>
              ) : templates.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: tokens.colors.textMuted }}>No email templates found in system database.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: tokens.colors.bgDark, borderBottom: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textMuted }}>
                      <th style={{ padding: '12px 16px' }}>Template Key & Name</th>
                      <th style={{ padding: '12px 16px' }}>Category</th>
                      <th style={{ padding: '12px 16px' }}>Sender & Reply-To Address</th>
                      <th style={{ padding: '12px 16px' }}>Subject Line</th>
                      <th style={{ padding: '12px 16px' }}>Version & Status</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map(tpl => (
                      <tr key={tpl.key} style={{ borderBottom: `1px solid ${tokens.colors.borderSubtle}` }}>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: '700', color: tokens.colors.textPrimary, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {tpl.name}
                            {tpl.is_system_locked && (
                              <span title="System Locked Template" style={{ color: '#f59e0b', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                <Lock size={12} /> System Locked
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', color: tokens.colors.textMuted, fontFamily: 'monospace' }}>{tpl.key}</div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ textTransform: 'capitalize', fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
                            {tpl.category}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: '11px', color: tokens.colors.textMuted }}>
                          <div><strong style={{ color: '#a5b4fc' }}>From:</strong> {tpl.draft_sender_email || tpl.sender_email || 'notifications@codeplusacademy.in'}</div>
                          <div><strong style={{ color: '#38bdf8' }}>Reply-To:</strong> {tpl.draft_reply_to_email || tpl.reply_to_email || 'support@codeplusacademy.in'}</div>
                        </td>
                        <td style={{ padding: '14px 16px', color: tokens.colors.textPrimary, maxWidth: '280px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {tpl.subject_template}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.08)', color: '#a5b4fc' }}>
                              v{tpl.version || 1}
                            </span>
                            <StatusPill status={tpl.is_active ? 'active' : 'inactive'} />
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button
                              onClick={() => triggerServerSidePreview(tpl.subject_template, tpl.body_html_template)}
                              style={{ padding: '6px 10px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.08)', border: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textPrimary, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                              title="Server-Side Preview"
                            >
                              <Eye size={14} /> Preview
                            </button>
                            <button
                              onClick={() => handleSendTestMail(tpl.key)}
                              style={{ padding: '6px 10px', borderRadius: '6px', backgroundColor: 'rgba(16, 185, 129, 0.15)', border: 'none', color: '#10b981', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}
                              title="Send Test Email to Admin"
                            >
                              <Send size={14} /> Test Send
                            </button>
                            <button
                              onClick={() => openEditTemplateModal(tpl)}
                              style={{ padding: '6px 10px', borderRadius: '6px', backgroundColor: tokens.colors.primary, border: 'none', color: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}
                            >
                              <Edit3 size={14} /> Edit Draft
                            </button>
                            <button
                              onClick={() => handlePublishTemplate(tpl.key)}
                              style={{ padding: '6px 10px', borderRadius: '6px', backgroundColor: '#6366f1', border: 'none', color: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '700' }}
                              title="Promote Draft to Live"
                            >
                              <Check size={14} /> Publish
                            </button>
                            {!tpl.is_system_locked && (
                              <button
                                onClick={() => handleDeleteTemplate(tpl.key)}
                                style={{ padding: '6px 10px', borderRadius: '6px', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Sender Email Management */}
        {activeSubTab === 'senders' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '700', color: tokens.colors.textPrimary, margin: 0 }}>Verified Sender Email Addresses</h2>
                <p style={{ fontSize: '13px', color: tokens.colors.textMuted, margin: '4px 0 0 0' }}>Configure default and per-template "From" email addresses.</p>
              </div>
              <button
                onClick={() => setShowSenderModal(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px',
                  backgroundColor: tokens.colors.primary, color: '#FFFFFF', border: 'none',
                  borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer'
                }}
              >
                <Plus size={16} /> Add Verified Sender
              </button>
            </div>

            <div style={{ backgroundColor: tokens.colors.surfaceElevated, borderRadius: '12px', border: `1px solid ${tokens.colors.borderSubtle}`, overflow: 'hidden' }}>
              {dataLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: tokens.colors.textMuted }}>Loading Sender Addresses...</div>
              ) : senderEmails.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: tokens.colors.textMuted }}>No sender email addresses configured.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderBottom: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textMuted, fontSize: '12px', fontWeight: '600' }}>
                      <th style={{ padding: '12px 16px' }}>Sender Email Address</th>
                      <th style={{ padding: '12px 16px' }}>Display Name</th>
                      <th style={{ padding: '12px 16px' }}>Role / Status</th>
                      <th style={{ padding: '12px 16px' }}>Verification Status</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {senderEmails.map((sender) => (
                      <tr key={sender.id} style={{ borderBottom: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textPrimary }}>
                        <td style={{ padding: '12px 16px', fontWeight: '700', color: '#38bdf8' }}>
                          {sender.email}
                        </td>
                        <td style={{ padding: '12px 16px', color: tokens.colors.textPrimary }}>
                          {sender.display_name || 'Code+ Academy'}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {sender.is_default ? (
                            <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
                              ⭐ SYSTEM DEFAULT
                            </span>
                          ) : (
                            <span style={{ fontSize: '12px', color: tokens.colors.textMuted }}>Custom Sender</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                            ✓ Verified Domain
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            {!sender.is_default && (
                              <button
                                onClick={() => handleSetDefaultSender(sender.id)}
                                style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#fbbf24', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                              >
                                ⭐ Set Default
                              </button>
                            )}
                            {!sender.is_default && (
                              <button
                                onClick={() => handleDeleteSender(sender.id, sender.email)}
                                style={{ padding: '6px 10px', borderRadius: '6px', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Delivery Analytics */}
        {activeSubTab === 'analytics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '700', color: tokens.colors.textPrimary, margin: 0 }}>Delivery Analytics & Send Logs</h2>
                <p style={{ fontSize: '13px', color: tokens.colors.textMuted, margin: '4px 0 0 0' }}>Real-time aggregate performance metrics and individual send history from the platform email pipeline.</p>
              </div>
              <button
                onClick={() => loadSubTabData('analytics')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  border: `1px solid ${tokens.colors.borderSubtle}`,
                  borderRadius: '8px',
                  color: tokens.colors.textPrimary,
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                <RefreshCw size={14} /> Refresh Analytics
              </button>
            </div>

            {/* Metric Overview Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
              <div style={{ backgroundColor: tokens.colors.surfaceElevated, border: `1px solid ${tokens.colors.borderSubtle}`, borderRadius: '10px', padding: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: tokens.colors.textMuted, marginBottom: '6px' }}>Total Sends</div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: tokens.colors.textPrimary }}>{analytics?.total_sends ?? 0}</div>
              </div>
              <div style={{ backgroundColor: tokens.colors.surfaceElevated, border: `1px solid ${tokens.colors.borderSubtle}`, borderRadius: '10px', padding: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: tokens.colors.textMuted, marginBottom: '6px' }}>Delivered / Sent</div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#10b981' }}>{analytics?.sent_count ?? 0}</div>
              </div>
              <div style={{ backgroundColor: tokens.colors.surfaceElevated, border: `1px solid ${tokens.colors.borderSubtle}`, borderRadius: '10px', padding: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: tokens.colors.textMuted, marginBottom: '6px' }}>Failed Sends</div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#ef4444' }}>{analytics?.failed_count ?? 0}</div>
              </div>
              <div style={{ backgroundColor: tokens.colors.surfaceElevated, border: `1px solid ${tokens.colors.borderSubtle}`, borderRadius: '10px', padding: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: tokens.colors.textMuted, marginBottom: '6px' }}>Bounced Sends</div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#f59e0b' }}>{analytics?.bounced_count ?? 0}</div>
              </div>
              <div style={{ backgroundColor: tokens.colors.surfaceElevated, border: `1px solid ${tokens.colors.borderSubtle}`, borderRadius: '10px', padding: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: tokens.colors.textMuted, marginBottom: '6px' }}>Open Rate</div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#818cf8' }}>
                  {analytics?.open_rate !== undefined ? `${Number(analytics.open_rate).toFixed(2)}%` : '0.00%'}
                </div>
              </div>
              <div style={{ backgroundColor: tokens.colors.surfaceElevated, border: `1px solid ${tokens.colors.borderSubtle}`, borderRadius: '10px', padding: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: tokens.colors.textMuted, marginBottom: '6px' }}>Click Rate</div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#38bdf8' }}>
                  {analytics?.click_rate !== undefined ? `${Number(analytics.click_rate).toFixed(2)}%` : '0.00%'}
                </div>
              </div>
            </div>

            {/* Individual Sends Log Table */}
            <div style={{ backgroundColor: tokens.colors.surfaceElevated, border: `1px solid ${tokens.colors.borderSubtle}`, borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: `1px solid ${tokens.colors.borderSubtle}`, fontWeight: '700', fontSize: '14px', color: tokens.colors.textPrimary }}>
                Individual Dispatch Log ({sends.length} records)
              </div>
              {dataLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: tokens.colors.textMuted }}>Loading send history...</div>
              ) : sends.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: tokens.colors.textMuted }}>No email dispatch events recorded yet.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: tokens.colors.bgDark, borderBottom: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textMuted }}>
                      <th style={{ padding: '12px 16px' }}>Recipient Email</th>
                      <th style={{ padding: '12px 16px' }}>Template Key</th>
                      <th style={{ padding: '12px 16px' }}>Subject Line</th>
                      <th style={{ padding: '12px 16px' }}>Status</th>
                      <th style={{ padding: '12px 16px' }}>Sent Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sends.map((s, idx) => (
                      <tr key={s.id || idx} style={{ borderBottom: `1px solid ${tokens.colors.borderSubtle}` }}>
                        <td style={{ padding: '12px 16px', fontWeight: '600', color: tokens.colors.textPrimary }}>
                          {s.recipient_email || s.recipient || 'N/A'}
                        </td>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#a5b4fc' }}>
                          {s.template_key}
                        </td>
                        <td style={{ padding: '12px 16px', color: tokens.colors.textSecondary, maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {s.subject || '—'}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <StatusPill status={s.status || 'sent'} />
                        </td>
                        <td style={{ padding: '12px 16px', color: tokens.colors.textMuted, fontSize: '12px' }}>
                          {s.sent_at ? new Date(s.sent_at).toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Template Create / Edit Modal */}
        {showTemplateModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div style={{ width: '100%', maxWidth: '720px', backgroundColor: tokens.colors.surfaceElevated, border: `1px solid ${tokens.colors.borderSubtle}`, borderRadius: '12px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: tokens.colors.textPrimary, margin: 0 }}>
                  {editingTemplate ? `Edit Template Draft (${templateKey})` : 'Create New Email Template'}
                </h3>
                <button onClick={() => setShowTemplateModal(false)} style={{ background: 'none', border: 'none', color: tokens.colors.textMuted, cursor: 'pointer' }}><X size={18} /></button>
              </div>

              <form onSubmit={handleSaveDraftTemplate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {!editingTemplate && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: tokens.colors.textMuted, marginBottom: '4px' }}>Template Key (Unique Identifier)</label>
                    <input type="text" required value={templateKey} onChange={(e) => setTemplateKey(e.target.value)} placeholder="e.g. welcome_user, hiring_offer_letter" style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: tokens.colors.bgDark, border: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textPrimary, fontSize: '13px' }} />
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: tokens.colors.textMuted, marginBottom: '4px' }}>Template Display Name</label>
                  <input type="text" required value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g. Hiring Offer Letter Template" style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: tokens.colors.bgDark, border: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textPrimary, fontSize: '13px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: tokens.colors.textMuted, marginBottom: '4px' }}>Category</label>
                  <select value={templateCategory} onChange={(e) => setTemplateCategory(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: tokens.colors.bgDark, border: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textPrimary, fontSize: '13px' }}>
                    <option value="transactional">Transactional</option>
                    <option value="security">Security / Auth</option>
                    <option value="hiring">Careers & Hiring</option>
                    <option value="support">Trust & Safety / Support</option>
                    <option value="social">Social Activity</option>
                    <option value="promotional">Promotional</option>
                  </select>
                  {/* Sender Email (From Header) — dynamically populated from sender_emails DB */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: tokens.colors.textMuted, marginBottom: '4px' }}>
                    Sender Email Address (From Header)
                    <span style={{ marginLeft: '6px', fontSize: '11px', color: '#a5b4fc' }}>
                      {selectedSenderEmailId ? '— Template-specific sender' : '— Using platform default ⭐'}
                    </span>
                  </label>
                  <select
                    value={selectedSenderEmailId || ''}
                    onChange={(e) => setSelectedSenderEmailId(e.target.value || null)}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: tokens.colors.bgDark, border: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textPrimary, fontSize: '13px' }}
                  >
                    <option value="">— Use Platform Default Sender ⭐ (Recommended)</option>
                    {senderEmails.map((se) => (
                      <option key={se.id} value={se.id}>
                        {se.display_name ? `${se.display_name} <${se.email}>` : se.email}
                        {se.is_default ? ' ⭐' : ''}
                      </option>
                    ))}
                  </select>
                </div>            </div>

                {/* Reply-To Email Header */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: tokens.colors.textMuted, marginBottom: '4px' }}>Reply-To Email Address (Where User Replies Go)</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      value={replyToEmail}
                      onChange={(e) => setReplyToEmail(e.target.value)}
                      style={{ flex: 1, padding: '8px', borderRadius: '6px', backgroundColor: tokens.colors.bgDark, border: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textPrimary, fontSize: '13px' }}
                    >
                      <option value="careers@codeplusacademy.in">Code+ Academy Careers &lt;careers@codeplusacademy.in&gt;</option>
                      <option value="support@codeplusacademy.in">Code+ Academy Support &lt;support@codeplusacademy.in&gt;</option>
                      <option value="security@codeplusacademy.in">Code+ Academy Security &lt;security@codeplusacademy.in&gt;</option>
                      <option value="safety@codeplusacademy.in">Code+ Academy Trust & Safety &lt;safety@codeplusacademy.in&gt;</option>
                      <option value="hr@codeplusacademy.in">Code+ Academy HR Team &lt;hr@codeplusacademy.in&gt;</option>
                      <option value={replyToEmail}>Custom: {replyToEmail}</option>
                    </select>
                    <input
                      type="text"
                      value={replyToEmail}
                      onChange={(e) => setReplyToEmail(e.target.value)}
                      placeholder="Custom reply-to email..."
                      style={{ width: '200px', padding: '8px', borderRadius: '6px', backgroundColor: tokens.colors.bgDark, border: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textPrimary, fontSize: '13px' }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                  <input
                    type="checkbox"
                    id="isSystemLocked"
                    checked={templateSystemLocked}
                    onChange={(e) => setTemplateSystemLocked(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: '#f59e0b', cursor: 'pointer' }}
                  />
                  <label htmlFor="isSystemLocked" style={{ fontSize: '12px', fontWeight: '600', color: '#f59e0b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', userSelect: 'none' }}>
                    🔒 Tag System Lock (Mark as core system template — restricts editing & deletion to Root Superadmins)
                  </label>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: tokens.colors.textMuted, marginBottom: '4px' }}>Subject Line (Handlebars Template)</label>
                  <input type="text" required value={subjectTemplate} onChange={(e) => setSubjectTemplate(e.target.value)} placeholder="Welcome to CPA, {{display_name}}!" style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: tokens.colors.bgDark, border: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textPrimary, fontSize: '13px' }} />
                </div>

                {/* Live Debounced Placeholder Scan & Mismatch Warning Badge */}
                <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: invalidFields.length > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.12)', border: `1px solid ${invalidFields.length > 0 ? '#ef4444' : '#10b981'}`, fontSize: '12px' }}>
                  <div style={{ fontWeight: '700', color: invalidFields.length > 0 ? '#f87171' : '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Detected Placeholder Fields: {detectedFields.length}</span>
                    {invalidFields.length > 0 && <span style={{ color: '#f87171', fontWeight: '800' }}>⚠️ Warning: {invalidFields.length} Unsupported Variable(s)</span>}
                  </div>
                  <div style={{ marginTop: '6px', color: tokens.colors.textMuted, fontSize: '11px', fontFamily: 'monospace', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {detectedFields.length === 0 ? (
                      <span style={{ fontStyle: 'italic', color: '#9ca3af' }}>No &#123;&#123; variable &#125;&#125; tags found in template text.</span>
                    ) : (
                      detectedFields.map(v => {
                        const isInvalid = invalidFields.includes(v);
                        return (
                          <span key={v} style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: isInvalid ? '#7f1d1d' : 'rgba(255,255,255,0.08)', color: isInvalid ? '#fca5a5' : '#a5b4fc', border: isInvalid ? '1px solid #ef4444' : 'none', fontWeight: isInvalid ? '700' : '400' }}>
                            {isInvalid ? `⚠️ {{ ${v} }}` : `{{ ${v} }}`}
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '12px', color: tokens.colors.textMuted }}>HTML Body (Handlebars Auto-Escaped XSS Safe)</label>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {['{{display_name}}', '{{otp_code}}', '{{position}}', '{{startdate}}', '{{friend_name}}', '{{#each suggested_friends}}', '{{#if condition}}'].map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setBodyHtmlTemplate(prev => `${prev} ${tag}`)}
                          style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(99, 102, 241, 0.2)', border: 'none', color: '#818cf8', fontSize: '11px', cursor: 'pointer', fontFamily: 'monospace' }}
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea required rows={8} value={bodyHtmlTemplate} onChange={(e) => setBodyHtmlTemplate(e.target.value)} placeholder="<div style='font-family: Arial;'><h2>Hello {{display_name}}</h2></div>" style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: tokens.colors.bgDark, border: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textPrimary, fontSize: '13px', resize: 'vertical', fontFamily: 'monospace' }} />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" onClick={() => triggerServerSidePreview(subjectTemplate, bodyHtmlTemplate)} style={{ flex: 1, padding: '10px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.08)', border: `1px solid ${tokens.colors.borderSubtle}`, color: '#FFFFFF', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                    {renderingPreview ? 'Compiling Preview...' : 'Live Handlebars Preview'}
                  </button>
                  <button type="submit" disabled={submitting} style={{ flex: 1, padding: '10px', borderRadius: '6px', backgroundColor: tokens.colors.primary, border: 'none', color: '#FFFFFF', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
                    {submitting ? 'Saving Draft...' : 'Save Draft Version'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Server-Side Handlebars Render Preview Modal Overlay */}
        {previewModalOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div style={{ width: '100%', maxWidth: '850px', backgroundColor: '#ffffff', color: '#111827', borderRadius: '12px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#111827', margin: 0 }}>Server-Side Handlebars Render Preview</h3>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>Subject: <strong>{renderedSubject}</strong></div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button onClick={() => setPreviewViewport('desktop')} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: previewViewport === 'desktop' ? '#3b82f6' : '#fff', color: previewViewport === 'desktop' ? '#fff' : '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                    <Monitor size={14} /> Desktop
                  </button>
                  <button onClick={() => setPreviewViewport('mobile')} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: previewViewport === 'mobile' ? '#3b82f6' : '#fff', color: previewViewport === 'mobile' ? '#fff' : '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                    <Smartphone size={14} /> Mobile (375px)
                  </button>
                  <button onClick={() => setPreviewModalOpen(false)} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}>Close</button>
                </div>
              </div>

              {/* Sandboxed Viewport Frame */}
              <div style={{ display: 'flex', justifyContent: 'center', backgroundColor: '#f3f4f6', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                <div style={{ width: previewViewport === 'mobile' ? '375px' : '100%', transition: 'all 0.3s ease', backgroundColor: '#ffffff', border: previewViewport === 'mobile' ? '1px solid #9ca3af' : 'none', borderRadius: '8px', padding: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                  <iframe
                    srcDoc={renderedBodyHtml}
                    title="Email Live Preview Sandbox"
                    sandbox="allow-same-origin"
                    style={{ width: '100%', minHeight: '380px', border: 'none', backgroundColor: '#ffffff' }}
                  />
                </div>
              </div>

              {/* JSON Mock Payload Inspector */}
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>Mock Payload JSON (Test Dynamic Placeholders):</label>
                <textarea
                  rows={4}
                  value={mockPayloadJson}
                  onChange={(e) => setMockPayloadJson(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontFamily: 'monospace', fontSize: '12px' }}
                />
                <button
                  onClick={() => triggerServerSidePreview(subjectTemplate, bodyHtmlTemplate)}
                  style={{ marginTop: '8px', padding: '6px 14px', borderRadius: '6px', backgroundColor: '#10b981', color: '#fff', border: 'none', fontWeight: '600', fontSize: '12px', cursor: 'pointer' }}
                >
                  Re-Render Preview with Updated Payload
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Add Sender Email Modal */}
        {showSenderModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <div style={{ backgroundColor: tokens.colors.surfaceElevated, border: `1px solid ${tokens.colors.borderSubtle}`, borderRadius: '12px', width: '100%', maxWidth: '480px', padding: '24px', color: tokens.colors.textPrimary }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: tokens.colors.textPrimary }}>Add Verified Sender Email Address</h3>
                <button onClick={() => setShowSenderModal(false)} style={{ background: 'none', border: 'none', color: tokens.colors.textMuted, cursor: 'pointer' }}><X size={18} /></button>
              </div>

              <form onSubmit={handleCreateSender} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: tokens.colors.textMuted, marginBottom: '4px' }}>Sender Email Address</label>
                  <input
                    type="email"
                    required
                    value={newSenderEmail}
                    onChange={(e) => setNewSenderEmail(e.target.value)}
                    placeholder="e.g. support@codeplusacademy.in"
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: tokens.colors.bgDark, border: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textPrimary, fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: tokens.colors.textMuted, marginBottom: '4px' }}>Display Name / Name</label>
                  <input
                    type="text"
                    value={newSenderName}
                    onChange={(e) => setNewSenderName(e.target.value)}
                    placeholder="e.g. Code+ Academy Support Team"
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: tokens.colors.bgDark, border: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textPrimary, fontSize: '13px' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', borderRadius: '6px', backgroundColor: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                  <input
                    type="checkbox"
                    id="newSenderDefault"
                    checked={newSenderDefault}
                    onChange={(e) => setNewSenderDefault(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <label htmlFor="newSenderDefault" style={{ fontSize: '12px', color: '#fbbf24', fontWeight: '600', cursor: 'pointer' }}>
                    Set as Platform System Default Sender Address ⭐
                  </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShowSenderModal(false)}
                    style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: 'transparent', border: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textMuted, cursor: 'pointer', fontSize: '13px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: tokens.colors.primary, border: 'none', color: '#fff', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}
                  >
                    Save Verified Sender
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
