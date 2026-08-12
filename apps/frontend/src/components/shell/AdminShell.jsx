'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldAlert, Ticket, Scale, Building2, UserX, FileText, Mail, Activity, Users,
  ChevronLeft, ChevronRight, LogOut, Search, Bell, ShieldCheck, Command, Briefcase, Sparkles, Send
} from 'lucide-react';
import { tokens } from '../../app/theme/tokens';

export default function AdminShell({
  adminUser: passedAdminUser,
  activeTab,
  currentRoute,
  onTabChange,
  onLogout,
  breadcrumb: passedBreadcrumb,
  slaAlertCount = 0,
  children
}) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('cpa_sidebar_collapsed') === 'true';
    }
    return false;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [fetchedAdminUser, setFetchedAdminUser] = useState(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('cpa_admin_user');
      if (cached) {
        try { return JSON.parse(cached); } catch (e) {}
      }
    }
    return null;
  });

  useEffect(() => {
    if (!passedAdminUser && typeof window !== 'undefined') {
      const apiUrl = process.env.NEXT_PUBLIC_MANAGE_API_URL || 'https://cpa-manage.onrender.com';
      fetch(`${apiUrl}/admin/auth/me`, { credentials: 'include' })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.admin_user) {
            setFetchedAdminUser(data.admin_user);
            localStorage.setItem('cpa_admin_user', JSON.stringify(data.admin_user));
          }
        })
        .catch(() => {});
    }
  }, [passedAdminUser]);

  const handleToggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('cpa_sidebar_collapsed', String(next));
      }
      return next;
    });
  };

  const adminUser = passedAdminUser || fetchedAdminUser;
  const isRoot = adminUser?.is_root;
  const userPermissions = adminUser?.permissions || [];

  const hasPermission = (key) => {
    if (isRoot) return true;
    return userPermissions.includes(key);
  };

  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const effectiveActiveTab = activeTab || (
    currentRoute ? currentRoute.replace(/^\//, '') : (
      pathname.includes('/email') ? 'email' :
      pathname.includes('/hiring') ? 'hiring' :
      pathname.includes('/careers') ? 'careers' :
      pathname.includes('/tickets') ? 'tickets' :
      pathname.includes('/copyright') ? 'copyright' :
      pathname.includes('/institutions') ? 'institutions' :
      pathname.includes('/reclaim') ? 'reclaim' :
      pathname.includes('/users') ? 'users' :
      pathname.includes('/moderation') ? 'content' :
      pathname.includes('/audit') ? 'audit' :
      pathname.includes('/system-status') ? 'system-status' :
      pathname.includes('/admins') ? 'admins' : 'tickets'
    )
  );

  const defaultBreadcrumbs = {
    email: ['Communications', 'Email System Studio'],
    hiring: ['Hiring & Recruitment', 'Hiring & ATS Studio'],
    careers: ['Hiring & Recruitment', 'Public Careers Portal'],
    tickets: ['Trust & Safety', 'Support Tickets'],
    copyright: ['Trust & Safety', 'Copyright Claims'],
    institutions: ['Trust & Safety', 'Institution Claims'],
    reclaim: ['Trust & Safety', 'Content Reclaim Claims'],
    users: ['Users', 'User Moderation'],
    content: ['Content', 'Content Moderation'],
    audit: ['Administration', 'Audit Log'],
    'system-status': ['Administration', 'System Status'],
    admins: ['Administration', 'Admin Management'],
  };

  const breadcrumb = passedBreadcrumb || defaultBreadcrumbs[effectiveActiveTab] || ['Trust & Safety', 'Support Tickets'];

  const navSections = [
    {
      title: 'TRUST & SAFETY',
      items: [
        { id: 'tickets', label: 'Support Tickets', icon: Ticket, perm: 'support.view' },
        { id: 'copyright', label: 'Copyright Claims', icon: Scale, perm: 'claims.copyright.view' },
        { id: 'institutions', label: 'Institution Claims', icon: Building2, perm: 'claims.institution.view' },
        { id: 'reclaim', label: 'Content Reclaim Claims', icon: FileText, perm: 'claims.reclaim.view' },
      ],
    },
    {
      title: 'HIRING & RECRUITMENT',
      items: [
        { id: 'hiring', label: 'Hiring & ATS Studio', icon: Briefcase },
        { id: 'careers', label: 'Public Careers Portal', icon: Sparkles },
      ],
    },
    {
      title: 'COMMUNICATIONS',
      items: [
        { id: 'email', label: 'Email System Studio', icon: Mail, perm: 'email.templates.edit' },
      ],
    },
    {
      title: 'USERS',
      items: [
        { id: 'users', label: 'User Moderation', icon: UserX, perm: 'users.reports.view' },
      ],
    },
    {
      title: 'CONTENT',
      items: [
        { id: 'content', label: 'Content Moderation', icon: ShieldAlert, perm: 'content.moderation.view' },
      ],
    },
    {
      title: 'ADMINISTRATION',
      items: [
        { id: 'audit', label: 'Audit Log', icon: Activity, perm: 'audit.view' },
        { id: 'system-status', label: 'System Status', icon: Activity, perm: 'system.status.view' },
        { id: 'admins', label: 'Admin Management', icon: Users, perm: 'admin.manage', rootOnly: true },
      ],
    },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: tokens.colors.bgDark, color: tokens.colors.textPrimary }}>
      {/* ── LEFT SIDEBAR ──────────────────────────────────────────────────────── */}
      <aside
        style={{
          width: collapsed ? '64px' : '240px',
          transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          backgroundColor: '#090D16',
          borderRight: `1px solid ${tokens.colors.borderSubtle}`,
          display: 'flex',
          flexDirection: 'column',
          zIndex: 40,
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
        }}
      >
        {/* Header / Brand */}
        <div
          style={{
            height: '60px',
            display: 'flex',
            alignItems: 'center',
            padding: collapsed ? '0 14px' : '0 16px',
            borderBottom: `1px solid ${tokens.colors.borderSubtle}`,
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: tokens.colors.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 0 12px ${tokens.colors.primaryGlow}`,
              flexShrink: 0,
            }}
          >
            <ShieldCheck size={18} color="#FFFFFF" />
          </div>
          {!collapsed && (
            <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: '13px', fontWeight: '800', letterSpacing: '-0.02em', display: 'block', color: tokens.colors.textPrimary }}>
                CODE PLUS ACADEMY
              </span>
              <span style={{ fontSize: '10px', color: tokens.colors.textMuted, fontFamily: 'JetBrains Mono, monospace' }}>
                manage.codeplusacademy.in
              </span>
            </div>
          )}
        </div>

        {/* Navigation Sections */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
          {navSections.map((sec) => {
            const visibleItems = sec.items.filter(
              (item) => (item.rootOnly ? isRoot : (item.perm ? hasPermission(item.perm) : true))
            );

            if (visibleItems.length === 0) return null;

            return (
              <div key={sec.title} style={{ marginBottom: '16px' }}>
                {!collapsed && (
                  <div
                    style={{
                      padding: '4px 10px 8px 10px',
                      fontSize: '11px',
                      fontWeight: '700',
                      letterSpacing: '0.08em',
                      color: tokens.colors.textMuted,
                      textTransform: 'uppercase',
                    }}
                  >
                    {sec.title}
                  </div>
                )}
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = effectiveActiveTab === item.id;

                  const handleNavClick = (id) => {
                    if (id === 'hiring') {
                      router.push('/hiring');
                      return;
                    }
                    if (id === 'email') {
                      router.push('/email');
                      return;
                    }
                    if (id === 'careers') {
                      router.push('/careers');
                      return;
                    }
                    if (onTabChange) {
                      onTabChange(id);
                    } else {
                      router.push(`/${id}`);
                    }
                  };

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      title={collapsed ? item.label : undefined}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: collapsed ? '10px 0' : '9px 12px',
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        borderRadius: '8px',
                        border: 'none',
                        borderLeft: isActive ? `3px solid ${tokens.colors.primary}` : '3px solid transparent',
                        backgroundColor: isActive ? 'rgba(124, 58, 237, 0.14)' : 'transparent',
                        color: isActive ? '#FFFFFF' : tokens.colors.textSecondary,
                        fontWeight: isActive ? '600' : '400',
                        fontSize: '13px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        marginBottom: '2px',
                        textAlign: 'left',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <Icon size={16} color={isActive ? tokens.colors.primary : tokens.colors.textMuted} style={{ flexShrink: 0 }} />
                      {!collapsed && <span>{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer */}
        <div
          style={{
            padding: collapsed ? '12px 6px' : '12px',
            borderTop: `1px solid ${tokens.colors.borderSubtle}`,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
          }}
        >
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: tokens.colors.surfaceOverlay,
                    border: `1px solid ${tokens.colors.borderSubtle}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: '700',
                    color: tokens.colors.primary,
                  }}
                >
                  {adminUser?.display_name ? adminUser.display_name[0].toUpperCase() : 'A'}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: tokens.colors.textPrimary, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {adminUser ? (adminUser.display_name || 'Admin') : 'Not Logged In'}
                  </div>
                  {adminUser && (
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: '700',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        backgroundColor: isRoot ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                        color: isRoot ? '#F87171' : '#60A5FA',
                        textTransform: 'uppercase',
                      }}
                    >
                      {isRoot ? 'ROOT' : 'WORKER'}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={async () => {
                  if (typeof window !== 'undefined') {
                    localStorage.removeItem('cpa_admin_token');
                  }
                  if (onLogout) {
                    onLogout();
                    return;
                  }
                  try {
                    const apiUrl = process.env.NEXT_PUBLIC_MANAGE_API_URL || 'http://localhost:4000';
                    const token = typeof window !== 'undefined' ? localStorage.getItem('cpa_admin_token') : null;
                    const headers = {};
                    if (token) headers['Authorization'] = `Bearer ${token}`;
                    await fetch(`${apiUrl}/admin/auth/logout`, { method: 'POST', headers, credentials: 'include' });
                    router.push('/');
                    router.refresh();
                  } catch (err) {
                    console.error('Logout error:', err);
                  }
                }}
                title="Logout"
                style={{
                  background: 'none',
                  border: 'none',
                  color: tokens.colors.textMuted,
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                }}
              >
                <LogOut size={15} />
              </button>
            </div>
          )}

          <button
            onClick={handleToggleCollapsed}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '6px',
              borderRadius: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${tokens.colors.borderSubtle}`,
              color: tokens.colors.textMuted,
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            {collapsed ? <ChevronRight size={14} /> : <><ChevronLeft size={14} /> Collapse</>}
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT CONTAINER ────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          marginLeft: collapsed ? '64px' : '240px',
          transition: 'margin-left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        {/* ── TOP BAR ───────────────────────────────────────────────────────── */}
        <header
          style={{
            height: '60px',
            borderBottom: `1px solid ${tokens.colors.borderSubtle}`,
            backgroundColor: tokens.colors.bgDark,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            position: 'sticky',
            top: 0,
            zIndex: 30,
          }}
        >
          {/* Breadcrumb Trail */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: tokens.colors.textMuted }}>
            {breadcrumb.map((crumb, idx) => (
              <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {idx > 0 && <span style={{ color: tokens.colors.borderSubtle }}>/</span>}
                <span style={{ color: idx === breadcrumb.length - 1 ? tokens.colors.textPrimary : tokens.colors.textMuted, fontWeight: idx === breadcrumb.length - 1 ? '600' : '400' }}>
                  {crumb}
                </span>
              </span>
            ))}
          </div>

          {/* Right Actions: Search + Public Careers Portal + SLA Alert Bell + Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <a
              href="/careers"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '6px 12px', borderRadius: '6px',
                background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)',
                color: '#818cf8', fontSize: '12px', fontWeight: '600', textDecoration: 'none'
              }}
            >
              <Briefcase size={14} /> Public Careers Portal ↗
            </a>

            {/* Command Palette Search Box */}
            <div style={{ position: 'relative', width: '240px' }}>
              <Search size={14} color={tokens.colors.textMuted} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search (Cmd+K)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px 6px 30px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(15, 23, 42, 0.8)',
                  border: `1px solid ${tokens.colors.borderSubtle}`,
                  color: tokens.colors.textPrimary,
                  fontSize: '12px',
                  outline: 'none',
                }}
              />
            </div>

            {/* SLA Alert Notification Bell */}
            <div style={{ position: 'relative', cursor: 'pointer' }} title={`${slaAlertCount} SLA Overdue Alerts`}>
              <div
                style={{
                  padding: '8px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  border: `1px solid ${tokens.colors.borderSubtle}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Bell size={16} color={slaAlertCount > 0 ? '#F87171' : tokens.colors.textMuted} />
              </div>
              {slaAlertCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    backgroundColor: '#EF4444',
                    color: '#FFFFFF',
                    borderRadius: '50%',
                    width: '16px',
                    height: '16px',
                    fontSize: '10px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {slaAlertCount}
                </span>
              )}
            </div>

            {/* Admin Profile */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: tokens.colors.primary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#FFFFFF',
                }}
              >
                {adminUser?.display_name ? adminUser.display_name[0].toUpperCase() : 'A'}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content Body */}
        <main style={{ flex: 1, padding: '24px', maxWidth: '1400px', width: '100%', margin: '0 auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
