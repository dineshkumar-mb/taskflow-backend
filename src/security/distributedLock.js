const crypto = require('crypto');
const { getRedisClient, isRedisAvailable } = require('../config/redis');

// In-memory fallback lock map for local dev when Redis is not running
const fallbackLocks = new Map();

/**
 * Distributed Lock Utility using Redis + Lua Scripts
 */
class DistributedLock {
    /**
     * Attempts to acquire an atomic distributed lock.
     * @param {string} resourceKey - Unique identifier for the locked resource
     * @param {number} ttlMs - Time to live in milliseconds (default 30 seconds)
     * @returns {Promise<{ acquired: boolean, lockToken: string | null }>}
     */
    static async acquireLock(resourceKey, ttlMs = 30000) {
        const lockToken = crypto.randomUUID();
        const fullKey = `lock:${resourceKey}`;

        if (isRedisAvailable()) {
            try {
                const redis = getRedisClient();
                // SET key token PX ttl NX -> Atomic acquisition only if Not eXists
                const result = await redis.set(fullKey, lockToken, 'PX', ttlMs, 'NX');
                if (result === 'OK') {
                    return { acquired: true, lockToken };
                }
                return { acquired: false, lockToken: null };
            } catch (err) {
                console.warn('[DistributedLock Warning] Redis lock acquire failed:', err.message);
            }
        }

        // Graceful in-memory fallback
        const existing = fallbackLocks.get(fullKey);
        const now = Date.now();
        if (existing && existing.expiresAt > now) {
            return { acquired: false, lockToken: null };
        }

        fallbackLocks.set(fullKey, {
            token: lockToken,
            expiresAt: now + ttlMs
        });
        return { acquired: true, lockToken };
    }

    /**
     * Releases an acquired lock atomically using a Lua script to prevent
     * releasing someone else's expired lock.
     * @param {string} resourceKey - The resource identifier
     * @param {string} lockToken - The token received when acquiring the lock
     * @returns {Promise<boolean>}
     */
    static async releaseLock(resourceKey, lockToken) {
        if (!lockToken) return false;
        const fullKey = `lock:${resourceKey}`;

        if (isRedisAvailable()) {
            try {
                const redis = getRedisClient();
                // Lua script: only delete if the value stored in key matches the lockToken
                const luaScript = `
                    if redis.call("get", KEYS[1]) == ARGV[1] then
                        return redis.call("del", KEYS[1])
                    else
                        return 0
                    end
                `;
                const result = await redis.eval(luaScript, 1, fullKey, lockToken);
                return result === 1;
            } catch (err) {
                console.warn('[DistributedLock Warning] Redis lock release failed:', err.message);
            }
        }

        // Fallback release
        const current = fallbackLocks.get(fullKey);
        if (current && current.token === lockToken) {
            fallbackLocks.delete(fullKey);
            return true;
        }
        return false;
    }

    /**
     * Executes a function with an acquired distributed lock, automatically releasing it when done.
     */
    static async withLock(resourceKey, fn, ttlMs = 30000) {
        const { acquired, lockToken } = await this.acquireLock(resourceKey, ttlMs);
        if (!acquired) {
            throw new Error(`Failed to acquire lock for resource: ${resourceKey}. Another process is currently executing this operation.`);
        }

        try {
            return await fn();
        } finally {
            await this.releaseLock(resourceKey, lockToken);
        }
    }
}

module.exports = DistributedLock;
