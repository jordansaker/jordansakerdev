import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "studio-session";
const ONE_WEEK = 60 * 60 * 24 * 7;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error("SESSION_SECRET must be set to a 32+ character string");
  }
  return s;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function createSessionToken(exp: number = Math.floor(Date.now() / 1000) + ONE_WEEK) {
  const payload = JSON.stringify({ exp });
  const body = Buffer.from(payload).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const [body, sig] = token.split(".");
  if (!body || !sig) return false;
  const expectedSig = sign(body);
  if (
    sig.length !== expectedSig.length ||
    !timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))
  ) {
    return false;
  }
  try {
    const { exp } = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      exp: number;
    };
    if (typeof exp !== "number") return false;
    return exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function verifyPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new Error("ADMIN_PASSWORD is not set");
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const SESSION_COOKIE = COOKIE_NAME;
export const SESSION_MAX_AGE = ONE_WEEK;
