'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity, RefreshCw, Database, Server, Cpu, Radio,
  CheckCircle2, AlertTriangle, XCircle, Clock, Wifi, WifiOff,
  HardDrive, Zap, Mail, ShieldAlert, Layers
} from 'lucide-react';
import AdminShell from '../../components/shell/AdminShell';
import StatusPill from '../../components/ui/StatusPill';
import { tokens } from '../theme/tokens';

const AUTO_REFRESH_INTERVAL = 10000; // 10 seconds

function SkeletonCard() {
  return (
    <div style={{
      backgroundColor: tokens.colors.surfaceElevated,
      borderRadius: '12px',
      border: `1px solid ${tokens.colors.borderSubtle}`,
      padding: '24px',
      animation: 'pulse 1.5s infinite',
    }}>
      <div style={{ height: 18, width: '45%', backgroundColor: tokens.colors.surfaceOverlay, borderRadius: 6, marginBottom: 16 }} />
      <div style={{ height: 14, width: '75%', backgroundColor: tokens.colors.surfaceOverlay, borderRadius: 4, marginBottom: 10 }} />
      <div style={{ height: 14, width: '60%', backgroundColor: tokens.colors.surfaceOverlay, borderRadius: 4 }} />
    </div>
  );
}

function MetricChip({ label, value, subtext }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '2px',
      padding: '10px 14px', borderRadius: '8px',
      backgroundColor: tokens.colors.bgDark,
      border: `1px solid ${tokens.colors.borderSubtle}`,
    }}>
      <span style={{ fontSize: '10px', fontWeight: 700, color: tokens.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </span>
      <span style={{ fontSize: '14px', fontWeight: 700, color: tokens.colors.textPrimary }}>
        {value}
      </span>
      {subtext && (
        <span style={{ fontSize: '11px', color: tokens.colors.textMuted }}>
          {subtext}
        </span>
      )}
    </div>
  );
}

function LatencyBadge({ latency }) {
  if (latency == null) return null;
  const isFast = latency < 50;
  const isModerate = latency >= 50 && latency < 200;
  const color = isFast ? '#34D399' : isModerate ? '#FBBF24' : '#F87171';
  const bg = isFast ? 'rgba(52, 211, 153, 0.12)' : isModerate ? 'rgba(251, 191, 36, 0.12)' : 'rgba(239, 68, 68, 0.12)';
  const border = isFast ? 'rgba(52, 211, 153, 0.3)' : isModerate ? 'rgba(251, 191, 36, 0.3)' : 'rgba(239, 68, 68, 0.3)';

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '2px 8px', borderRadius: '6px',
      fontSize: '11px', fontWeight: 700, fontFamily: 'monospace',
      color, backgroundColor: bg, border: `1px solid ${border}`
    }}>
      <Clock size={11} color={color} />
      {latency}ms
    </span>
  );
}

