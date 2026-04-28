/**
 * D1-backed rate limiter for portal auth endpoints.
 * Uses a sliding window keyed on arbitrary strings (e.g., "login:<ip>").
 */

export async function checkRateLimit(
  db: D1Database,
  key: string,
  maxCount: number,
  windowMs: number,
): Promise<boolean> {
  const now = Date.now();

  const row = await db
    .prepare('SELECT count, window_start FROM rate_limits WHERE key = ?')
    .bind(key)
    .first<{ count: number; window_start: string }>();

  if (!row) {
    await db
      .prepare('INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)')
      .bind(key, new Date(now).toISOString())
      .run();
    return false;
  }

  const windowStart = new Date(row.window_start).getTime();

  if (now - windowStart > windowMs) {
    // Reset window
    await db
      .prepare('UPDATE rate_limits SET count = 1, window_start = ? WHERE key = ?')
      .bind(new Date(now).toISOString(), key)
      .run();
    return false;
  }

  if (row.count >= maxCount) return true;

  await db
    .prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ?')
    .bind(key)
    .run();

  return false;
}
