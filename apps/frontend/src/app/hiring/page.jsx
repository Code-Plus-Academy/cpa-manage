'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AdminShell from '../../components/shell/AdminShell';
import { apiFetch } from '../../lib/apiClient';
import {
  Briefcase, Users, CheckCircle2, Clock, XCircle, Search, Filter, Plus,
  Sparkles, FileText, Send, Eye, Copy, Archive, ArrowRight, ShieldCheck, Mail, BarChart3, Settings, Play, RefreshCw, FileCheck, Layers
} from 'lucide-react';

export default function HiringAdminDashboard() {
  const [activeSubTab, setActiveSubTab] = useState('kanban'); // kanban | positions | templates | documents | settings | analytics
  const [positions, setPositions] = useState([]);
  const [applications, setApplications] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [settings, setSettings] = useState({});
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPositionFilter, setSelectedPositionFilter] = useState('ALL');

  // Modal States
  const [showPosModal, setShowPosModal] = useState(false);
  const [editingPos, setEditingPos] = useState(null);
  const [posForm, setPosForm] = useState({
    title: '', department: 'Engineering', type: 'intern', status: 'open',
    description: '', openings: 1, location: 'remote', salary_range: '',
    requirements: '', responsibilities: '', auto_response_enabled: true
  });

  // Template Modal States
  const [showTplModal, setShowTplModal] = useState(false);
  const [editingTpl, setEditingTpl] = useState(null);
  const [tplForm, setTplForm] = useState({
    title: '', type: 'offer_letter', html_content: '', is_active: true
  });
  const [tplPreviewHtml, setTplPreviewHtml] = useState('');

  const [settingsForm, setSettingsForm] = useState({
    company_logo_url: '', letterhead_header_html: '', signature_image_url: '', default_sender_email: '', default_sender_name: ''
  });
  const [savingSettings, setSavingSettings] = useState(false);

  const [bulkSelected, setBulkSelected] = useState([]);
  const [bulkRejectReason, setBulkRejectReason] = useState('');
  const [showBulkRejectModal, setShowBulkRejectModal] = useState(false);

  const [positionAnalytics, setPositionAnalytics] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [posRes, appRes, tplRes, docRes, setRes, anaRes, posAnaRes] = await Promise.all([
        apiFetch('/admin/hiring/positions').then((r) => r.ok ? r.json() : { positions: [] }),
        apiFetch('/admin/hiring/applications').then((r) => r.ok ? r.json() : { applications: [] }),
        apiFetch('/admin/hiring/templates').then((r) => r.ok ? r.json() : { templates: [] }),
        apiFetch('/admin/hiring/documents').then((r) => r.ok ? r.json() : { documents: [] }),
        apiFetch('/admin/hiring/settings').then((r) => r.ok ? r.json() : { settings: {} }),
        apiFetch('/admin/hiring/analytics/overview').then((r) => r.ok ? r.json() : null),
        apiFetch('/admin/hiring/analytics/position-wise').then((r) => r.ok ? r.json() : { position_analytics: [] }),
      ]);

      setPositions(posRes.positions || []);
      setApplications(appRes.applications || []);
      setTemplates(tplRes.templates || []);
      setDocuments(docRes.documents || []);
      const setObj = setRes.settings || {};
      setSettings(setObj);
      setSettingsForm({
        company_logo_url: setObj.company_logo_url || '',
        letterhead_header_html: setObj.letterhead_header_html || '',
        signature_image_url: setObj.signature_image_url || '',
        default_sender_email: setObj.default_sender_email || '',
        default_sender_name: setObj.default_sender_name || '',
      });
      setAnalytics(anaRes || null);
      setPositionAnalytics(posAnaRes.position_analytics || []);
    } catch (err) {
      console.error('Failed to load hiring dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrUpdatePosition = async (e) => {
    e.preventDefault();
    try {
      const url = editingPos ? `/admin/hiring/positions/${editingPos.id}` : '/admin/hiring/positions';
      const method = editingPos ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(posForm),
      });

      if (res.ok) {
        setShowPosModal(false);
        setEditingPos(null);
        fetchDashboardData();
      }
    } catch (err) {
      console.error('Failed to save position:', err);
    }
  };

  const handleDeletePosition = async (id) => {
    if (!confirm('Are you sure you want to permanently delete this position? This action cannot be undone.')) return;
    try {
      const res = await apiFetch(`/admin/hiring/positions/${id}`, { method: 'DELETE' });
      if (res.ok) fetchDashboardData();
    } catch (err) {
      console.error('Failed to delete position:', err);
    }
  };

  const handleImportDefaultSettings = async () => {
    try {
      const res = await apiFetch('/admin/hiring/settings/import-defaults', { method: 'POST' });
      if (res.ok) {
        alert('Branding settings reset to system defaults from .env');
        fetchDashboardData();
      }
    } catch (err) {
      console.error('Failed to import default settings:', err);
    }
  };

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    try {
      const url = editingTpl ? `/admin/hiring/templates/${editingTpl.id}` : '/admin/hiring/templates';
      const method = editingTpl ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tplForm),
      });

      if (res.ok) {
        setShowTplModal(false);
        setEditingTpl(null);
        fetchDashboardData();
      }
    } catch (err) {
      console.error('Failed to save template:', err);
    }
  };

  const handlePreviewTemplate = async (tplId) => {
    try {
      const res = await apiFetch(`/admin/hiring/templates/${tplId}/preview`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setTplPreviewHtml(data.rendered_html);
      }
    } catch (err) {
      console.error('Failed to preview template:', err);
    }
  };

  const handleDuplicatePosition = async (id) => {
    try {
      const res = await apiFetch(`/admin/hiring/positions/${id}/duplicate`, { method: 'POST' });
      if (res.ok) fetchDashboardData();
    } catch (err) {
      console.error('Failed to duplicate position:', err);
    }
  };

  const handleArchivePosition = async (id) => {
    if (!confirm('Are you sure you want to close/archive this position?')) return;
    try {
      const res = await apiFetch(`/admin/hiring/positions/${id}/archive`, { method: 'PATCH' });
      if (res.ok) fetchDashboardData();
    } catch (err) {
      console.error('Failed to archive position:', err);
    }
  };

  const handleStatusChange = async (appId, newStatus) => {
    try {
      const res = await apiFetch(`/admin/hiring/applications/${appId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setApplications((prev) =>
          prev.map((a) => (a.id === appId ? { ...a, status: newStatus } : a))
        );
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleBulkReject = async () => {
    if (bulkSelected.length === 0) return;
    try {
      const res = await apiFetch('/admin/hiring/applications/bulk-reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_ids: bulkSelected, rejection_reason: bulkRejectReason }),
      });
      if (res.ok) {
        setShowBulkRejectModal(false);
        setBulkSelected([]);
        fetchDashboardData();
      }
    } catch (err) {
      console.error('Failed bulk rejection:', err);
    }
  };

  const handleResendDocument = async (docId) => {
    try {
      const res = await apiFetch(`/admin/hiring/documents/${docId}/resend`, { method: 'POST' });
      if (res.ok) {
        alert('Document resent with incremented version!');
        fetchDashboardData();
      }
    } catch (err) {
      console.error('Failed to resend document:', err);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      setSavingSettings(true);
      const res = await apiFetch('/admin/hiring/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsForm),
      });
      if (res.ok) {
        alert('Branding & Email settings updated!');
        fetchDashboardData();
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSavingSettings(false);
    }
  };

  const filteredApps = applications.filter((a) => {
    const matchesPos = selectedPositionFilter === 'ALL' || a.position_id === selectedPositionFilter;
    const matchesSearch =
      (a.candidate_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.candidate_email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.position_title || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesPos && matchesSearch;
  });

  const kanbanColumns = [
    { id: 'applied', label: 'Applied', color: '#6366f1' },
    { id: 'in_review', label: 'In Review', color: '#f59e0b' },
    { id: 'interview', label: 'Interview', color: '#3b82f6' },
    { id: 'approved', label: 'Approved', color: '#10b981' },
    { id: 'rejected', label: 'Rejected', color: '#ef4444' },
  ];

  return (
    <AdminShell activeTab="hiring">
      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', color: '#f3f4f6' }}>
        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '800', margin: '0 0 6px 0', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Briefcase style={{ color: '#6366f1' }} /> Careers &amp; Candidate Pipeline
            </h1>
            <p style={{ margin: 0, color: '#9ca3af', fontSize: '14px' }}>
              Manage job postings, applicant Kanban pipeline, offer/certificate templates, document versioning, and email settings.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => {
                setEditingPos(null);
                setPosForm({
                  title: '', department: 'Engineering', type: 'intern', status: 'open',
                  description: '', openings: 1, location: 'remote', salary_range: '',
                  requirements: '', responsibilities: '', auto_response_enabled: true
                });
                setShowPosModal(true);
              }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 18px',
                borderRadius: '8px', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                color: '#ffffff', fontWeight: '600', border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)'
              }}
            >
              <Plus size={16} /> Create New Position
            </button>

            <button
              onClick={() => {
                setEditingTpl(null);
                setTplForm({ title: '', type: 'certificate', html_content: '<div style="padding:40px; text-align:center;"><h1>CERTIFICATE OF COMPLETION</h1><p>Awarded to {{candidate_name}}</p></div>', is_active: true });
                setShowTplModal(true);
              }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 18px',
                borderRadius: '8px', background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#ffffff', fontWeight: '600', cursor: 'pointer'
              }}
            >
              <Plus size={16} /> Add Document Template
            </button>
          </div>
        </div>

        {/* Overview Analytics Cards */}
        {analytics && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: 'rgba(18, 20, 29, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '18px' }}>
              <div style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '700', textTransform: 'uppercase' }}>Open Positions</div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: '#ffffff', marginTop: '6px' }}>{analytics.open_positions}</div>
            </div>

            <div style={{ background: 'rgba(18, 20, 29, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '18px' }}>
              <div style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '700', textTransform: 'uppercase' }}>Total Applications</div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: '#ffffff', marginTop: '6px' }}>{analytics.total_applications}</div>
            </div>

            <div style={{ background: 'rgba(18, 20, 29, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '18px' }}>
              <div style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '700', textTransform: 'uppercase' }}>Pending Review</div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: '#f59e0b', marginTop: '6px' }}>{analytics.pending_review}</div>
            </div>

            <div style={{ background: 'rgba(18, 20, 29, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '18px' }}>
              <div style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '700', textTransform: 'uppercase' }}>Approved This Month</div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: '#10b981', marginTop: '6px' }}>{analytics.approved_this_month}</div>
            </div>
          </div>
        )}

        {/* Sub-Tab Control Bar */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '20px', paddingBottom: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'kanban', label: 'Pipeline Kanban', icon: Users },
            { id: 'positions', label: 'Position Management', icon: Briefcase },
            { id: 'templates', label: 'Document Templates', icon: Layers },
            { id: 'documents', label: 'Generated Documents Log', icon: FileText },
            { id: 'settings', label: 'Branding & Settings', icon: Settings },
            { id: 'analytics', label: 'Funnel & Analytics', icon: BarChart3 },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
                  borderRadius: '6px', border: 'none', background: active ? '#6366f1' : 'transparent',
                  color: active ? '#ffffff' : '#9ca3af', fontWeight: '600', fontSize: '13px', cursor: 'pointer'
                }}
              >
                <Icon size={16} /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* MODULE 2: PIPELINE KANBAN VIEW */}
        {activeSubTab === 'kanban' && (
          <div>
            {/* Filter Bar */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 18rem', position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
                <input
                  type="text"
                  placeholder="Search candidate by name, email, or role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 12px 8px 36px', borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.1)', background: 'rgba(10, 11, 16, 0.6)',
                    color: '#ffffff', fontSize: '13px', outline: 'none'
                  }}
                />
              </div>

              <select
                value={selectedPositionFilter}
                onChange={(e) => setSelectedPositionFilter(e.target.value)}
                style={{
                  padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(10, 11, 16, 0.6)', color: '#ffffff', fontSize: '13px'
                }}
              >
                <option value="ALL">All Positions</option>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>

              {bulkSelected.length > 0 && (
                <button
                  onClick={() => setShowBulkRejectModal(true)}
                  style={{
                    padding: '8px 14px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171', fontWeight: '600', fontSize: '13px', cursor: 'pointer'
                  }}
                >
                  Bulk Reject ({bulkSelected.length})
                </button>
              )}
            </div>

            {/* Kanban Columns Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', overflowX: 'auto', minHeight: '550px' }}>
              {kanbanColumns.map((col) => {
                const colApps = filteredApps.filter((a) => (a.status || 'applied').toLowerCase() === col.id);
                return (
                  <div key={col.id} style={{ background: 'rgba(18, 20, 29, 0.5)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: `2px solid ${col.color}`, paddingBottom: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#ffffff' }}>{col.label}</span>
                      <span style={{ fontSize: '11px', background: 'rgba(255, 255, 255, 0.08)', padding: '2px 8px', borderRadius: '9999px', fontWeight: '700' }}>{colApps.length}</span>
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {colApps.map((app) => (
                        <div
                          key={app.id}
                          style={{
                            background: 'rgba(10, 11, 16, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '10px', padding: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <input
                              type="checkbox"
                              checked={bulkSelected.includes(app.id)}
                              onChange={(e) => {
                                if (e.target.checked) setBulkSelected([...bulkSelected, app.id]);
                                else setBulkSelected(bulkSelected.filter((i) => i !== app.id));
                              }}
                            />
                            <select
                              value={app.status || 'applied'}
                              onChange={(e) => handleStatusChange(app.id, e.target.value)}
                              style={{ background: 'transparent', border: 'none', color: '#9ca3af', fontSize: '11px', cursor: 'pointer' }}
                            >
                              <option value="applied">Applied</option>
                              <option value="in_review">In Review</option>
                              <option value="interview">Interview</option>
                              <option value="approved">Approved</option>
                              <option value="rejected">Rejected</option>
                            </select>
                          </div>

                          <div style={{ fontWeight: '700', fontSize: '14px', color: '#ffffff', marginTop: '6px' }}>{app.candidate_name}</div>
                          <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>{app.candidate_email}</div>
                          <div style={{ fontSize: '11px', color: '#818cf8', fontWeight: '600', marginTop: '8px' }}>{app.position_title}</div>

                          <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '10px', color: '#6b7280' }}>{new Date(app.applied_at).toLocaleDateString()}</span>
                            <Link href={`/hiring/${app.id}`} style={{ fontSize: '11px', color: '#6366f1', textDecoration: 'none', fontWeight: '600' }}>
                              Review Details →
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* MODULE 1: POSITION MANAGEMENT TABLE */}
        {activeSubTab === 'positions' && (
          <div style={{ background: 'rgba(18, 20, 29, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'rgba(10, 11, 16, 0.8)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#9ca3af' }}>
                  <th style={{ padding: '12px 16px' }}>ROLE TITLE</th>
                  <th style={{ padding: '12px 16px' }}>DEPARTMENT</th>
                  <th style={{ padding: '12px 16px' }}>TYPE</th>
                  <th style={{ padding: '12px 16px' }}>STATUS</th>
                  <th style={{ padding: '12px 16px' }}>APPLICANTS</th>
                  <th style={{ padding: '12px 16px' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '14px 16px', fontWeight: '700', color: '#ffffff' }}>{p.title}</td>
                    <td style={{ padding: '14px 16px', color: '#9ca3af' }}>{p.department}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
                        {p.type}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', background: p.status === 'open' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: p.status === 'open' ? '#34d399' : '#fbbf24' }}>
                        {p.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: '600' }}>{p.applicant_count || 0}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => { setEditingPos(p); setPosForm(p); setShowPosModal(true); }} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer' }} title="Edit"><FileText size={16} /></button>
                        <button onClick={() => handleDuplicatePosition(p.id)} style={{ background: 'none', border: 'none', color: '#34d399', cursor: 'pointer' }} title="Duplicate"><Copy size={16} /></button>
                        <button onClick={() => handleArchivePosition(p.id)} style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer' }} title="Archive"><Archive size={16} /></button>
                        <button onClick={() => handleDeletePosition(p.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }} title="Delete Permanently"><XCircle size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* MODULE 6: DOCUMENT TEMPLATES & VERSIONING */}
        {activeSubTab === 'templates' && (
          <div style={{ background: 'rgba(18, 20, 29, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'rgba(10, 11, 16, 0.8)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#9ca3af' }}>
                  <th style={{ padding: '12px 16px' }}>TEMPLATE NAME</th>
                  <th style={{ padding: '12px 16px' }}>TYPE</th>
                  <th style={{ padding: '12px 16px' }}>VERSION</th>
                  <th style={{ padding: '12px 16px' }}>ACTIVE STATUS</th>
                  <th style={{ padding: '12px 16px' }}>LAST UPDATED</th>
                  <th style={{ padding: '12px 16px' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '14px 16px', fontWeight: '700', color: '#ffffff' }}>{t.title}</td>
                    <td style={{ padding: '14px 16px', textTransform: 'capitalize', color: '#9ca3af' }}>{t.type}</td>
                    <td style={{ padding: '14px 16px' }}><span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.08)', fontSize: '11px', fontWeight: '700' }}>v{t.version || 1}</span></td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', background: t.is_active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: t.is_active ? '#34d399' : '#f87171' }}>
                        {t.is_active ? 'Active' : 'Draft / Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#9ca3af' }}>{new Date(t.updated_at || t.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => { setEditingTpl(t); setTplForm(t); setShowTplModal(true); }} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer' }} title="Edit"><FileText size={16} /></button>
                        <button onClick={() => handlePreviewTemplate(t.id)} style={{ background: 'none', border: 'none', color: '#34d399', cursor: 'pointer' }} title="Preview HTML"><Eye size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* MODULE 6: GENERATED DOCUMENTS LOG */}
        {activeSubTab === 'documents' && (
          <div style={{ background: 'rgba(18, 20, 29, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'rgba(10, 11, 16, 0.8)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#9ca3af' }}>
                  <th style={{ padding: '12px 16px' }}>SERIAL #</th>
                  <th style={{ padding: '12px 16px' }}>RECIPIENT</th>
                  <th style={{ padding: '12px 16px' }}>TYPE</th>
                  <th style={{ padding: '12px 16px' }}>VERSION</th>
                  <th style={{ padding: '12px 16px' }}>VERIFICATION CODE</th>
                  <th style={{ padding: '12px 16px' }}>GENERATED AT</th>
                  <th style={{ padding: '12px 16px' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((d) => (
                  <tr key={d.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '14px 16px', fontWeight: '700', color: '#6366f1' }}>{d.serial_number || 'LEGACY-OFFER'}</td>
                    <td style={{ padding: '14px 16px', color: '#ffffff' }}>{d.sent_to || d.candidate_email}</td>
                    <td style={{ padding: '14px 16px', textTransform: 'capitalize' }}>{d.document_type || 'offer_letter'}</td>
                    <td style={{ padding: '14px 16px' }}><span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.08)', fontSize: '11px', fontWeight: '700' }}>v{d.document_version || 1}</span></td>
                    <td style={{ padding: '14px 16px', fontFamily: 'monospace', color: '#34d399' }}>{d.verification_code || 'VERIFIED'}</td>
                    <td style={{ padding: '14px 16px', color: '#9ca3af' }}>{new Date(d.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <button onClick={() => handleResendDocument(d.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', background: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(99, 102, 241, 0.4)', color: '#818cf8', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
                        <RefreshCw size={13} /> Resend v{(d.document_version || 1) + 1}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* MODULE 10: SETTINGS & BRANDING */}
        {activeSubTab === 'settings' && (
          <div style={{ background: 'rgba(18, 20, 29, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '24px', maxWidth: '700px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '16px', color: '#ffffff' }}>Company Branding &amp; Email Settings</h3>
            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#9ca3af' }}>Company Logo URL</label>
                <input type="text" value={settingsForm.company_logo_url} onChange={(e) => setSettingsForm({ ...settingsForm, company_logo_url: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(10, 11, 16, 0.6)', color: '#ffffff', fontSize: '13px', outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#9ca3af' }}>Default Sender Name</label>
                <input type="text" value={settingsForm.default_sender_name} onChange={(e) => setSettingsForm({ ...settingsForm, default_sender_name: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(10, 11, 16, 0.6)', color: '#ffffff', fontSize: '13px', outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#9ca3af' }}>Default Sender Email</label>
                <input type="email" value={settingsForm.default_sender_email} onChange={(e) => setSettingsForm({ ...settingsForm, default_sender_email: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(10, 11, 16, 0.6)', color: '#ffffff', fontSize: '13px', outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#9ca3af' }}>Signature Image URL</label>
                <input type="text" value={settingsForm.signature_image_url} onChange={(e) => setSettingsForm({ ...settingsForm, signature_image_url: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(10, 11, 16, 0.6)', color: '#ffffff', fontSize: '13px', outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="submit" disabled={savingSettings} style={{ padding: '12px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: '#ffffff', fontWeight: '700', border: 'none', cursor: 'pointer' }}>
                  {savingSettings ? 'Saving...' : 'Save Settings'}
                </button>
                <button type="button" onClick={handleImportDefaultSettings} style={{ padding: '12px 20px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#e5e7eb', fontWeight: '600', cursor: 'pointer' }}>
                  Import Defaults from .env
                </button>
              </div>
            </form>
          </div>
        )}

        {/* MODULE 9: FUNNEL & ANALYTICS */}
        {activeSubTab === 'analytics' && analytics && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ background: 'rgba(18, 20, 29, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>Recruitment Funnel Breakdown</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(analytics.funnel || []).map((f) => (
                  <div key={f.status} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ width: '120px', textTransform: 'capitalize', fontWeight: '600', fontSize: '13px' }}>{f.status}</span>
                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: '9999px', height: '12px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, (f.count / (analytics.total_applications || 1)) * 100)}%`, background: '#6366f1', height: '100%' }} />
                    </div>
                    <span style={{ fontWeight: '700', fontSize: '13px', width: '40px' }}>{f.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Position-Wise Funnel Analytics */}
            {positionAnalytics.length > 0 && (
              <div style={{ background: 'rgba(18, 20, 29, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>Position-Wise Recruitment Analytics</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: 'rgba(10, 11, 16, 0.8)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#9ca3af' }}>
                        <th style={{ padding: '10px 14px' }}>POSITION</th>
                        <th style={{ padding: '10px 14px' }}>DEPARTMENT</th>
                        <th style={{ padding: '10px 14px' }}>STATUS</th>
                        <th style={{ padding: '10px 14px' }}>TOTAL APPS</th>
                        <th style={{ padding: '10px 14px' }}>APPLIED</th>
                        <th style={{ padding: '10px 14px' }}>IN REVIEW</th>
                        <th style={{ padding: '10px 14px' }}>INTERVIEW</th>
                        <th style={{ padding: '10px 14px' }}>APPROVED</th>
                        <th style={{ padding: '10px 14px' }}>REJECTED</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positionAnalytics.map((pa) => (
                        <tr key={pa.position_id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                          <td style={{ padding: '12px 14px', fontWeight: '700', color: '#ffffff' }}>{pa.position_title}</td>
                          <td style={{ padding: '12px 14px', color: '#9ca3af' }}>{pa.department}</td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', background: pa.position_status === 'open' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: pa.position_status === 'open' ? '#34d399' : '#fbbf24' }}>
                              {pa.position_status}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', fontWeight: '700' }}>{pa.total_applications}</td>
                          <td style={{ padding: '12px 14px', color: '#818cf8' }}>{pa.applied_count}</td>
                          <td style={{ padding: '12px 14px', color: '#fbbf24' }}>{pa.in_review_count}</td>
                          <td style={{ padding: '12px 14px', color: '#38bdf8' }}>{pa.interview_count}</td>
                          <td style={{ padding: '12px 14px', color: '#34d399', fontWeight: '700' }}>{pa.approved_count}</td>
                          <td style={{ padding: '12px 14px', color: '#f87171' }}>{pa.rejected_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Create/Edit Position Modal */}
        {showPosModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ background: '#12141d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '24px', width: '90%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '16px' }}>{editingPos ? 'Edit Position' : 'Create Position'}</h2>
              <form onSubmit={handleCreateOrUpdatePosition} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#9ca3af' }}>Title</label>
                  <input type="text" value={posForm.title} onChange={(e) => setPosForm({ ...posForm, title: e.target.value })} required style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: '#0a0b10', color: '#fff' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#9ca3af' }}>Department</label>
                    <select value={posForm.department} onChange={(e) => setPosForm({ ...posForm, department: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: '#0a0b10', color: '#fff' }}>
                      <option value="Engineering">Engineering</option>
                      <option value="Product">Product</option>
                      <option value="Design">Design</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Sales">Sales</option>
                      <option value="HR">HR</option>
                      <option value="Operations">Operations</option>
                      <option value="Finance">Finance</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#9ca3af' }}>Status</label>
                    <select value={posForm.status} onChange={(e) => setPosForm({ ...posForm, status: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: '#0a0b10', color: '#fff' }}>
                      <option value="open">Open</option>
                      <option value="upcoming">Upcoming</option>
                      <option value="closed">Closed</option>
                      <option value="draft">Draft</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#9ca3af' }}>Description</label>
                  <textarea rows={3} value={posForm.description} onChange={(e) => setPosForm({ ...posForm, description: e.target.value })} required style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: '#0a0b10', color: '#fff' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#9ca3af' }}>Role & Responsibilities</label>
                  <textarea rows={3} value={posForm.responsibilities} onChange={(e) => setPosForm({ ...posForm, responsibilities: e.target.value })} placeholder="List key responsibilities..." style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: '#0a0b10', color: '#fff' }} />
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="button" onClick={() => setShowPosModal(false)} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" style={{ flex: 1, padding: '10px', borderRadius: '6px', border: 'none', background: '#6366f1', color: '#fff', fontWeight: '700', cursor: 'pointer' }}>Save Position</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create/Edit Document Template Modal */}
        {showTplModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ background: '#12141d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '24px', width: '90%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '16px' }}>{editingTpl ? 'Edit Template' : 'Create Document Template'}</h2>
              <form onSubmit={handleSaveTemplate} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#9ca3af' }}>Template Title</label>
                  <input type="text" value={tplForm.title} onChange={(e) => setTplForm({ ...tplForm, title: e.target.value })} required style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: '#0a0b10', color: '#fff' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#9ca3af' }}>Document Type</label>
                  <select value={tplForm.type} onChange={(e) => setTplForm({ ...tplForm, type: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: '#0a0b10', color: '#fff' }}>
                    <option value="offer_letter">Offer Letter</option>
                    <option value="certificate">Certificate of Completion / Internship</option>
                    <option value="contract">Employment Contract</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#9ca3af' }}>HTML Content (Supports &#123;&#123;candidate_name&#125;&#125;, &#123;&#123;position_title&#125;&#125;, &#123;&#123;start_date&#125;&#125;)</label>
                  <textarea rows={8} value={tplForm.html_content} onChange={(e) => setTplForm({ ...tplForm, html_content: e.target.value })} required style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: '#0a0b10', color: '#fff', fontFamily: 'monospace', fontSize: '12px' }} />
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="button" onClick={() => setShowTplModal(false)} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" style={{ flex: 1, padding: '10px', borderRadius: '6px', border: 'none', background: '#6366f1', color: '#fff', fontWeight: '700', cursor: 'pointer' }}>Save Template</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Live HTML Preview Modal */}
        {tplPreviewHtml && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110 }}>
            <div style={{ background: '#ffffff', color: '#000000', borderRadius: '16px', padding: '32px', width: '90%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, color: '#111827' }}>Live Template Render Preview</h3>
                <button onClick={() => setTplPreviewHtml('')} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer' }}>Close Preview</button>
              </div>
              <div dangerouslySetInnerHTML={{ __html: tplPreviewHtml }} />
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