function ServiceCard({ title, icon: Icon, data, subtitle }) {
  if (!data) return <SkeletonCard />;
  const status = data.status || 'unknown';
  const isError = status === 'error' || status === 'unreachable' || status === 'unhealthy' || status === 'timeout';
  const latency = data.latency_ms ?? data.db?.latency_ms ?? data.details?.db?.latency_ms;
  const redisVal = typeof data.redis === 'object' ? data.redis.status : (data.redis || data.details?.redis?.status || data.details?.redis);

  return (
    <div style={{
      backgroundColor: tokens.colors.surfaceElevated,
      borderRadius: '12px',
      border: `1px solid ${isError ? 'rgba(239, 68, 68, 0.35)' : tokens.colors.borderSubtle}`,
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      boxShadow: isError ? '0 0 16px rgba(239, 68, 68, 0.08)' : 'none',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '10px',
            backgroundColor: 'rgba(124, 58, 237, 0.15)',
            border: '1px solid rgba(124, 58, 237, 0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={20} color={tokens.colors.primary} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: tokens.colors.textPrimary }}>{title}</h3>
              <LatencyBadge latency={latency} />
            </div>
            <span style={{ fontSize: '11px', color: tokens.colors.textMuted, fontFamily: 'monospace' }}>
              {subtitle || data.url || 'Service Endpoint'}
            </span>
          </div>
        </div>
        <StatusPill status={status} />
      </div>

      {/* Service Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
        {(data.uptime != null || data.details?.uptime != null) && (
          <MetricChip label="Uptime" value={formatUptime(data.uptime ?? data.details?.uptime)} />
        )}
        {(data.port != null || data.details?.port != null) && (
          <MetricChip label="Port" value={data.port ?? data.details?.port} />
        )}
        {redisVal != null && (
          <MetricChip label="Redis" value={String(redisVal).toUpperCase()} />
        )}
      </div>

      {/* Detailed Sub-Checks */}
      {(data.databases || data.details?.databases) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: tokens.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Sub-Checks
          </span>
          {Object.entries(data.databases || data.details?.databases || {}).map(([dbKey, dbVal]) => {
            if (dbKey.endsWith('_latency_ms')) return null;
            return (
              <div key={dbKey} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 12px', borderRadius: '6px',
                backgroundColor: tokens.colors.bgDark,
              }}>
                <span style={{ fontSize: '12px', color: tokens.colors.textSecondary, fontFamily: 'monospace' }}>
                  {dbKey} db
                </span>
                <StatusPill status={typeof dbVal === 'object' ? dbVal.status : dbVal} />
              </div>
            );
          })}
        </div>
      )}

      {/* Inline Error Banner for Failing Service */}
      {(data.error || data.details?.error) && (
        <div style={{
          padding: '10px 14px', borderRadius: '8px',
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          display: 'flex', alignItems: 'center', gap: '8px',
          fontSize: '12px', color: '#F87171', fontFamily: 'monospace',
        }}>
          <AlertTriangle size={14} style={{ flexShrink: 0 }} />
          <span>{data.error || data.details?.error}</span>
        </div>
      )}
    </div>
  );
}

