type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function prune(now: number) {
  if (buckets.size < 2000) return;
  for (const [key, value] of buckets) {
    if (value.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Per-subject sliding window. Never key this on a shared venue IP.
 * subject should be guestId, deviceToken, or admin userId.
 */
export function consumeRateLimit(subject: string, limit: number, windowMs: number) {
  const now = Date.now();
  prune(now);
  const key = subject;
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetAt: now + windowMs };
  }
  if (current.count >= limit) {
    return { ok: false, remaining: 0, resetAt: current.resetAt };
  }
  current.count += 1;
  return { ok: true, remaining: limit - current.count, resetAt: current.resetAt };
}

export function guestAuthLimitKey(guestId: string) {
  return `upload-auth:guest:${guestId}`;
}

export function messageLimitKey(guestId: string) {
  return `message:guest:${guestId}`;
}

export function adminLimitKey(userId: string) {
  return `admin:user:${userId}`;
}

export function storyAccessLimitKey(deviceToken: string) {
  return `story-get:device:${deviceToken}`;
}

export function storyViewLimitKey(deviceToken: string) {
  return `story-view:device:${deviceToken}`;
}
