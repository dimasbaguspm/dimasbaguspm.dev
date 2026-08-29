import Redis from "ioredis";
import { log } from "./otel";

const TTL_MS = 60_000;
const TTL_S = Math.max(1, Math.ceil(TTL_MS / 1000));
const PREFIX = "dbpm:";
const host = process.env.REDIS_HOST ?? "";
const password = process.env.REDIS_PASSWORD ?? "";

// Be liberal with the value: "host:port", "redis://..." or "http://..." all
// work (http is a common typo for a RESP endpoint). A password can ride in the
// URL — or come from REDIS_PASSWORD when the value is scheme-less.
function redisUrl(host: string, password: string): string {
  let url = host;
  if (/^rediss?:\/\//.test(host)) return url; // creds already in the URL
  if (/^https?:\/\//.test(host)) url = host.replace(/^http/, "redis");
  else url = `redis://${host}`;
  if (password) {
    url = url.replace(
      /^redis:\/\//,
      `redis://:${encodeURIComponent(password)}@`,
    );
  }
  return url;
}

// Never leak credentials into logs.
function sanitizeHost(h: string): string {
  return h.replace(/^((?:redis|http)s?:\/\/)[^@]*@/, "$1***@");
}

let redis: Redis | null = null;
let ready = false;

// Best-effort cache (Redis/Valkey, both speak RESP): when REDIS_HOST is unset
// or the connect fails we serve direct GitHub hits; ioredis auto-reconnects.
// ponytail: per-process state — fine single-instance, per-instance TTL drift
// if you ever run multiple replicas behind a load balancer.
if (host) {
  log.info("cache: connecting to redis", { host: sanitizeHost(host) });
  redis = new Redis(redisUrl(host, password), {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  let state = "connecting"; // starts non-"down" so the first failure is logged
  redis.on("ready", async () => {
    ready = true;
    if (state !== "up") {
      state = "up";
      log.info("cache: redis connected", { host: sanitizeHost(host) });
      // clean all cached on startup so deploys are fresh — no versioned keys needed
      try {
        const keys = await redis!.keys(PREFIX + "*");
        if (keys.length) {
          await redis!.del(keys);
          log.info(`cache: flushed ${keys.length} keys on startup`);
        }
      } catch (e) {
        log.warn("cache: flush failed", { error: (e as Error).message });
      }
    }
  });
  redis.on("error", (e) => {
    ready = false;
    if (state !== "down") {
      state = "down";
      log.warn("cache: redis connection failed — direct GitHub hits", {
        error: e.message,
      });
    }
  });
} else {
  log.warn(`cache: redis not configured — direct GitHub hits`);
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