function DatabaseCard({ title, data }) {
  if (!data) return null;
  const status = data.status || 'unknown';
  const isError = status === 'error' || status === 'down' || status === 'unreachable';
  const rowCounts = data.row_counts;

  return (
    <div style={{
      padding: '16px 20px',
      borderRadius: '12px',
      backgroundColor: tokens.colors.bgDark,
      border: `1px solid ${isError ? 'rgba(239, 68, 68, 0.35)' : tokens.colors.borderSubtle}`,
      display: 'flex', flexDirection: 'column', gap: '12px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: 36, height: 36, borderRadius: '8px',
            backgroundColor: 'rgba(100, 116, 139, 0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Database size={18} color={tokens.colors.textSecondary} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: tokens.colors.textPrimary }}>
                {data.name || title}
              </div>
              <LatencyBadge latency={data.latency_ms} />
            </div>
            <div style={{ fontSize: '11px', color: tokens.colors.textMuted, fontFamily: 'monospace' }}>
              {title}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {(data.totalCount != null || data.connections?.total != null) && (
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '10px', color: tokens.colors.textMuted, display: 'block', textTransform: 'uppercase' }}>Connections</span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: tokens.colors.textPrimary }}>
                {data.idleCount ?? data.connections?.idle}/{data.totalCount ?? data.connections?.total} idle {(data.waitingCount ?? data.connections?.waiting) > 0 ? `(${(data.waitingCount ?? data.connections?.waiting)} wait)` : ''}
              </span>
            </div>
          )}
          <StatusPill status={status} />
        </div>
      </div>

      {/* Row Count Metrics Grid (if available) */}
      {rowCounts && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px',
          paddingTop: '10px', borderTop: `1px solid ${tokens.colors.borderSubtle}`
        }}>
          {Object.entries(rowCounts).map(([key, val]) => (
            <div key={key} style={{
              padding: '6px 10px', borderRadius: '6px',
              backgroundColor: tokens.colors.surfaceElevated,
              border: `1px solid ${tokens.colors.borderSubtle}`,
            }}>
              <span style={{ fontSize: '10px', color: tokens.colors.textMuted, textTransform: 'uppercase', display: 'block' }}>
                {key.replace('_', ' ')}
              </span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: tokens.colors.textPrimary }}>
                {val.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Inline Error Banner */}
      {data.error && (
        <div style={{
          padding: '8px 12px', borderRadius: '6px',
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          fontSize: '12px', color: '#F87171', fontFamily: 'monospace',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <AlertTriangle size={14} />
          <span>{data.error}</span>
        </div>
      )}
    </div>
  );
}

function JobQueueTable({ backgroundJobs, jobsObj }) {
  if (!backgroundJobs && !jobsObj) return null;

  const queueList = backgroundJobs || [
    {
      queue: 'Email Dispatch Queue',
      pending: jobsObj?.emailQueue?.pending || 0,
      processing: jobsObj?.emailQueue?.processing || 0,
      failed: jobsObj?.emailQueue?.failed || 0,
      completed: jobsObj?.emailQueue?.completed || 0,
    },
    {
      queue: 'Email Campaign Queue',
      pending: jobsObj?.campaignSender?.scheduled_count || 0,
      processing: jobsObj?.campaignSender?.sending_count || 0,
      failed: 0,
      completed: 0,
    },
    {
      queue: 'Email Digest Queue',
      pending: 0,
      processing: 0,
      failed: 0,
      completed: jobsObj?.digestSender?.subscribed_count || 0,
    },
  ];

  return (
    <div style={{
      backgroundColor: tokens.colors.surfaceElevated,
      borderRadius: '12px',
      border: `1px solid ${tokens.colors.borderSubtle}`,
      overflow: 'hidden',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
        <thead>
          <tr style={{ backgroundColor: tokens.colors.bgDark, borderBottom: `1px solid ${tokens.colors.borderSubtle}` }}>
            <th style={{ padding: '12px 20px', color: tokens.colors.textMuted, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Queue Name</th>
            <th style={{ padding: '12px 20px', color: tokens.colors.textMuted, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pending</th>
            <th style={{ padding: '12px 20px', color: tokens.colors.textMuted, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Processing</th>
            <th style={{ padding: '12px 20px', color: tokens.colors.textMuted, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Failed</th>
            <th style={{ padding: '12px 20px', color: tokens.colors.textMuted, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Completed</th>
            <th style={{ padding: '12px 20px', color: tokens.colors.textMuted, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {queueList.map((q, idx) => (
            <tr key={idx} style={{ borderBottom: idx < queueList.length - 1 ? `1px solid ${tokens.colors.borderSubtle}` : 'none' }}>
              <td style={{ padding: '14px 20px', fontWeight: 600, color: tokens.colors.textPrimary, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Mail size={16} color={tokens.colors.primary} />
                {q.queue}
              </td>
              <td style={{ padding: '14px 20px', color: q.pending > 0 ? '#FBBF24' : tokens.colors.textSecondary, fontWeight: q.pending > 0 ? '700' : '400' }}>
                {q.pending ?? 0}
              </td>
              <td style={{ padding: '14px 20px', color: q.processing > 0 ? '#A78BFA' : tokens.colors.textSecondary, fontWeight: q.processing > 0 ? '700' : '400' }}>
                {q.processing ?? 0}
              </td>
              <td style={{ padding: '14px 20px', color: q.failed > 0 ? '#F87171' : tokens.colors.textSecondary, fontWeight: q.failed > 0 ? '700' : '400' }}>
                {q.failed ?? 0}
              </td>
              <td style={{ padding: '14px 20px', color: '#34D399', fontWeight: '600' }}>
                {q.completed ?? 0}
              </td>
              <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                <StatusPill status={q.failed > 0 ? 'degraded' : (q.processing > 0 ? 'sending' : 'active')} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatUptime(seconds) {
  if (!seconds || isNaN(seconds)) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return '—';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(1)} MB`;
}

export default function SystemStatusPage() {
  const router = useRouter();
  const [adminUser, setAdminUser] = useState(null);
  const [statusData, setStatusData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const refreshTimer = useRef(null);

  const apiUrl = process.env.NEXT_PUBLIC_MANAGE_API_URL || 'http://localhost:4000';

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch(`${apiUrl}/admin/auth/me`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAdminUser(data.admin_user);
      } else {
        router.push('/root/login');
      }
    } catch {
      router.push('/root/login');
    }
  };

  const fetchStatus = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`${apiUrl}/admin/system-status`, { credentials: 'include' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setStatusData(data);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    if (adminUser) {
      fetchStatus();
    }
  }, [adminUser, fetchStatus]);

  // Auto-refresh timer (10s interval)
  useEffect(() => {
    if (autoRefresh && adminUser) {
      refreshTimer.current = setInterval(fetchStatus, AUTO_REFRESH_INTERVAL);
    }
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [autoRefresh, adminUser, fetchStatus]);

  const handleLogout = async () => {
    await fetch(`${apiUrl}/admin/auth/logout`, { method: 'POST', credentials: 'include' });
    router.push('/root/login');
  };

  const overallStatus = statusData?.overall_status || 'unknown';

  // Helper extraction supporting both array and object formats
  const mainBackendData = Array.isArray(statusData?.services)
    ? statusData.services.find(s => s.id === 'main_backend' || s.name?.includes('Main'))
    : statusData?.services_map?.main_backend || statusData?.services?.main_backend;

  const manageBackendData = Array.isArray(statusData?.services)
    ? statusData.services.find(s => s.id === 'manage_backend' || s.name?.includes('Manage'))
    : statusData?.services_map?.manage_backend || statusData?.services?.manage_backend;

  const grpcBridgeData = Array.isArray(statusData?.services)
    ? statusData.services.find(s => s.id === 'grpc_bridge' || s.name?.includes('gRPC'))
    : statusData?.services_map?.grpc_bridge || statusData?.services?.grpc_bridge;

  const manageDbData = Array.isArray(statusData?.databases)
    ? statusData.databases.find(d => d.id === 'manage_db' || d.name?.includes('Admin'))
    : statusData?.databases_map?.manage_db || statusData?.databases?.manage_db;

  const socialDbData = Array.isArray(statusData?.databases)
    ? statusData.databases.find(d => d.id === 'main_social_db' || d.name?.includes('Social'))
    : statusData?.databases_map?.main_social_db || statusData?.databases?.main_social_db;

  const contentDbData = Array.isArray(statusData?.databases)
    ? statusData.databases.find(d => d.id === 'main_content_db' || d.name?.includes('Content'))
    : statusData?.databases_map?.main_content_db || statusData?.databases?.main_content_db;

  const redisData = Array.isArray(statusData?.databases)
    ? statusData.databases.find(d => d.id === 'main_redis' || d.name?.includes('Redis'))
    : statusData?.databases_map?.main_redis || statusData?.databases?.main_redis;

  const backgroundJobsList = Array.isArray(statusData?.background_jobs) ? statusData.background_jobs : null;

  return (
    <AdminShell
      adminUser={adminUser}
      activeTab="system-status"
      onTabChange={(tab) => router.push(`/${tab}`)}
      onLogout={handleLogout}
      breadcrumb={['Administration', 'System Status']}
    >
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
      `}</style>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '16px 0' }}>
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: tokens.colors.textPrimary, margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
              System Status
            </h1>
            <p style={{ fontSize: '13px', color: tokens.colors.textSecondary, margin: 0 }}>
              Real-time health telemetry across CPA services, databases, background workers, and memory usage.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {lastRefresh && (
              <span style={{ fontSize: '11px', color: tokens.colors.textMuted, fontFamily: 'monospace' }}>
                Updated {lastRefresh.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              style={{
                padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                border: `1px solid ${autoRefresh ? 'rgba(52, 211, 153, 0.4)' : tokens.colors.borderSubtle}`,
                backgroundColor: autoRefresh ? 'rgba(52, 211, 153, 0.12)' : 'transparent',
                color: autoRefresh ? '#34D399' : tokens.colors.textMuted,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              {autoRefresh ? <Wifi size={13} /> : <WifiOff size={13} />}
              {autoRefresh ? 'Auto (10s)' : 'Paused'}
            </button>
            <button
              onClick={() => { setLoading(true); fetchStatus(); }}
              style={{
                padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                backgroundColor: tokens.colors.primary, color: '#fff', border: 'none',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                boxShadow: `0 0 12px ${tokens.colors.primaryGlow}`,
                transition: 'all 0.15s ease',
              }}
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
              Refresh Now
            </button>
          </div>
        </div>

        {/* ── Overall Status Banner ─────────────────────────────────── */}
        {statusData && (
          <div style={{
            padding: '18px 24px',
            borderRadius: '12px',
            border: `1px solid ${overallStatus === 'operational' ? 'rgba(52, 211, 153, 0.3)' : 'rgba(251, 191, 36, 0.3)'}`,
            backgroundColor: overallStatus === 'operational' ? 'rgba(52, 211, 153, 0.08)' : 'rgba(251, 191, 36, 0.08)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: '28px', flexWrap: 'wrap', gap: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {overallStatus === 'operational'
                ? <CheckCircle2 size={24} color="#34D399" />
                : <AlertTriangle size={24} color="#FBBF24" />
              }
              <div>
                <span style={{ fontSize: '15px', fontWeight: 700, color: tokens.colors.textPrimary, display: 'block' }}>
                  {overallStatus === 'operational' ? 'All Core Systems Operational' : `System Telemetry: ${overallStatus.toUpperCase()}`}
                </span>
                <span style={{ fontSize: '11px', color: tokens.colors.textMuted }}>
                  Aggregated telemetry across Main API, Admin API, gRPC Bridge, Databases, and Job Queue.
                </span>
              </div>
            </div>
            <StatusPill status={overallStatus} />
          </div>
        )}

        {/* ── Global Error Banner ──────────────────────────────────────── */}
        {error && (
          <div style={{
            padding: '14px 20px', borderRadius: '12px', marginBottom: '24px',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <XCircle size={20} color="#F87171" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#F87171' }}>
                System Telemetry Alert
              </div>
              <div style={{ fontSize: '12px', color: '#FCA5A5' }}>
                {error} — ensure CPA/backend and cpa-manage backend services are running.
              </div>
            </div>
          </div>
        )}

        {/* ── System Resources / Memory & Uptime Banner ─────────────── */}
        {statusData?.system && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '12px', marginBottom: '28px',
          }}>
            <MetricChip
              label="Process Uptime"
              value={formatUptime(statusData.system.process_uptime)}
              subtext="cpa-manage backend"
            />
            <MetricChip
              label="Process RSS Memory"
              value={formatBytes(statusData.system.memory?.rss)}
              subtext="Resident set size"
            />
            <MetricChip
              label="Heap Memory Used"
              value={`${formatBytes(statusData.system.memory?.heapUsed)} / ${formatBytes(statusData.system.memory?.heapTotal)}`}
              subtext="V8 engine heap"
            />
            <MetricChip
              label="OS Free Memory"
              value={`${formatBytes(statusData.system.memory?.systemFree)} / ${formatBytes(statusData.system.memory?.systemTotal)}`}
              subtext="Host environment"
            />
          </div>
        )}

        {/* ── Section 1: Services ─────────────────────────────────────── */}
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{
            fontSize: '11px', fontWeight: 700, color: tokens.colors.textMuted,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <Server size={14} color={tokens.colors.primary} />
            Services Status
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
            {loading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : (
              <>
                <ServiceCard
                  title="Main Backend (CPA API)"
                  icon={Server}
                  subtitle="http://localhost:3001/healthz"
                  data={mainBackendData}
                />
                <ServiceCard
                  title="Manage Backend (Admin API)"
                  icon={Cpu}
                  subtitle="http://localhost:4000/healthz"
                  data={manageBackendData}
                />
                <ServiceCard
                  title="gRPC Inter-Service Bridge"
                  icon={Radio}
                  subtitle="Port 50052 (gRPC ContentActions)"
                  data={grpcBridgeData}
                />
              </>
            )}
          </div>
        </div>

        {/* ── Section 2: Databases ────────────────────────────────────── */}
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{
            fontSize: '11px', fontWeight: 700, color: tokens.colors.textMuted,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <Database size={14} color={tokens.colors.primary} />
            Databases & Infrastructure
          </h2>

          <div style={{
            display: 'flex', flexDirection: 'column', gap: '12px',
          }}>
            {loading ? (
              <SkeletonCard />
            ) : (
              <>
                <DatabaseCard title="manage_db" data={manageDbData} />
                <DatabaseCard title="social_db" data={socialDbData} />
                <DatabaseCard title="content_db" data={contentDbData} />
                <DatabaseCard title="redis_cache" data={redisData} />
              </>
            )}
          </div>
        </div>

        {/* ── Section 3: Background Jobs ────────────────────────────── */}
        <div>
          <h2 style={{
            fontSize: '11px', fontWeight: 700, color: tokens.colors.textMuted,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <Zap size={14} color={tokens.colors.primary} />
            Background Jobs & Queue Metrics
          </h2>

          {loading ? (
            <SkeletonCard />
          ) : (
            <JobQueueTable backgroundJobs={backgroundJobsList} jobsObj={statusData?.jobs} />
          )}
        </div>
      </div>
    </AdminShell>
  );
}
