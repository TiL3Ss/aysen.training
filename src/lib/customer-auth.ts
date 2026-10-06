import "server-only";
import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db, ensureDatabase } from "@/db";
import { customers } from "@/db/schema";

const COOKIE = "aysen-customer-session";
const SESSION_DAYS = 30;
const scrypt = promisify(scryptCallback) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

function sessionSecret() { return process.env.CUSTOMER_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET || ""; }
function signature(value: string) {
  const secret = sessionSecret();
  if (!secret) throw new Error("Falta CUSTOMER_SESSION_SECRET para habilitar cuentas de cliente.");
  return createHmac("sha256", secret).update(value).digest("hex");
}

export async function hashCustomerPassword(password: string) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyCustomerPassword(password: string, encoded: string) {
  const [algorithm, saltHex, keyHex] = encoded.split("$");
  if (algorithm !== "scrypt" || !saltHex || !keyHex) return false;
  const salt = Buffer.from(saltHex, "hex"); const expected = Buffer.from(keyHex, "hex");
  if (expected.length !== 64) return false;
  const actual = await scrypt(password, salt, expected.length);
  return timingSafeEqual(actual, expected);
}

export async function setCustomerSession(customerId: string) {
  const expires = String(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const body = `${customerId}.${expires}`;
  const store = await cookies();
  store.set(COOKIE, `${body}.${signature(body)}`, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_DAYS * 24 * 60 * 60 });
}

export async function clearCustomerSession() { (await cookies()).delete(COOKIE); }

export async function getCurrentCustomer() {
  if (!sessionSecret()) return null;
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [id, expires, provided] = raw.split(".");
  if (!id || !expires || !provided || Number(expires) <= Date.now()) return null;
  const expected = Buffer.from(signature(`${id}.${expires}`), "hex"); const actual = Buffer.from(provided, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  await ensureDatabase();
  const [customer] = await db.select({ id: customers.id, name: customers.name, email: customers.email, phone: customers.phone }).from(customers).where(eq(customers.id, id)).limit(1);
  return customer ?? null;
}
