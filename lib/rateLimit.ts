/**
 * Basic per-IP rate limiting, held in memory.
 *
 * Limits are set with a campus in mind: many people on Babson's network may
 * share one public IP, so these allow more than a single person would need.
 *
 * Each Vercel server instance keeps its own counters, so the effective limit
 * can be somewhat higher under load. See the README for the stricter option.
 */
export const LIMIT_PER_MINUTE = 20;
export const LIMIT_PER_DAY = 300;

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const MAX_TRACKED_IPS = 10_000;

type Counter = {
  minuteStart: number;
  minuteCount: number;
  dayStart: number;
  dayCount: number;
};

const counters = new Map<string, Counter>();

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export function checkRateLimit(
  ip: string,
  now: number = Date.now(),
): RateLimitResult {
  if (counters.size >= MAX_TRACKED_IPS) prune(now);

  let counter = counters.get(ip);
  if (!counter) {
    counter = { minuteStart: now, minuteCount: 0, dayStart: now, dayCount: 0 };
    counters.set(ip, counter);
  }

  if (now - counter.minuteStart >= MINUTE_MS) {
    counter.minuteStart = now;
    counter.minuteCount = 0;
  }
  if (now - counter.dayStart >= DAY_MS) {
    counter.dayStart = now;
    counter.dayCount = 0;
  }

  if (counter.dayCount >= LIMIT_PER_DAY) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((counter.dayStart + DAY_MS - now) / 1000),
    };
  }
  if (counter.minuteCount >= LIMIT_PER_MINUTE) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((counter.minuteStart + MINUTE_MS - now) / 1000),
    };
  }

  counter.minuteCount += 1;
  counter.dayCount += 1;
  return { allowed: true };
}

function prune(now: number): void {
  for (const [ip, counter] of counters) {
    if (now - counter.dayStart >= DAY_MS) counters.delete(ip);
  }
  // Under a flood of distinct IPs, drop the oldest entries so memory stays bounded.
  for (const ip of counters.keys()) {
    if (counters.size < MAX_TRACKED_IPS) break;
    counters.delete(ip);
  }
}

/** Vercel sets x-forwarded-for itself, so the first entry is the real client. */
export function getClientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}
