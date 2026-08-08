/**
 * cpa-manage/apps/backend/src/lib/redis.js
 * Redis Cache Invalidation Helper
 */
let _upstashRedis = null;

function getUpstashRedis() {
  if (_upstashRedis) return _upstashRedis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const { Redis } = require('@upstash/redis');
    _upstashRedis = new Redis({ url, token });
  } catch (err) {
    // If @upstash/redis is not installed, fallback gracefully
  }
  return _upstashRedis;
}

let _ioRedis = null;
function getIoRedis() {
  if (_ioRedis) return _ioRedis;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;
  try {
    const RedisIO = require('ioredis');
    _ioRedis = new RedisIO(redisUrl);
  } catch (err) {
    // fallback
  }
  return _ioRedis;
}

async function cacheDel(...keys) {
  if (!keys || !keys.length) return;
  try {
    const upstash = getUpstashRedis();
    if (upstash) {
      await upstash.del(...keys);
      console.log(`[Redis] Invalidated cache keys in Upstash: ${keys.join(', ')}`);
      return;
    }
    const io = getIoRedis();
    if (io) {
      await io.del(...keys);
      console.log(`[Redis] Invalidated cache keys in ioredis: ${keys.join(', ')}`);
      return;
    }
  } catch (e) {
    console.error('[Redis cacheDel Error]:', e.message);
  }
}

async function cacheSet(key, value, ttl = 86400) {
  try {
    const upstash = getUpstashRedis();
    if (upstash) {
      await upstash.set(key, value, { ex: ttl });
      console.log(`[Redis] Set cache key in Upstash: ${key}`);
      return;
    }
    const io = getIoRedis();
    if (io) {
      await io.set(key, value, 'EX', ttl);
      console.log(`[Redis] Set cache key in ioredis: ${key}`);
      return;
    }
  } catch (e) {
    console.error('[Redis cacheSet Error]:', e.message);
  }
}

module.exports = { cacheDel, cacheSet };
