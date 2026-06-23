import "server-only";

import { headers } from "next/headers";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 15 * 60 * 1000;
const IP_LIMIT = 20;
const EMAIL_LIMIT = 8;

function pruneExpired(now: number): void {
  if (buckets.size < 500) {
    return;
  }

  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) {
      buckets.delete(key);
    }
  }
}

function consume(key: string, limit: number): boolean {
  const now = Date.now();
  pruneExpired(now);

  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (bucket.count >= limit) {
    return false;
  }

  bucket.count += 1;
  return true;
}

export async function assertLoginRateLimit(email: string): Promise<void> {
  await assertLoginRateLimitByIp();

  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail && !consume(`login:email:${normalizedEmail}`, EMAIL_LIMIT)) {
    throw new Error("Too many sign-in attempts for this email. Try again in a few minutes.");
  }
}

export async function assertLoginRateLimitByIp(): Promise<void> {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || headerStore.get("x-real-ip") || "unknown";

  if (!consume(`login:ip:${ip}`, IP_LIMIT)) {
    throw new Error("Too many sign-in attempts. Try again in a few minutes.");
  }
}
