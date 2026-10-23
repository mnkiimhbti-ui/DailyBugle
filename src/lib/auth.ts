import { timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Single user app: write actions (adding channels, which spend YouTube quota,
 * and manual syncs, which spend Tavily credits) need the ADMIN_KEY.
 * Accepts `x-admin-key: <key>` or `Authorization: Bearer <key>`
 * (the latter is what Vercel Cron sends when CRON_SECRET is set).
 */
export function isAuthorized(req: Request): boolean {
  const keys = [process.env.ADMIN_KEY, process.env.CRON_SECRET].filter(Boolean) as string[];
  if (keys.length === 0) return false;
  const header = req.headers.get("x-admin-key") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return keys.some((k) => safeEqual(header, k));
}
