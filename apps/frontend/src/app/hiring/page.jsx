'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Briefcase, Users, Plus, Search, Filter, RefreshCw, Eye, CheckCircle2,
  Clock, ArrowRight, UserCheck, AlertCircle, FileText, X
} from 'lucide-react';
import AdminShell from '../../components/shell/AdminShell';

export default function StandaloneHiringPage() {
  const router = useRouter();
  const [adminUser, setAdminUser] = useState(null);
  const [activeTab, setActiveTab] = useState('applications'); // 'applications' | 'positions'

  // Positions Data
  const [positions, setPositions] = useState([]);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [showCreatePositionModal, setShowCreatePositionModal] = useState(false);
  const [newPosition, setNewPosition] = useState({
    title: '',
    department: 'Engineering',
    type: 'intern',
    status: 'open',
    description: '',
    openings: 1,
  });

  // Applications Data
  const [applications, setApplications] = useState([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const apiUrl = process.env.NEXT_PUBLIC_MANAGE_API_URL || 'http://localhost:4000';

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (adminUser) {
      if (activeTab === 'applications') loadApplications();
      if (activeTab === 'positions') loadPositions();
    }
  }, [adminUser, activeTab, statusFilter]);

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

  const loadPositions = async () => {
    try {
      setPositionsLoading(true);
      const res = await fetch(`${apiUrl}/admin/hiring/positions`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setPositions(data.positions || []);
      }
    } catch (err) {
      console.error('Failed to load positions:', err);
    } finally {
      setPositionsLoading(false);
    }
  };

  const loadApplications = async () => {
    try {
      setApplicationsLoading(true);
      const query = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const res = await fetch(`${apiUrl}/admin/hiring/applications${query}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setApplications(data.applications || []);
      }
    } catch (err) {
      console.error('Failed to load applications:', err);
    } finally {
      setApplicationsLoading(false);
    }
  };

  const handleCreatePosition = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${apiUrl}/admin/hiring/positions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newPosition),
      });
      if (res.ok) {
        setShowCreatePositionModal(false);
        setNewPosition({ title: '', department: 'Engineering', type: 'intern', status: 'open', description: '', openings: 1 });
        loadPositions();
      }
    } catch (err) {
      console.error('Failed to create position:', err);
    }
  };

  const filteredApplications = applications.filter((app) => {
    const q = searchQuery.toLowerCase();
    return (
      (app.candidate_name || '').toLowerCase().includes(q) ||
      (app.candidate_email || '').toLowerCase().includes(q) ||
      (app.position_title || '').toLowerCase().includes(q) ||
      (app.status || '').toLowerCase().includes(q)
    );
  });

  return (
    <AdminShell user={adminUser}>
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: '#f9fafb' }}>
              Hiring &amp; Internship Pipeline
            </h1>
            <p style={{ margin: '4px 0 0 0', color: '#9ca3af', fontSize: '14px' }}>
              Manage open positions, review candidate applications, chat with applicants, and trigger onboarding approvals.
            </p>
          </div>

          <button
            onClick={() => setShowCreatePositionModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '8px',
              background: '#6366f1',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '14px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Plus size={18} /> Create New Position
          </button>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '24px' }}>
          <button
            onClick={() => setActiveTab('applications')}
            style={{
              padding: '12px 20px',
              border: 'none',
              background: 'transparent',
              color: activeTab === 'applications' ? '#6366f1' : '#9ca3af',
              fontWeight: 700,
              fontSize: '14px',
              borderBottom: activeTab === 'applications' ? '2px solid #6366f1' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Users size={18} /> Candidate Applications ({applications.length})
          </button>

          <button
            onClick={() => setActiveTab('positions')}
            style={{
              padding: '12px 20px',
              border: 'none',
              background: 'transparent',
              color: activeTab === 'positions' ? '#6366f1' : '#9ca3af',
              fontWeight: 700,
              fontSize: '14px',
              borderBottom: activeTab === 'positions' ? '2px solid #6366f1' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Briefcase size={18} /> Job &amp; Intern Positions ({positions.length})
          </button>
        </div>

        {/* TAB 1: APPLICATIONS PIPELINE */}
        {activeTab === 'applications' && (
          <div>
            {/* Filters */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ position: 'relative', flex: '1 1 300px' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                <input
                  type="text"
                  placeholder="Search applicants by name, email or position..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 36px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(0,0,0,0.2)',
                    color: '#fff',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                {['all', 'applied', 'in_review', 'interview', 'approved', 'rejected'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: statusFilter === s ? '#6366f1' : 'rgba(255,255,255,0.1)',
                      background: statusFilter === s ? '#6366f1' : 'transparent',
                      color: statusFilter === s ? '#fff' : '#9ca3af',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >
                    {s.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Applications Table */}
            {applicationsLoading ? (
              <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>Loading applications...</div>
            ) : filteredApplications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Users size={36} style={{ color: '#6b7280', marginBottom: '12px' }} />
                <div style={{ color: '#9ca3af', fontSize: '14px' }}>No candidate applications found.</div>
              </div>
            ) : (
              <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af' }}>
                      <th style={{ padding: '14px 20px', fontWeight: 600 }}>CANDIDATE</th>
                      <th style={{ padding: '14px 20px', fontWeight: 600 }}>POSITION</th>
                      <th style={{ padding: '14px 20px', fontWeight: 600 }}>STATUS</th>
                      <th style={{ padding: '14px 20px', fontWeight: 600 }}>APPLIED DATE</th>
                      <th style={{ padding: '14px 20px', fontWeight: 600, textAlign: 'right' }}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApplications.map((app) => (
                      <tr key={app.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ fontWeight: 600, color: '#f3f4f6' }}>{app.candidate_name || 'Applicant'}</div>
                          <div style={{ fontSize: '12px', color: '#9ca3af' }}>{app.candidate_email}</div>
                        </td>
                        <td style={{ padding: '16px 20px', color: '#d1d5db' }}>
                          {app.position_title || app.position_id}
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <span
                            style={{
                              padding: '4px 10px',
                              borderRadius: '9999px',
                              fontSize: '12px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              background:
                                app.status === 'approved'
                                  ? 'rgba(16,185,129,0.15)'
                                  : app.status === 'rejected'
                                  ? 'rgba(239,68,68,0.15)'
                                  : app.status === 'interview'
                                  ? 'rgba(59,130,246,0.15)'
                                  : 'rgba(245,158,11,0.15)',
                              color:
                                app.status === 'approved'
                                  ? '#10b981'
                                  : app.status === 'rejected'
                                  ? '#ef4444'
                                  : app.status === 'interview'
                                  ? '#3b82f6'
                                  : '#f59e0b',
                            }}
                          >
                            {app.status}
                          </span>
                        </td>
                        <td style={{ padding: '16px 20px', color: '#9ca3af', fontSize: '13px' }}>
                          {app.applied_at ? new Date(app.applied_at).toLocaleDateString() : 'Recent'}
                        </td>
                        <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                          <Link
                            href={`/hiring/${app.id}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 14px',
                              borderRadius: '6px',
                              background: 'rgba(99,102,241,0.15)',
                              color: '#6366f1',
                              fontWeight: 600,
                              fontSize: '13px',
                              textDecoration: 'none',
                            }}
                          >
                            <Eye size={14} /> Review &amp; Chat
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: POSITIONS MANAGEMENT */}
        {activeTab === 'positions' && (
          <div>
            {positionsLoading ? (
              <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>Loading positions...</div>
            ) : positions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Briefcase size={36} style={{ color: '#6b7280', marginBottom: '12px' }} />
                <div style={{ color: '#9ca3af', fontSize: '14px' }}>No positions created yet. Click &quot;Create New Position&quot; to add one.</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '16px' }}>
                {positions.map((pos) => (
                  <div
                    key={pos.id}
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      padding: '20px',
                      borderRadius: '12px',
                      border: '1px solid rgba(255,255,255,0.06)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '20px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#f3f4f6' }}>{pos.title}</h3>
                        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px', background: 'rgba(99,102,241,0.2)', color: '#6366f1' }}>
                          {pos.type}
                        </span>
                        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px', background: pos.status === 'open' ? 'rgba(16,185,129,0.2)' : 'rgba(156,163,175,0.2)', color: pos.status === 'open' ? '#10b981' : '#9ca3af' }}>
                          {pos.status}
                        </span>
                      </div>
                      <p style={{ fontSize: '13px', color: '#9ca3af', margin: '0 0 8px 0' }}>{pos.description}</p>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        Department: {pos.department} | Openings: {pos.openings}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modal: Create Position */}
        {showCreatePositionModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
            <div style={{ background: '#111827', width: '100%', maxWidth: '500px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', padding: '28px', color: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Create Job / Intern Position</h3>
                <button onClick={() => setShowCreatePositionModal(false)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}><X size={20} /></button>
              </div>

              <form onSubmit={handleCreatePosition} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Full-Stack Engineering Intern"
                    value={newPosition.title}
                    onChange={(e) => setNewPosition({ ...newPosition, title: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Department</label>
                    <input
                      type="text"
                      required
                      value={newPosition.department}
                      onChange={(e) => setNewPosition({ ...newPosition, department: e.target.value })}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Type</label>
                    <select
                      value={newPosition.type}
                      onChange={(e) => setNewPosition({ ...newPosition, type: e.target.value })}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff', outline: 'none' }}
                    >
                      <option value="intern">Intern</option>
                      <option value="full-time">Full-Time</option>
                      <option value="contract">Contract</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Description</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Role responsibilities and qualifications..."
                    value={newPosition.description}
                    onChange={(e) => setNewPosition({ ...newPosition, description: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff', outline: 'none', resize: 'none' }}
                  />
                </div>

                <button
                  type="submit"
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    background: '#6366f1',
                    color: '#fff',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    marginTop: '8px',
                  }}
                >
                  Create Position
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
