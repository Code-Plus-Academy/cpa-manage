'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AdminShell from '../../components/shell/AdminShell';
import { apiFetch } from '../../lib/apiClient';
import {
  Briefcase, Users, CheckCircle2, Clock, XCircle, Search, Filter, Plus,
  Sparkles, FileText, Send, Eye, Copy, Archive, ArrowRight, ShieldCheck, Mail, BarChart3, Settings, Play
} from 'lucide-react';

export default function HiringAdminDashboard() {
  const [activeSubTab, setActiveSubTab] = useState('kanban'); // kanban | positions | templates | email_log | analytics
  const [positions, setPositions] = useState([]);
  const [applications, setApplications] = useState([]);
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

  const [bulkSelected, setBulkSelected] = useState([]);
  const [bulkRejectReason, setBulkRejectReason] = useState('');
  const [showBulkRejectModal, setShowBulkRejectModal] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [posRes, appRes, anaRes] = await Promise.all([
        apiFetch('/admin/hiring/positions').then((r) => r.ok ? r.json() : { positions: [] }),
        apiFetch('/admin/hiring/applications').then((r) => r.ok ? r.json() : { applications: [] }),
        apiFetch('/admin/hiring/analytics/overview').then((r) => r.ok ? r.json() : null),
      ]);

      setPositions(posRes.positions || []);
      setApplications(appRes.applications || []);
      setAnalytics(anaRes || null);
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
              Manage job postings, track applicant Kanban pipeline, approve offers, and oversee intern onboarding.
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
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '20px', paddingBottom: '8px' }}>
          {[
            { id: 'kanban', label: 'Pipeline Kanban', icon: Users },
            { id: 'positions', label: 'Position Management', icon: Briefcase },
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
                        <button onClick={() => handleArchivePosition(p.id)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }} title="Archive"><Archive size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* MODULE 9: FUNNEL & ANALYTICS */}
        {activeSubTab === 'analytics' && analytics && (
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
        )}

        {/* Create/Edit Position Modal */}
        {showPosModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ background: '#12141d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '24px', width: '90%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '16px' }}>{editingPos ? 'Edit Position' : 'Create Position'}</h2>
              <form onSubmit={handleCreateOrUpdatePosition} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#9ca3af' }}>Title</label>
                  <input type="text" value={posForm.title} onChange={(e) => setPosForm({ ...posForm, title: e.target.value })} required style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: '#0a0b10', color: '#fff' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#9ca3af' }}>Department</label>
                  <input type="text" value={posForm.department} onChange={(e) => setPosForm({ ...posForm, department: e.target.value })} required style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: '#0a0b10', color: '#fff' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#9ca3af' }}>Description</label>
                  <textarea rows={4} value={posForm.description} onChange={(e) => setPosForm({ ...posForm, description: e.target.value })} required style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: '#0a0b10', color: '#fff' }} />
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="button" onClick={() => setShowPosModal(false)} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" style={{ flex: 1, padding: '10px', borderRadius: '6px', border: 'none', background: '#6366f1', color: '#fff', fontWeight: '700', cursor: 'pointer' }}>Save Position</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
