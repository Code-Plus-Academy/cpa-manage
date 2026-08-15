'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Award, Search, RefreshCw, Star, Sparkles, UserPlus, UserCheck,
  Trash2, Edit3, ShieldCheck, CheckCircle2, ExternalLink, X, Loader2
} from 'lucide-react';
import AdminShell from '../../components/shell/AdminShell';
import { tokens } from '../theme/tokens';
import { apiFetch } from '../../lib/apiClient';

const BADGE_OPTIONS = [
  'Top Reviewer',
  'Gold Contributor',
  'Campus Ambassador',
  'Verified PR Author',
  'Subject Expert',
  'Senior Campus Lead',
  'Lab Specialist',
  'Class Representative',
];

export default function ContributorsManagementPage() {
  const router = useRouter();
  const [adminUser, setAdminUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'featured' | 'unfeatured'

  // Modal states for featuring / editing a contributor
  const [activeModalUser, setActiveModalUser] = useState(null);
  const [roleTitle, setRoleTitle] = useState('');
  const [badge, setBadge] = useState('Top Reviewer');
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    checkAuthStatus();
    loadContributors();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const res = await apiFetch('/admin/auth/me');
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

  const loadContributors = async () => {
    setDataLoading(true);
    setActionError('');
    try {
      const res = await apiFetch('/admin/contributors');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.contributors || data.users || []);
      } else {
        setActionError('Failed to load contributors data.');
      }
    } catch (err) {
      console.error('Failed to load contributors data:', err);
      setActionError(err.message || 'Failed to connect to backend.');
    } finally {
      setDataLoading(false);
    }
  };

  const handleOpenFeatureModal = (user) => {
    setActiveModalUser(user);
    setRoleTitle(user.role_title || user.role || 'Senior Campus Lead');
    setBadge(user.badge || 'Top Reviewer');
    setActionSuccess('');
    setActionError('');
  };

  const handleCloseModal = () => {
    setActiveModalUser(null);
    setRoleTitle('');
    setBadge('Top Reviewer');
  };

  const handleSaveFeature = async (e) => {
    e.preventDefault();
    if (!activeModalUser) return;
    setSubmitting(true);
    setActionError('');
    setActionSuccess('');

    try {
      const res = await apiFetch('/admin/contributors/feature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: activeModalUser.id,
          role_title: roleTitle.trim() || 'Verified Notes Contributor',
          badge: badge || 'Top Reviewer',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || data?.error || 'Failed to feature contributor');
      }

      setActionSuccess(`Successfully featured @${activeModalUser.username} on /contributors!`);
      handleCloseModal();
      await loadContributors();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnfeature = async (user) => {
    if (!confirm(`Are you sure you want to remove @${user.username} from the /contributors Hall of Fame?`)) {
      return;
    }

    setDataLoading(true);
    setActionError('');
    setActionSuccess('');

    try {
      const res = await apiFetch(`/admin/contributors/feature/${user.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || data?.error || 'Failed to remove contributor');
      }

      setActionSuccess(`Removed @${user.username} from featured contributors.`);
      await loadContributors();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setDataLoading(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.college_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.role_title || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (filterMode === 'featured') return Boolean(u.is_featured);
    if (filterMode === 'unfeatured') return !u.is_featured;
    return true;
  });

  const featuredList = users.filter((u) => u.is_featured);

  return (
    <AdminShell
      adminUser={adminUser}
      activeTab="contributors"
      breadcrumb={['Community', 'Contributors Management']}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 60 }}>
        {/* ── Page Header ── */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 16,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(0, 219, 233, 0.12)', border: '1px solid rgba(0, 219, 233, 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00dbe9',
              }}>
                <Award size={20} />
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#f0f2f8', margin: 0, fontFamily: 'var(--font-head, sans-serif)' }}>
                Contributor Hall of Fame Manager
              </h1>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>
              Select, spotlight, and customize platform users displayed on the public <strong style={{ color: '#00dbe9' }}>/contributors</strong> page.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <a
              href="https://www.codeplusacademy.in/contributors"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#f0f2f8', fontSize: 12, fontWeight: 600, textDecoration: 'none',
              }}
            >
              <span>View Live /contributors</span>
              <ExternalLink size={13} />
            </a>

            <button
              onClick={loadContributors}
              disabled={dataLoading}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 8,
                background: 'rgba(0, 219, 233, 0.1)', border: '1px solid rgba(0, 219, 233, 0.3)',
                color: '#00dbe9', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <RefreshCw size={13} className={dataLoading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* ── Status Alerts ── */}
        {actionSuccess && (
          <div style={{
            marginBottom: 20, padding: '12px 16px', borderRadius: 10,
            background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#34d399', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <CheckCircle2 size={16} />
            <span>{actionSuccess}</span>
          </div>
        )}

        {actionError && (
          <div style={{
            marginBottom: 20, padding: '12px 16px', borderRadius: 10,
            background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171', fontSize: 13,
          }}>
            {actionError}
          </div>
        )}

        {/* ── Metrics Bar ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 14,
          marginBottom: 24,
        }}>
          <div style={{
            background: '#0d1322', border: '1px solid rgba(0, 219, 233, 0.25)',
            borderRadius: 14, padding: '16px 18px',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#00dbe9', textTransform: 'uppercase', marginBottom: 4 }}>
              ★ Featured Contributors
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#fff' }}>
              {featuredList.length}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
              Visible live on /contributors
            </div>
          </div>

          <div style={{
            background: '#0d1322', border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 14, padding: '16px 18px',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#a855f7', textTransform: 'uppercase', marginBottom: 4 }}>
              Registered Platform Users
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#fff' }}>
              {users.length}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
              Available to feature
            </div>
          </div>

          <div style={{
            background: '#0d1322', border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 14, padding: '16px 18px',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#34d399', textTransform: 'uppercase', marginBottom: 4 }}>
              Colleges Represented
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#fff' }}>
              {new Set(featuredList.map(u => u.college_name).filter(Boolean)).size}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
              Active university leads
            </div>
          </div>
        </div>

        {/* ── Currently Featured Spotlight Bar ── */}
        {featuredList.length > 0 && (
          <div style={{
            background: '#0a0f1d',
            border: '1px solid rgba(0, 219, 233, 0.3)',
            borderRadius: 16,
            padding: '18px 20px',
            marginBottom: 28,
            boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={16} color="#00dbe9" />
                <h2 style={{ fontSize: 15, fontWeight: 700, color: '#f0f2f8', margin: 0 }}>
                  Active Live Spotlight ({featuredList.length})
                </h2>
              </div>
              <span style={{ fontSize: 11, color: '#00dbe9', fontFamily: 'monospace' }}>
                LIVE ON WEBSITE
              </span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 12,
            }}>
              {featuredList.map((user) => (
                <div key={user.id} style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 12,
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <img
                      src={user.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`}
                      alt={user.username}
                      width={38}
                      height={38}
                      style={{ borderRadius: '50%', border: '2px solid #00dbe9', background: '#070a0e', flexShrink: 0 }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user.name || user.username}
                      </div>
                      <div style={{ fontSize: 10, color: '#00dbe9', fontFamily: 'monospace', fontWeight: 600 }}>
                        {user.badge || 'Verified Contributor'}
                      </div>
                      <div style={{ fontSize: 10.5, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user.role_title || user.role || 'Contributor'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button
                      onClick={() => handleOpenFeatureModal(user)}
                      title="Edit Contributor Role & Badge"
                      style={{
                        background: 'rgba(255, 255, 255, 0.06)', border: 'none',
                        color: '#94a3b8', padding: '6px', borderRadius: 6, cursor: 'pointer',
                      }}
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      onClick={() => handleUnfeature(user)}
                      title="Remove from /contributors"
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#f87171', padding: '6px', borderRadius: 6, cursor: 'pointer',
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Search & Filter Toolbar ── */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 260, maxWidth: 460 }}>
            <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 12 }} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users by name, @username, or college..."
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '9px 12px 9px 34px',
                borderRadius: 8,
                background: '#0d1322',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#f0f2f8',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            {['all', 'featured', 'unfeatured'].map((mode) => (
              <button
                key={mode}
                onClick={() => setFilterMode(mode)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: filterMode === mode ? '1px solid #00dbe9' : '1px solid rgba(255,255,255,0.08)',
                  background: filterMode === mode ? 'rgba(0, 219, 233, 0.15)' : 'rgba(255,255,255,0.03)',
                  color: filterMode === mode ? '#00dbe9' : '#94a3b8',
                  textTransform: 'capitalize',
                }}
              >
                {mode === 'all' ? `All (${users.length})` : mode === 'featured' ? `Featured (${featuredList.length})` : 'Not Featured'}
              </button>
            ))}
          </div>
        </div>

        {/* ── User Registry Table ── */}
        <div style={{
          background: '#0a0f1d',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 16,
          overflow: 'hidden',
        }}>
          {dataLoading && users.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
              <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 10px', color: '#00dbe9' }} />
              <p style={{ fontSize: 13 }}>Loading registered platform users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: '#94a3b8' }}>
              <p style={{ fontSize: 14, margin: 0 }}>No users found matching your search.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    background: 'rgba(255, 255, 255, 0.02)',
                    color: '#94a3b8',
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    <th style={{ padding: '12px 16px' }}>User</th>
                    <th style={{ padding: '12px 16px' }}>College / Institution</th>
                    <th style={{ padding: '12px 16px' }}>Uploads / Posts</th>
                    <th style={{ padding: '12px 16px' }}>Current Status</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr
                      key={user.id}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        background: user.is_featured ? 'rgba(0, 219, 233, 0.02)' : 'transparent',
                        transition: 'background 0.15s ease',
                      }}
                      className="hover:bg-white/[0.03]"
                    >
                      {/* User Info */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <img
                            src={user.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`}
                            alt={user.username}
                            width={38}
                            height={38}
                            style={{
                              borderRadius: '50%',
                              objectFit: 'cover',
                              border: user.is_featured ? '2px solid #00dbe9' : '1px solid rgba(255,255,255,0.1)',
                              background: '#070a0e',
                              flexShrink: 0,
                            }}
                          />
                          <div>
                            <div style={{ fontWeight: 700, color: '#f0f2f8' }}>
                              {user.name || user.username}
                            </div>
                            <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>
                              @{user.username}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* College */}
                      <td style={{ padding: '12px 16px', color: '#94a3b8' }}>
                        {user.college_name || '—'}
                      </td>

                      {/* Posts */}
                      <td style={{ padding: '12px 16px', color: '#f0f2f8', fontFamily: 'monospace', fontWeight: 600 }}>
                        {user.posts_count || 0} posts
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 16px' }}>
                        {user.is_featured ? (
                          <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              background: 'rgba(0, 219, 233, 0.12)', border: '1px solid rgba(0, 219, 233, 0.3)',
                              color: '#00dbe9', padding: '2px 8px', borderRadius: 6,
                              fontSize: 10.5, fontWeight: 700, fontFamily: 'monospace',
                            }}>
                              ★ FEATURED ({user.badge || 'Verified'})
                            </span>
                            {user.role_title && (
                              <span style={{ fontSize: 10, color: '#94a3b8' }}>
                                {user.role_title}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#64748b', fontSize: 11 }}>Regular User</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        {user.is_featured ? (
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              onClick={() => handleOpenFeatureModal(user)}
                              style={{
                                padding: '6px 12px', borderRadius: 6,
                                background: 'rgba(0, 219, 233, 0.1)', border: '1px solid rgba(0, 219, 233, 0.3)',
                                color: '#00dbe9', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                              }}
                            >
                              Edit Badge
                            </button>
                            <button
                              onClick={() => handleUnfeature(user)}
                              style={{
                                padding: '6px 12px', borderRadius: 6,
                                background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
                                color: '#f87171', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleOpenFeatureModal(user)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '6px 14px', borderRadius: 6,
                              background: 'linear-gradient(135deg, #00dbe9, #2563eb)',
                              border: 'none', color: '#fff', fontSize: 11, fontWeight: 700,
                              cursor: 'pointer', boxShadow: '0 2px 10px rgba(0, 219, 233, 0.2)',
                            }}
                          >
                            <UserPlus size={12} />
                            <span>+ Feature</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Feature / Edit Modal ── */}
        {activeModalUser && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}>
            <div style={{
              background: '#0a0f1d',
              border: '1px solid rgba(0, 219, 233, 0.3)',
              borderRadius: 18,
              padding: '24px 28px',
              maxWidth: 480,
              width: '100%',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Award size={18} color="#00dbe9" />
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#f0f2f8' }}>
                    {activeModalUser.is_featured ? 'Update Contributor Profile' : 'Feature User as Contributor'}
                  </h3>
                </div>
                <button
                  onClick={handleCloseModal}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* User Preview */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', borderRadius: 10,
                background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)',
                marginBottom: 18,
              }}>
                <img
                  src={activeModalUser.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${activeModalUser.username}`}
                  alt={activeModalUser.username}
                  width={42}
                  height={42}
                  style={{ borderRadius: '50%', border: '2px solid #00dbe9' }}
                />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                    {activeModalUser.name || activeModalUser.username}
                  </div>
                  <div style={{ fontSize: 11, color: '#00dbe9', fontFamily: 'monospace' }}>
                    @{activeModalUser.username} · {activeModalUser.college_name || 'No College Assigned'}
                  </div>
                </div>
              </div>

              <form onSubmit={handleSaveFeature} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Role Title */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#00dbe9', textTransform: 'uppercase', marginBottom: 4, fontFamily: 'monospace' }}>
                    Role / Subtitle
                  </label>
                  <input
                    value={roleTitle}
                    onChange={(e) => setRoleTitle(e.target.value)}
                    placeholder="e.g. Senior Campus Lead & AI/ML Contributor"
                    required
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '9px 12px', borderRadius: 8,
                      background: '#070a0e', border: '1px solid rgba(255,255,255,0.1)',
                      color: '#f0f2f8', fontSize: 13, outline: 'none',
                    }}
                  />
                </div>

                {/* Badge Selection */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#00dbe9', textTransform: 'uppercase', marginBottom: 4, fontFamily: 'monospace' }}>
                    Hall of Fame Badge
                  </label>
                  <select
                    value={badge}
                    onChange={(e) => setBadge(e.target.value)}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '9px 12px', borderRadius: 8,
                      background: '#070a0e', border: '1px solid rgba(255,255,255,0.1)',
                      color: '#f0f2f8', fontSize: 13, outline: 'none',
                    }}
                  >
                    {BADGE_OPTIONS.map((b) => (
                      <option key={b} value={b} style={{ background: '#0a0e14', color: '#fff' }}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    style={{
                      padding: '8px 16px', borderRadius: 8,
                      background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                      color: '#94a3b8', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 20px', borderRadius: 8,
                      background: 'linear-gradient(135deg, #00dbe9, #2563eb)',
                      border: 'none', color: '#fff', fontSize: 13, fontWeight: 700,
                      cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1,
                    }}
                  >
                    {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    <span>Confirm & Feature</span>
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
