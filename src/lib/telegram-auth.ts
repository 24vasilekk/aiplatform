import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type TelegramAuthPayload = {
  id: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: string;
  hash: string;
};

function buildDataCheckString(payload: TelegramAuthPayload) {
  const entries = Object.entries(payload)
    .filter(([key, value]) => key !== "hash" && value !== undefined && value !== "")
    .map(([key, value]) => [key, String(value)] as const)
    .sort(([a], [b]) => a.localeCompare(b));

  return entries.map(([key, value]) => `${key}=${value}`).join("\n");
}

function telegramSecret(botToken: string) {
  return createHash("sha256").update(botToken).digest();
}

function verifyTelegramHash(payload: TelegramAuthPayload, botToken: string) {
  const dataCheckString = buildDataCheckString(payload);
  const expected = createHmac("sha256", telegramSecret(botToken)).update(dataCheckString).digest("hex");
  const actual = payload.hash.toLowerCase();

  if (expected.length !== actual.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

export function validateTelegramAuthPayload(
  payload: TelegramAuthPayload,
  options?: { maxAgeSeconds?: number; nowUnix?: number },
) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!botToken) {
    return { ok: false as const, error: "telegram_not_configured" };
  }

  const authDate = Number(payload.auth_date);
  if (!Number.isFinite(authDate) || authDate <= 0) {
    return { ok: false as const, error: "invalid_auth_date" };
  }

  const now = options?.nowUnix ?? Math.floor(Date.now() / 1000);
  const maxAgeSeconds = options?.maxAgeSeconds ?? 60 * 10;
  if (now - authDate > maxAgeSeconds || authDate - now > 30) {
    return { ok: false as const, error: "auth_expired" };
  }

  if (!verifyTelegramHash(payload, botToken)) {
    return { ok: false as const, error: "invalid_signature" };
  }

  return { ok: true as const };
}
