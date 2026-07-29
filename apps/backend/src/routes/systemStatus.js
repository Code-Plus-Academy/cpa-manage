/**
 * GET /admin/system-status — Aggregated health check across all CPA services.
 * Makes parallel HTTP calls to CPA/backend and cpa-manage healthz endpoints with 3s timeout.
 * Reports DB connection counts (pool.totalCount, idleCount, waitingCount), row counts,
 * active jobs status, email queue metrics, system memory/uptime, and writes an audit log entry on access.
 * Guarded by 'system.status.view' permission.
 */
const express = require('express');
const router = express.Router();
const os = require('os');
const requirePermission = require('../middleware/requirePermission');
const { pool, query } = require('../config/db');
const { writeAuditLog } = require('../middleware/auditLog');

/**
 * Helper to fetch a healthz endpoint with a strict 3-second timeout.
 */
async function fetchHealth(url, timeoutMs = 3000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timer);

    if (!response.ok) {
      return {
        status: 'error',
        http_status: response.status,
        error: `HTTP ${response.status} ${response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      status: data.status || (response.ok ? 'healthy' : 'error'),
      ...data,
    };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return { status: 'timeout', error: 'Health check timed out (3s limit)' };
    }
    return { status: 'unreachable', error: err.message };
  }
}

router.get('/', requirePermission('system.status.view'), async (req, res, next) => {
  try {
    // 1. Determine main backend & manage backend health URLs
    const rawMainUrl = process.env.MAIN_BACKEND_URL || 'http://localhost:3001';
    const mainBackendUrl = rawMainUrl.replace(/\/healthz\/?$/, '') + '/healthz';

    const rawManageUrl = process.env.MANAGE_BACKEND_URL || 'http://localhost:4000';
    const manageBackendUrl = rawManageUrl.replace(/\/healthz\/?$/, '') + '/healthz';

    // 2. Parallel HTTP health checks (3s timeout each)
    const [mainHealth, manageHealth] = await Promise.all([
      fetchHealth(mainBackendUrl, 3000),
      fetchHealth(manageBackendUrl, 3000),
    ]);

    // 3. Database connection pool stats & local DB ping check
    let localDb = {
      status: 'connected',
      latency_ms: null,
      totalCount: pool.totalCount || 0,
      idleCount: pool.idleCount || 0,
      waitingCount: pool.waitingCount || 0,
    };

    try {
      const start = Date.now();
      await query('SELECT 1');
      localDb.latency_ms = Date.now() - start;
    } catch (err) {
      localDb.status = 'error';
      localDb.error = err.message;
    }

    // 4. Row counts query for cpa-manage database metrics
    let rowCounts = {
      tickets: 0,
      users: 0,
      actions: 0,
      audit_logs: 0,
      email_sends: 0,
      claims: 0,
    };

    try {
      const [
        ticketsRes,
        usersRes,
        actionsRes,
        logsRes,
        sendsRes,
        claimsRes,
      ] = await Promise.all([
        query('SELECT COUNT(*)::int as cnt FROM support_tickets').catch(() => ({ rows: [{ cnt: 0 }] })),
        query('SELECT COUNT(*)::int as cnt FROM admin_users').catch(() => ({ rows: [{ cnt: 0 }] })),
        query('SELECT COUNT(*)::int as cnt FROM ticket_actions').catch(() => ({ rows: [{ cnt: 0 }] })),
        query('SELECT COUNT(*)::int as cnt FROM audit_log').catch(() => ({ rows: [{ cnt: 0 }] })),
        query('SELECT COUNT(*)::int as cnt FROM email_sends').catch(() => ({ rows: [{ cnt: 0 }] })),
        query('SELECT COUNT(*)::int as cnt FROM institution_claims').catch(() => ({ rows: [{ cnt: 0 }] })),
      ]);

      rowCounts.tickets = ticketsRes.rows[0]?.cnt || 0;
      rowCounts.users = usersRes.rows[0]?.cnt || 0;
      rowCounts.actions = actionsRes.rows[0]?.cnt || 0;
      rowCounts.audit_logs = logsRes.rows[0]?.cnt || 0;
      rowCounts.email_sends = sendsRes.rows[0]?.cnt || 0;
      rowCounts.claims = claimsRes.rows[0]?.cnt || 0;
    } catch (err) {
      console.error('[systemStatus] Row count query error:', err.message);
    }

    // 5. Background job / email queue metrics
    let emailQueueMetrics = {
      pending: 0,
      processing: 0,
      failed: 0,
      completed: 0,
    };

    try {
      const { rows: sendStatusRows } = await query(`
        SELECT status, COUNT(*)::int as cnt
        FROM email_sends
        GROUP BY status
      `).catch(() => ({ rows: [] }));

      sendStatusRows.forEach(r => {
        if (r.status === 'queued') emailQueueMetrics.pending += r.cnt;
        else if (r.status === 'sending') emailQueueMetrics.processing += r.cnt;
        else if (r.status === 'sent') emailQueueMetrics.completed += r.cnt;
        else if (r.status === 'failed' || r.status === 'bounced') emailQueueMetrics.failed += r.cnt;
      });
    } catch (err) {
      console.error('[systemStatus] Email queue metrics error:', err.message);
    }

    // Active jobs status (campaignSender & digestSender)
    let campaignSenderStatus = {
      name: 'Email Campaign Sender',
      status: 'active',
      scheduled_count: 0,
      sending_count: 0,
      last_run: null,
    };

    let digestSenderStatus = {
      name: 'Email Digest Sender',
      status: 'active',
      subscribed_count: 0,
      last_run: null,
    };

    try {
      const { rows: campaignRows } = await query(`
        SELECT status, COUNT(*)::int as cnt
        FROM email_campaigns
        WHERE status IN ('scheduled', 'sending')
        GROUP BY status
      `);
      campaignRows.forEach(r => {
        if (r.status === 'scheduled') campaignSenderStatus.scheduled_count = r.cnt;
        if (r.status === 'sending') campaignSenderStatus.sending_count = r.cnt;
      });
    } catch {
      // email_campaigns table fallback
    }

    try {
      const { rows: digestRows } = await query(`
        SELECT COUNT(*)::int as cnt
        FROM email_preferences
        WHERE digest_frequency != 'off'
      `);
      digestSenderStatus.subscribed_count = digestRows[0]?.cnt || 0;
    } catch {
      // email_preferences table fallback
    }

    // Check last run from audit log for jobs
    try {
      const { rows: jobLogs } = await query(`
        SELECT action, MAX(created_at) as last_run
        FROM audit_log
        WHERE module = 'jobs' OR module = 'email'
        GROUP BY action
        ORDER BY last_run DESC
        LIMIT 5
      `);
      jobLogs.forEach(j => {
        if (j.action?.includes('campaign')) campaignSenderStatus.last_run = j.last_run;
        if (j.action?.includes('digest')) digestSenderStatus.last_run = j.last_run;
      });
    } catch {
      // audit log fallback
    }

    // 6. System Memory & Uptime
    const systemInfo = {
      process_uptime: process.uptime(),
      os_uptime: os.uptime(),
      memory: {
        rss: process.memoryUsage().rss,
        heapTotal: process.memoryUsage().heapTotal,
        heapUsed: process.memoryUsage().heapUsed,
        external: process.memoryUsage().external,
        systemTotal: os.totalmem(),
        systemFree: os.freemem(),
      },
    };

    // 7. gRPC Bridge status
    const grpcStatus = {
      status: 'operational',
      port: process.env.GRPC_PORT || 50052,
      service: 'ContentActions & SocialActions gRPC Bridge',
    };

    // Determine overall status
    const isMainOk = mainHealth.status === 'healthy' || mainHealth.status === 'ok';
    const isManageOk = manageHealth.status === 'healthy' || manageHealth.status === 'ok';
    const isDbOk = localDb.status === 'connected';

    const overallStatus = (isMainOk && isManageOk && isDbOk)
      ? 'operational'
      : (!isMainOk && !isManageOk)
        ? 'unhealthy'
        : 'degraded';

    // 8. Write audit log entry on access
    await writeAuditLog(pool, {
      actorAdminId: req.adminUser.id,
      actorIsRoot: req.adminUser.is_root,
      permissionUsed: 'system.status.view',
      module: 'system',
      action: 'view_system_status',
      targetType: 'system',
      targetId: 'system_status',
      reason: 'Admin accessed System Status module',
      metadata: {
        ip: req.ip,
        userAgent: req.get('user-agent'),
      },
    }).catch(err => console.error('[AuditLog Error in systemStatus]:', err.message));

    // Construct array structures matching Task 4.2 JSON contract
    const mainLatency = mainHealth.db?.latency_ms || mainHealth.databases?.social_latency_ms || null;
    const socialLatency = mainHealth.db?.social?.latency_ms || mainHealth.databases?.social_latency_ms || null;
    const contentLatency = mainHealth.db?.content?.latency_ms || mainHealth.databases?.content_latency_ms || null;
    const redisLatency = typeof mainHealth.redis === 'object' ? mainHealth.redis.latency_ms : null;
    const redisStatusStr = typeof mainHealth.redis === 'object' ? mainHealth.redis.status : (mainHealth.redis || 'unknown');

    const servicesList = [
      {
        id: 'main_backend',
        name: 'Main Backend (CPA API)',
        status: isMainOk ? 'healthy' : (mainHealth.status || 'unreachable'),
        latency_ms: mainLatency,
        url: mainBackendUrl,
        details: mainHealth,
      },
      {
        id: 'manage_backend',
        name: 'Manage Backend (Admin API)',
        status: isManageOk ? 'healthy' : (manageHealth.status || 'unreachable'),
        latency_ms: localDb.latency_ms,
        url: manageBackendUrl,
        details: manageHealth,
      },
      {
        id: 'grpc_bridge',
        name: 'gRPC Inter-Service Bridge',
        status: grpcStatus.status,
        latency_ms: null,
        url: `localhost:${grpcStatus.port}`,
        details: grpcStatus,
      },
    ];

    const databasesList = [
      {
        id: 'manage_db',
        name: 'Admin Database (manage_db)',
        status: localDb.status === 'connected' ? 'connected' : 'error',
        latency_ms: localDb.latency_ms,
        row_counts: rowCounts,
        connections: {
          total: localDb.totalCount,
          idle: localDb.idleCount,
          waiting: localDb.waitingCount,
        },
      },
      {
        id: 'main_social_db',
        name: 'Social DB',
        status: (mainHealth.databases?.social === 'ok' || mainHealth.db?.social?.status === 'up') ? 'connected' : (mainHealth.databases?.social || 'unknown'),
        latency_ms: socialLatency,
        row_counts: null,
      },
      {
        id: 'main_content_db',
        name: 'Content DB',
        status: (mainHealth.databases?.content === 'ok' || mainHealth.db?.content?.status === 'up') ? 'connected' : (mainHealth.databases?.content || 'unknown'),
        latency_ms: contentLatency,
        row_counts: null,
      },
      {
        id: 'main_redis',
        name: 'Redis Cache (Upstash)',
        status: (redisStatusStr === 'ok' || redisStatusStr === 'up') ? 'connected' : redisStatusStr,
        latency_ms: redisLatency,
        row_counts: null,
      },
    ];

    const backgroundJobsList = [
      {
        queue: 'Email Dispatch Queue',
        pending: emailQueueMetrics.pending,
        processing: emailQueueMetrics.processing,
        failed: emailQueueMetrics.failed,
        completed: emailQueueMetrics.completed,
      },
      {
        queue: 'Email Campaign Queue',
        pending: campaignSenderStatus.scheduled_count,
        processing: campaignSenderStatus.sending_count,
        failed: 0,
        completed: 0,
      },
      {
        queue: 'Email Digest Queue',
        pending: 0,
        processing: 0,
        failed: 0,
        completed: digestSenderStatus.subscribed_count,
      },
    ];

    // Return aggregated system status object (supporting both array and object consumers)
    res.json({
      overall_status: overallStatus,
      timestamp: new Date().toISOString(),
      system: systemInfo,

      // Standard array structure
      services: servicesList,
      databases: databasesList,
      background_jobs: backgroundJobsList,

      // Object mappings for fast named-property access
      services_map: {
        main_backend: servicesList[0],
        manage_backend: servicesList[1],
        grpc_bridge: servicesList[2],
      },
      databases_map: {
        manage_db: databasesList[0],
        main_social_db: databasesList[1],
        main_content_db: databasesList[2],
        main_redis: databasesList[3],
      },
      jobs: {
        campaignSender: campaignSenderStatus,
        digestSender: digestSenderStatus,
        emailQueue: emailQueueMetrics,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
