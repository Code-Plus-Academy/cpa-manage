'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mail, Calendar, Send, PieChart, Plus, RefreshCw, Eye, Edit3, Check, X, Clock, Play
} from 'lucide-react';
import AdminShell from '../../components/shell/AdminShell';
import StatusPill from '../../components/ui/StatusPill';
import { tokens } from '../theme/tokens';

export default function StandaloneEmailPage() {
  const router = useRouter();
  const [adminUser, setAdminUser] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('templates'); // 'templates' | 'schedules' | 'campaigns' | 'analytics'
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  // Data states
  const [templates, setTemplates] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [sends, setSends] = useState([]);

  // Template Modal Form
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null); // null for create, template obj for edit
  const [templateKey, setTemplateKey] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateCategory, setTemplateCategory] = useState('transactional');
  const [subjectTemplate, setSubjectTemplate] = useState('');
  const [bodyHtmlTemplate, setBodyHtmlTemplate] = useState('');
  const [templateActive, setTemplateActive] = useState(true);

  // Campaign Modal Form
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [campaignTemplateKey, setCampaignTemplateKey] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_MANAGE_API_URL || 'http://localhost:4000';

  useEffect(() => {
    checkAuthStatus();
  }, []);

  useEffect(() => {
    if (adminUser) {
      loadSubTabData(activeSubTab);
    }
  }, [adminUser, activeSubTab]);

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

  const loadSubTabData = async (subTab) => {
    setDataLoading(true);
    try {
      if (subTab === 'templates') {
        const res = await fetch(`${apiUrl}/admin/email/templates`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setTemplates(data.templates || []);
        }
      } else if (subTab === 'schedules') {
        const res = await fetch(`${apiUrl}/admin/email/schedules`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setSchedules(data.schedules || []);
        }
      } else if (subTab === 'campaigns') {
        const res = await fetch(`${apiUrl}/admin/email/campaigns`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setCampaigns(data.campaigns || []);
        }
      } else if (subTab === 'analytics') {
        const [resAna, resSends] = await Promise.all([
          fetch(`${apiUrl}/admin/email/analytics`, { credentials: 'include' }),
          fetch(`${apiUrl}/admin/email/sends`, { credentials: 'include' })
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

  // Create or update template
  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const isEdit = !!editingTemplate;
    const url = isEdit
      ? `${apiUrl}/admin/email/templates/${editingTemplate.key}`
      : `${apiUrl}/admin/email/templates`;
    const method = isEdit ? 'PATCH' : 'POST';

    const payload = {
      name: templateName,
      category: templateCategory,
      subject_template: subjectTemplate,
      body_html_template: bodyHtmlTemplate,
      is_active: templateActive,
    };
    if (!isEdit) payload.key = templateKey;

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error?.message || data.message || 'Failed to save email template.');
        return;
      }

      alert(`Template '${data.template.key}' saved successfully.`);
      setShowTemplateModal(false);
      resetTemplateForm();
      loadSubTabData('templates');
    } catch (err) {
      alert(err.message || 'Network error saving template.');
    } finally {
      setSubmitting(false);
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
    setSubjectTemplate(tpl.subject_template);
    setBodyHtmlTemplate(tpl.body_html_template);
    setTemplateActive(tpl.is_active);
    setShowTemplateModal(true);
  };

  const resetTemplateForm = () => {
    setTemplateKey('');
    setTemplateName('');
    setTemplateCategory('transactional');
    setSubjectTemplate('');
    setBodyHtmlTemplate('');
    setTemplateActive(true);
  };

  // Campaign create & send-now
  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    if (!campaignTemplateKey) return;
    setSubmitting(true);

    try {
      const res = await fetch(`${apiUrl}/admin/email/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          template_key: campaignTemplateKey,
          segment_filter: {},
          status: 'draft',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error?.message || data.message || 'Failed to create campaign.');
        return;
      }

      alert('Campaign draft created successfully.');
      setShowCampaignModal(false);
      setCampaignTemplateKey('');
      loadSubTabData('campaigns');
    } catch (err) {
      alert(err.message || 'Error creating campaign.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendCampaignNow = async (campaignId) => {
    if (!confirm('Are you sure you want to trigger immediate sending for this campaign?')) return;
    try {
      const res = await fetch(`${apiUrl}/admin/email/campaigns/${campaignId}/send-now`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error?.message || data.message || 'Failed to trigger campaign send.');
        return;
      }
      alert('Campaign queued for immediate dispatch.');
      loadSubTabData('campaigns');
    } catch (err) {
      alert('Error triggering send-now.');
    }
  };

  return (
    <AdminShell
      adminUser={adminUser}
      activeTab="email"
      breadcrumb={['Communications', 'Email System']}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Header Title */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: tokens.typography.title.fontSize, fontWeight: tokens.typography.title.fontWeight, color: tokens.colors.textPrimary, margin: 0 }}>
              Email System & Broadcast Console
            </h1>
            <p style={{ fontSize: tokens.typography.small.fontSize, color: tokens.colors.textSecondary, margin: '4px 0 0 0' }}>
              Manage HTML templates, automated trigger schedules, promotional campaigns, and send analytics
            </p>
          </div>
          <button
            onClick={() => loadSubTabData(activeSubTab)}
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

        {/* Sub-Navigation Tabs */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: `1px solid ${tokens.colors.borderSubtle}`, paddingBottom: '12px' }}>
          {[
            { id: 'templates', label: 'Email Templates', icon: Mail },
            { id: 'schedules', label: 'Trigger Schedules', icon: Calendar },
            { id: 'campaigns', label: 'Broadcast Campaigns', icon: Send },
            { id: 'analytics', label: 'Delivery Analytics', icon: PieChart },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
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
                  backgroundColor: isActive ? tokens.colors.primary : 'transparent',
                  color: isActive ? '#FFFFFF' : tokens.colors.textSecondary,
                  fontSize: '13px',
                  fontWeight: isActive ? '700' : '500',
                  cursor: 'pointer',
                }}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* SUB-TAB 1: TEMPLATES */}
        {activeSubTab === 'templates' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: tokens.colors.textSecondary }}>System Email Templates</span>
              <button
                onClick={openCreateTemplateModal}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '6px',
                  backgroundColor: tokens.colors.primary,
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                <Plus size={14} /> New Template
              </button>
            </div>

            <div style={{ borderRadius: '10px', backgroundColor: tokens.colors.surfaceElevated, border: `1px solid ${tokens.colors.borderSubtle}`, overflow: 'hidden' }}>
              {dataLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: tokens.colors.textMuted }}>Loading templates...</div>
              ) : templates.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: tokens.colors.textMuted }}>No email templates found. Create one to get started.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${tokens.colors.borderSubtle}`, backgroundColor: 'rgba(15, 23, 42, 0.4)', color: tokens.colors.textMuted }}>
                      <th style={{ padding: '12px 16px' }}>KEY</th>
                      <th style={{ padding: '12px 16px' }}>NAME</th>
                      <th style={{ padding: '12px 16px' }}>CATEGORY</th>
                      <th style={{ padding: '12px 16px' }}>SUBJECT TEMPLATE</th>
                      <th style={{ padding: '12px 16px' }}>VERSION</th>
                      <th style={{ padding: '12px 16px' }}>STATUS</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map(t => (
                      <tr key={t.id} style={{ borderBottom: `1px solid ${tokens.colors.borderSubtle}` }}>
                        <td style={{ padding: '12px 16px', fontFamily: tokens.typography.mono.fontFamily, fontWeight: '700', color: tokens.colors.primary }}>{t.key}</td>
                        <td style={{ padding: '12px 16px', fontWeight: '600', color: tokens.colors.textPrimary }}>{t.name}</td>
                        <td style={{ padding: '12px 16px', textTransform: 'capitalize', color: tokens.colors.textSecondary }}>{t.category}</td>
                        <td style={{ padding: '12px 16px', color: tokens.colors.textSecondary }}>{t.subject_template}</td>
                        <td style={{ padding: '12px 16px' }}>v{t.version}</td>
                        <td style={{ padding: '12px 16px' }}><StatusPill status={t.is_active ? 'approved' : 'dismissed'} /></td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <button
                            onClick={() => openEditTemplateModal(t)}
                            style={{ padding: '4px 10px', borderRadius: '6px', backgroundColor: tokens.colors.bgDark, border: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textPrimary, fontSize: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Edit3 size={12} /> Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* SUB-TAB 2: SCHEDULES */}
        {activeSubTab === 'schedules' && (
          <div style={{ borderRadius: '10px', backgroundColor: tokens.colors.surfaceElevated, border: `1px solid ${tokens.colors.borderSubtle}`, overflow: 'hidden' }}>
            {dataLoading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: tokens.colors.textMuted }}>Loading schedules...</div>
            ) : schedules.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: tokens.colors.textMuted }}>No trigger schedules configured.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${tokens.colors.borderSubtle}`, backgroundColor: 'rgba(15, 23, 42, 0.4)', color: tokens.colors.textMuted }}>
                    <th style={{ padding: '12px 16px' }}>TEMPLATE KEY</th>
                    <th style={{ padding: '12px 16px' }}>TRIGGER TYPE</th>
                    <th style={{ padding: '12px 16px' }}>FREQUENCY KIND</th>
                    <th style={{ padding: '12px 16px' }}>INTERVAL / CRON</th>
                    <th style={{ padding: '12px 16px' }}>RANDOM WINDOW</th>
                    <th style={{ padding: '12px 16px' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map(s => (
                    <tr key={s.id} style={{ borderBottom: `1px solid ${tokens.colors.borderSubtle}` }}>
                      <td style={{ padding: '12px 16px', fontFamily: tokens.typography.mono.fontFamily, fontWeight: '700', color: tokens.colors.primary }}>{s.template_key}</td>
                      <td style={{ padding: '12px 16px', textTransform: 'uppercase', fontSize: '11px', fontWeight: '700', color: '#60A5FA' }}>{s.trigger_type}</td>
                      <td style={{ padding: '12px 16px', textTransform: 'capitalize', color: tokens.colors.textSecondary }}>{s.frequency_kind}</td>
                      <td style={{ padding: '12px 16px', fontFamily: tokens.typography.mono.fontFamily }}>
                        {s.cron_expression ? `Cron: ${s.cron_expression}` : s.interval_value ? `${s.interval_value} ${s.interval_unit}` : 'Event-Driven'}
                      </td>
                      <td style={{ padding: '12px 16px', color: tokens.colors.textMuted }}>±{s.randomize_window_minutes || 0} mins</td>
                      <td style={{ padding: '12px 16px' }}><StatusPill status={s.is_active ? 'approved' : 'dismissed'} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* SUB-TAB 3: CAMPAIGNS */}
        {activeSubTab === 'campaigns' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: tokens.colors.textSecondary }}>Promotional & Announcement Campaigns</span>
              <button
                onClick={() => { setCampaignTemplateKey(templates[0]?.key || ''); setShowCampaignModal(true); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '6px', backgroundColor: tokens.colors.primary, border: 'none', color: '#FFFFFF', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
              >
                <Plus size={14} /> Create Campaign
              </button>
            </div>

            <div style={{ borderRadius: '10px', backgroundColor: tokens.colors.surfaceElevated, border: `1px solid ${tokens.colors.borderSubtle}`, overflow: 'hidden' }}>
              {dataLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: tokens.colors.textMuted }}>Loading campaigns...</div>
              ) : campaigns.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: tokens.colors.textMuted }}>No campaigns created.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${tokens.colors.borderSubtle}`, backgroundColor: 'rgba(15, 23, 42, 0.4)', color: tokens.colors.textMuted }}>
                      <th style={{ padding: '12px 16px' }}>CAMPAIGN ID</th>
                      <th style={{ padding: '12px 16px' }}>TEMPLATE KEY</th>
                      <th style={{ padding: '12px 16px' }}>STATUS</th>
                      <th style={{ padding: '12px 16px' }}>SCHEDULED AT</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map(c => (
                      <tr key={c.id} style={{ borderBottom: `1px solid ${tokens.colors.borderSubtle}` }}>
                        <td style={{ padding: '12px 16px', fontFamily: tokens.typography.mono.fontFamily }}>{c.id}</td>
                        <td style={{ padding: '12px 16px', fontWeight: '700', color: tokens.colors.primary }}>{c.template_key}</td>
                        <td style={{ padding: '12px 16px' }}><StatusPill status={c.status} /></td>
                        <td style={{ padding: '12px 16px', color: tokens.colors.textMuted }}>{c.scheduled_at ? new Date(c.scheduled_at).toLocaleString() : 'Not Scheduled'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          {c.status === 'draft' && (
                            <button
                              onClick={() => handleSendCampaignNow(c.id)}
                              style={{ padding: '5px 10px', borderRadius: '6px', backgroundColor: tokens.colors.primary, border: 'none', color: '#FFFFFF', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Play size={12} /> Send Now
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* SUB-TAB 4: ANALYTICS */}
        {activeSubTab === 'analytics' && analytics && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Metric Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
              <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: tokens.colors.surfaceElevated, border: `1px solid ${tokens.colors.borderSubtle}` }}>
                <span style={{ fontSize: '11px', color: tokens.colors.textMuted, textTransform: 'uppercase', fontWeight: '700' }}>Total Sends</span>
                <h2 style={{ fontSize: '24px', fontWeight: '800', color: tokens.colors.textPrimary, margin: '6px 0 0 0' }}>{analytics.total_sends}</h2>
              </div>
              <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: tokens.colors.surfaceElevated, border: `1px solid ${tokens.colors.borderSubtle}` }}>
                <span style={{ fontSize: '11px', color: tokens.colors.textMuted, textTransform: 'uppercase', fontWeight: '700' }}>Open Rate</span>
                <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#34D399', margin: '6px 0 0 0' }}>{analytics.open_rate}%</h2>
              </div>
              <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: tokens.colors.surfaceElevated, border: `1px solid ${tokens.colors.borderSubtle}` }}>
                <span style={{ fontSize: '11px', color: tokens.colors.textMuted, textTransform: 'uppercase', fontWeight: '700' }}>Click Rate</span>
                <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#60A5FA', margin: '6px 0 0 0' }}>{analytics.click_rate}%</h2>
              </div>
              <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: tokens.colors.surfaceElevated, border: `1px solid ${tokens.colors.borderSubtle}` }}>
                <span style={{ fontSize: '11px', color: tokens.colors.textMuted, textTransform: 'uppercase', fontWeight: '700' }}>Bounced / Failed</span>
                <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#F87171', margin: '6px 0 0 0' }}>{analytics.bounced_count + analytics.failed_count}</h2>
              </div>
            </div>

            {/* Sends Log Table */}
            <div style={{ borderRadius: '10px', backgroundColor: tokens.colors.surfaceElevated, border: `1px solid ${tokens.colors.borderSubtle}`, overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: `1px solid ${tokens.colors.borderSubtle}`, fontWeight: '700', fontSize: '13px', color: tokens.colors.textPrimary }}>
                Recent Email Dispatch Log
              </div>
              {sends.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: tokens.colors.textMuted }}>No email dispatches recorded yet.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${tokens.colors.borderSubtle}`, backgroundColor: 'rgba(15, 23, 42, 0.4)', color: tokens.colors.textMuted }}>
                      <th style={{ padding: '10px 16px' }}>SEND ID</th>
                      <th style={{ padding: '10px 16px' }}>USER ID</th>
                      <th style={{ padding: '10px 16px' }}>TEMPLATE</th>
                      <th style={{ padding: '10px 16px' }}>STATUS</th>
                      <th style={{ padding: '10px 16px' }}>DISPATCHED AT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sends.map(s => (
                      <tr key={s.id} style={{ borderBottom: `1px solid ${tokens.colors.borderSubtle}` }}>
                        <td style={{ padding: '10px 16px', fontFamily: tokens.typography.mono.fontFamily }}>{s.id}</td>
                        <td style={{ padding: '10px 16px', color: tokens.colors.textSecondary }}>{s.user_id || 'System'}</td>
                        <td style={{ padding: '10px 16px', fontWeight: '600', color: tokens.colors.primary }}>{s.template_key}</td>
                        <td style={{ padding: '10px 16px' }}><StatusPill status={s.status} /></td>
                        <td style={{ padding: '10px 16px', color: tokens.colors.textMuted }}>{s.sent_at ? new Date(s.sent_at).toLocaleString() : 'Queued'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Template Modal */}
        {showTemplateModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div style={{ width: '100%', maxWidth: '640px', backgroundColor: tokens.colors.surfaceElevated, border: `1px solid ${tokens.colors.borderSubtle}`, borderRadius: '12px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: tokens.colors.textPrimary, margin: 0 }}>
                  {editingTemplate ? 'Edit Email Template' : 'Create Email Template'}
                </h3>
                <button onClick={() => setShowTemplateModal(false)} style={{ background: 'none', border: 'none', color: tokens.colors.textMuted, cursor: 'pointer' }}><X size={18} /></button>
              </div>

              <form onSubmit={handleSaveTemplate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {!editingTemplate && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: tokens.colors.textMuted, marginBottom: '4px' }}>Template Key (Unique Identifier)</label>
                    <input type="text" required value={templateKey} onChange={(e) => setTemplateKey(e.target.value)} placeholder="e.g. welcome_user, pass_reset" style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: tokens.colors.bgDark, border: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textPrimary, fontSize: '13px' }} />
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: tokens.colors.textMuted, marginBottom: '4px' }}>Template Display Name</label>
                  <input type="text" required value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g. Welcome Onboarding Email" style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: tokens.colors.bgDark, border: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textPrimary, fontSize: '13px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: tokens.colors.textMuted, marginBottom: '4px' }}>Category</label>
                  <select value={templateCategory} onChange={(e) => setTemplateCategory(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: tokens.colors.bgDark, border: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textPrimary, fontSize: '13px' }}>
                    <option value="transactional">Transactional</option>
                    <option value="security">Security</option>
                    <option value="promotional">Promotional</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: tokens.colors.textMuted, marginBottom: '4px' }}>Subject Line Template</label>
                  <input type="text" required value={subjectTemplate} onChange={(e) => setSubjectTemplate(e.target.value)} placeholder="Welcome to CPA, {{user_name}}!" style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: tokens.colors.bgDark, border: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textPrimary, fontSize: '13px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: tokens.colors.textMuted, marginBottom: '4px' }}>HTML Body Template</label>
                  <textarea required rows={5} value={bodyHtmlTemplate} onChange={(e) => setBodyHtmlTemplate(e.target.value)} placeholder="<h1>Welcome {{user_name}}</h1><p>Thank you for joining Code Plus Academy.</p>" style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: tokens.colors.bgDark, border: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textPrimary, fontSize: '13px', resize: 'vertical' }} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: tokens.colors.textPrimary, cursor: 'pointer' }}>
                  <input type="checkbox" checked={templateActive} onChange={(e) => setTemplateActive(e.target.checked)} />
                  <span>Is Active</span>
                </label>
                <button type="submit" disabled={submitting} style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: tokens.colors.primary, border: 'none', color: '#FFFFFF', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
                  {submitting ? 'Saving Template...' : 'Save Email Template'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Campaign Modal */}
        {showCampaignModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div style={{ width: '100%', maxWidth: '480px', backgroundColor: tokens.colors.surfaceElevated, border: `1px solid ${tokens.colors.borderSubtle}`, borderRadius: '12px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: tokens.colors.textPrimary, margin: 0 }}>Create Broadcast Campaign</h3>
                <button onClick={() => setShowCampaignModal(false)} style={{ background: 'none', border: 'none', color: tokens.colors.textMuted, cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <form onSubmit={handleCreateCampaign} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: tokens.colors.textMuted, marginBottom: '4px' }}>Select Email Template</label>
                  <select value={campaignTemplateKey} onChange={(e) => setCampaignTemplateKey(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: tokens.colors.bgDark, border: `1px solid ${tokens.colors.borderSubtle}`, color: tokens.colors.textPrimary, fontSize: '13px' }}>
                    {templates.map(t => <option key={t.key} value={t.key}>{t.name} ({t.key})</option>)}
                  </select>
                </div>
                <button type="submit" disabled={submitting} style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: tokens.colors.primary, border: 'none', color: '#FFFFFF', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
                  {submitting ? 'Creating Campaign...' : 'Save Campaign Draft'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
