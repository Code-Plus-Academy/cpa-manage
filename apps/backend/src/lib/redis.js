/**
 * cpa-manage/apps/backend/src/lib/redis.js
 * Dual-driver Redis Client (ioredis TCP for Redis.io + fetch REST for Upstash)
 */

let _ioClient = null;

function getIoRedis() {
  const tcpUrl = process.env.EMAIL_REDIS_URL || process.env.REDIS_URL;
  if (!tcpUrl) return null;
  if (!_ioClient) {
    try {
      const IORedis = require('ioredis');
      _ioClient = new IORedis(tcpUrl, { maxRetriesPerRequest: null, retryStrategy: () => null });
    } catch (e) {
      console.error('[Redis ioredis error]:', e.message);
      return null;
    }
  }
  return _ioClient;
}

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function upstashCommand(...args) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
  try {
    const resp = await fetch(UPSTASH_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.error ? null : data.result;
  } catch (e) {
    return null;
  }
}

async function cacheDel(...keys) {
  if (!keys || !keys.length) return;
  try {
    const io = getIoRedis();
    if (io) {
      await io.del(...keys);
      console.log(`[Redis.io] Invalidated cache keys: ${keys.join(', ')}`);
      return;
    }
    const result = await upstashCommand('DEL', ...keys);
    if (result !== null) {
      console.log(`[Upstash] Invalidated cache keys: ${keys.join(', ')}`);
    }
  } catch (e) {
    console.error('[Redis cacheDel Error]:', e.message);
  }
}

async function cacheSet(key, value, ttl = 86400) {
  try {
    const io = getIoRedis();
    if (io) {
      await io.set(key, value, 'EX', ttl);
      console.log(`[Redis.io] Set cache key: ${key} (TTL: ${ttl}s)`);
      return;
    }
    const result = await upstashCommand('SET', key, value, 'EX', ttl);
    if (result !== null) {
      console.log(`[Upstash] Set cache key: ${key} (TTL: ${ttl}s)`);
    }
  } catch (e) {
    console.error('[Redis cacheSet Error]:', e.message);
  }
}

async function cacheGet(key) {
  try {
    const io = getIoRedis();
    if (io) {
      return await io.get(key);
    }
    return await upstashCommand('GET', key);
  } catch (e) {
    console.error('[Redis cacheGet Error]:', e.message);
    return null;
  }
}

module.exports = { cacheDel, cacheSet, cacheGet };

