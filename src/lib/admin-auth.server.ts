import { adminSecret, getAdminState, hashPassword, updateAdminState } from "@/lib/admin-store.server";

const COOKIE = "kyt_admin";
const MAX_AGE = 60 * 60 * 24 * 14;

export function json(status: number, payload: unknown, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

function parseCookies(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

async function hmacHex(message: string): Promise<string> {
  const secret = `${adminSecret()}:${(await getAdminState()).passwordHash || "setup"}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}

export async function createSessionCookie(): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const sig = await hmacHex(`admin.${exp}`);
  const token = `${exp}.${sig}`;
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export async function isAdminRequest(request: Request): Promise<boolean> {
  const token = parseCookies(request.headers.get("cookie") ?? "")[COOKIE] ?? "";
  const [expRaw, sig] = token.split(".");
  const exp = Number(expRaw);
  if (!expRaw || !sig || !Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
  const expected = await hmacHex(`admin.${exp}`);
  return timingSafeEqual(sig, expected);
}

export async function requireAdmin(request: Request): Promise<Response | null> {
  if (await isAdminRequest(request)) return null;
  return json(401, { ok: false, message: "Faça login no painel." });
}

export async function setupRequired(): Promise<boolean> {
  const state = await getAdminState();
  return !state.passwordHash;
}

export async function setAdminPassword(password: string): Promise<void> {
  const salt = crypto.randomUUID();
  const passwordHash = await hashPassword(password, salt);
  await updateAdminState((state) => {
    state.passwordSalt = salt;
    state.passwordHash = passwordHash;
  });
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const state = await getAdminState();
  if (!state.passwordHash || !state.passwordSalt) return false;
  const hashed = await hashPassword(password, state.passwordSalt);
  return timingSafeEqual(hashed, state.passwordHash);
}
