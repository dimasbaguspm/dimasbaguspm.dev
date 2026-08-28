import Redis from "ioredis";
import { log } from "./otel";

const TTL_MS = 60_000;
const TTL_S = Math.max(1, Math.ceil(TTL_MS / 1000));
const PREFIX = "dbpm:";
const host = process.env.REDIS_HOST ?? "";

let redis: Redis | null = null;
let ready = false;

// Best-effort cache (Redis/Valkey, both speak RESP): when REDIS_HOST is unset
// or the connect fails we serve direct GitHub hits; ioredis auto-reconnects.
// ponytail: per-process state — fine single-instance, per-instance TTL drift
// if you ever run multiple replicas behind a load balancer.
if (host) {
  redis = new Redis(`redis://${host}`, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  let state = "down";
  redis.on("ready", () => {
    ready = true;
    if (state !== "up") {
      state = "up";
      log.info("cache: redis ready", { host });
    }
  });
  redis.on("error", (e) => {
    ready = false;
    if (state !== "down") {
      state = "down";
      log.warn("cache: redis unavailable — direct GitHub hits", {
        error: e.message,
      });
    }
  });
} else {
  log.warn("cache: REDIS_HOST unset — direct GitHub hits");
}

async function get<T>(key: string): Promise<T | undefined> {
  if (!redis || !ready) return undefined;
  try {
    const raw = await redis.get(PREFIX + key);
    return raw == null ? undefined : (JSON.parse(raw) as T);
  } catch (e) {
    log.warn("cache: read failed — direct hit", {
      key,
      error: (e as Error).message,
    });
    return undefined;
  }
}

async function set(key: string, data: unknown) {
  if (!redis || !ready) return;
  try {
    await redis.set(PREFIX + key, JSON.stringify(data), "EX", TTL_S);
  } catch (e) {
    log.warn("cache: write failed", { key, error: (e as Error).message });
  }
}

export async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = await get<T>(key);
  if (hit !== undefined) return hit;
  const data = await fn();
  await set(key, data);
  return data;
}

/** Binary variant, stored base64 in Redis (e.g. generated OG images). */
export async function cachedBuffer(
  key: string,
  fn: () => Promise<Buffer>,
): Promise<Buffer> {
  const hit = await get<string>(key);
  if (hit) return Buffer.from(hit, "base64");
  const data = await fn();
  await set(key, data.toString("base64"));
  return data;
}
