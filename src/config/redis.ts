import Redis from "ioredis";
import { env } from "./env";

/**
 * In-process key-value store with TTL support used transparently when Redis is unreachable,
 * ensuring rate limiting and token version checks remain functional during cache outages.
 */
class MemoryCacheFallback {
  private store = new Map<string, { value: string; expiresAt?: number }>();

  /**
   * Retrieves a cached string by key, evicting the entry on the fly if its TTL has elapsed.
   */
  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  /**
   * Stores a string value with optional expiration in seconds (`EX`) or milliseconds (`PX`).
   */
  async set(key: string, value: string, mode?: string, duration?: number): Promise<string> {
    let expiresAt: number | undefined;
    if (mode === "EX" && typeof duration === "number") {
      expiresAt = Date.now() + duration * 1000;
    } else if (mode === "PX" && typeof duration === "number") {
      expiresAt = Date.now() + duration;
    }
    this.store.set(key, { value, expiresAt });
    return "OK";
  }

  /**
   * Removes a key from the in-memory store.
   */
  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  /**
   * Atomically increments a numeric counter stored at `key`, initializing it to 1 if absent or expired.
   */
  async incr(key: string): Promise<number> {
    const current = await this.get(key);
    const num = current ? parseInt(current, 10) + 1 : 1;
    this.store.set(key, { value: num.toString() });
    return num;
  }

  /**
   * Assigns a time-to-live in seconds to an existing in-memory key.
   */
  async expire(key: string, seconds: number): Promise<number> {
    const item = this.store.get(key);
    if (!item) return 0;
    item.expiresAt = Date.now() + seconds * 1000;
    return 1;
  }
}

let redisClient: Redis | null = null;
const memoryFallback = new MemoryCacheFallback();
let isRedisConnected = false;

try {
  redisClient = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      if (times > 3) {
        return null;
      }
      return Math.min(times * 100, 2000);
    },
    lazyConnect: true,
  });

  redisClient.connect().then(() => {
    isRedisConnected = true;
    console.log("[Redis] Connected successfully to:", env.REDIS_URL);
  }).catch((err) => {
    isRedisConnected = false;
    console.warn("[Redis] Could not connect to Redis server. Using in-memory fallback:", err.message);
  });

  redisClient.on("error", () => {
    isRedisConnected = false;
  });
} catch (err: any) {
  isRedisConnected = false;
  console.warn("[Redis] Initialization failed, using memory fallback:", err.message);
}

/**
 * Resilient cache adapter that routes operations to Redis when connected and
 * degrades gracefully to `MemoryCacheFallback` on connection failure.
 */
export const cache = {
  /**
   * Reads a cached value from Redis, falling back to process memory if Redis is unavailable.
   */
  async get(key: string): Promise<string | null> {
    if (isRedisConnected && redisClient) {
      try {
        return await redisClient.get(key);
      } catch {
        return memoryFallback.get(key);
      }
    }
    return memoryFallback.get(key);
  },

  /**
   * Writes a value to cache with an optional TTL in seconds.
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (isRedisConnected && redisClient) {
      try {
        if (ttlSeconds) {
          await redisClient.set(key, value, "EX", ttlSeconds);
        } else {
          await redisClient.set(key, value);
        }
        return;
      } catch {
        // Degrade to memory store when Redis command fails.
      }
    }
    await memoryFallback.set(key, value, ttlSeconds ? "EX" : undefined, ttlSeconds);
  },

  /**
   * Deletes a key from both Redis (if connected) and the fallback store.
   */
  async del(key: string): Promise<void> {
    if (isRedisConnected && redisClient) {
      try {
        await redisClient.del(key);
        return;
      } catch {
        // Degrade to memory store when Redis command fails.
      }
    }
    await memoryFallback.del(key);
  },

  /**
   * Increments a counter and sets its expiration window on the first increment (`val === 1`).
   */
  async incr(key: string, ttlSeconds?: number): Promise<number> {
    if (isRedisConnected && redisClient) {
      try {
        const val = await redisClient.incr(key);
        if (val === 1 && ttlSeconds) {
          await redisClient.expire(key, ttlSeconds);
        }
        return val;
      } catch {
        // Degrade to memory store when Redis command fails.
      }
    }
    const val = await memoryFallback.incr(key);
    if (val === 1 && ttlSeconds) {
      await memoryFallback.expire(key, ttlSeconds);
    }
    return val;
  },
};
