import Redis from "ioredis";
import { env } from "./env";

class MemoryCacheFallback {
  private store = new Map<string, { value: string; expiresAt?: number }>();

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

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

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  async incr(key: string): Promise<number> {
    const current = await this.get(key);
    const num = current ? parseInt(current, 10) + 1 : 1;
    this.store.set(key, { value: num.toString() });
    return num;
  }

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

  redisClient.on("error", (err) => {
    isRedisConnected = false;
    // Suppress unhandled redis error spam
  });
} catch (err: any) {
  isRedisConnected = false;
  console.warn("[Redis] Initialization failed, using memory fallback:", err.message);
}

export const cache = {
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
        // Fallback
      }
    }
    await memoryFallback.set(key, value, ttlSeconds ? "EX" : undefined, ttlSeconds);
  },

  async del(key: string): Promise<void> {
    if (isRedisConnected && redisClient) {
      try {
        await redisClient.del(key);
        return;
      } catch {
        // Fallback
      }
    }
    await memoryFallback.del(key);
  },

  async incr(key: string, ttlSeconds?: number): Promise<number> {
    if (isRedisConnected && redisClient) {
      try {
        const val = await redisClient.incr(key);
        if (val === 1 && ttlSeconds) {
          await redisClient.expire(key, ttlSeconds);
        }
        return val;
      } catch {
        // Fallback
      }
    }
    const val = await memoryFallback.incr(key);
    if (val === 1 && ttlSeconds) {
      await memoryFallback.expire(key, ttlSeconds);
    }
    return val;
  },
};
