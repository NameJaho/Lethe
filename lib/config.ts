export const EXPIRY_OPTIONS = {
  "10m": { label: "10 分钟", ms: 10 * 60 * 1000 },
  "1h": { label: "1 小时", ms: 60 * 60 * 1000 },
  "1d": { label: "1 天", ms: 24 * 60 * 60 * 1000 },
  "7d": { label: "7 天", ms: 7 * 24 * 60 * 60 * 1000 }
} as const;

export type ExpiryKey = keyof typeof EXPIRY_OPTIONS;

export const DEFAULT_EXPIRY: ExpiryKey = "1d";
export const MAX_CONTENT_LENGTH = 10000;
export const MIN_PASSWORD_LENGTH = 4;
export const MAX_PASSWORD_LENGTH = 128;

export function parseExpiry(value: unknown): ExpiryKey {
  if (typeof value === "string" && value in EXPIRY_OPTIONS) {
    return value as ExpiryKey;
  }

  return DEFAULT_EXPIRY;
}

export function passwordHashRounds() {
  const parsed = Number.parseInt(process.env.PASSWORD_HASH_ROUNDS ?? "12", 10);
  if (Number.isFinite(parsed) && parsed >= 10 && parsed <= 14) {
    return parsed;
  }

  return 12;
}

export function pickupCodeLength() {
  const parsed = Number.parseInt(process.env.PICKUP_CODE_LENGTH ?? "7", 10);
  if (Number.isFinite(parsed) && parsed >= 6 && parsed <= 12) {
    return parsed;
  }

  return 7;
}
