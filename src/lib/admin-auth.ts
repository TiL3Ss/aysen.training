import "server-only";
import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "aysen-admin-session";
const SESSION_HOURS = 8;

function signature(value: string) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("Define ADMIN_SESSION_SECRET para activar el panel.");
  return createHmac("sha256", secret).update(value).digest("hex");
}

export async function isAdminAuthenticated() {
  if (!process.env.ADMIN_PASSWORD || !process.env.ADMIN_SESSION_SECRET) return false;
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE)?.value;
  if (!raw) return false;
  const [expires, provided] = raw.split(".");
  if (!expires || !provided || Number(expires) < Date.now()) return false;
  const expected = signature(expires);
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function setAdminSession(password: string) {
  const configured = process.env.ADMIN_PASSWORD;
  if (!configured || !process.env.ADMIN_SESSION_SECRET) return false;
  const a = createHash("sha256").update(password).digest();
  const b = createHash("sha256").update(configured).digest();
  if (!timingSafeEqual(a, b)) return false;
  const expires = String(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE, `${expires}.${signature(expires)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60,
  });
  return true;
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE);
}
