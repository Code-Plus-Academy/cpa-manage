/**
 * cpa-manage/apps/backend/src/lib/redis.js
 * Redis Cache Helper — uses Upstash REST API via plain fetch() (zero dependencies)
 */

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function upstashCommand(...args) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    console.warn('[Redis] UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set — skipping Redis operation');
    return null;
  }
  try {
    const resp = await fetch(UPSTASH_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      console.error(`[Redis] Upstash REST error (${resp.status}):`, errText);
      return null;
    }
    const data = await resp.json();
    if (data.error) {
      console.error('[Redis] Upstash command error:', data.error);
      return null;
    }
    return data.result;
  } catch (e) {
    console.error('[Redis] Upstash fetch error:', e.message);
    return null;
  }
}

async function cacheDel(...keys) {
  if (!keys || !keys.length) return;
  try {
    const result = await upstashCommand('DEL', ...keys);
    if (result !== null) {
      console.log(`[Redis] Invalidated cache keys: ${keys.join(', ')}`);
    }
  } catch (e) {
    console.error('[Redis cacheDel Error]:', e.message);
  }
}

async function cacheSet(key, value, ttl = 86400) {
  try {
    const result = await upstashCommand('SET', key, value, 'EX', ttl);
    if (result !== null) {
      console.log(`[Redis] Set cache key: ${key} (TTL: ${ttl}s)`);
    }
  } catch (e) {
    console.error('[Redis cacheSet Error]:', e.message);
  }
}

async function cacheGet(key) {
  try {
    return await upstashCommand('GET', key);
  } catch (e) {
    console.error('[Redis cacheGet Error]:', e.message);
    return null;
  }
}

module.exports = { cacheDel, cacheSet, cacheGet };

