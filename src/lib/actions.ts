"use server";

import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { clearAdminSession, isAdminAuthenticated, setAdminSession } from "./admin-auth";
import { db, ensureDatabase, getSetting, getSettings } from "@/db";
import { categories, customerAddresses, customerPasswordResetTokens, customers, orderItems, orders, products, siteBanners, siteSettings } from "@/db/schema";
import { calculateOrderTotals, checkoutDestinationMatches, chileRegions, readDestinations, resolveDestination } from "@/lib/shipping";
import { citiesForRegion } from "@/lib/chile-address";
import { clearCustomerSession, getCurrentCustomer, hashCustomerPassword, setCustomerSession, verifyCustomerPassword } from "@/lib/customer-auth";
import { sendCustomerPasswordReset, sendOrderReceipt } from "@/lib/order-email";

const customerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(6).max(40),
  street: z.string().trim().max(120).default(""),
  streetNumber: z.string().trim().max(20).default(""),
  addressDetail: z.string().trim().max(60).default(""),
  city: z.string().trim().max(100).default(""),
  region: z.string().trim().max(100).default(""),
  note: z.string().trim().max(300).default(""),
  zone: z.string().min(1).max(80),
  deliveryMethod: z.enum(["shipping", "pickup"]).default("shipping"),
  lines: z.array(z.object({ productId: z.string().min(1), quantity: z.number().int().min(1).max(25), model: z.string().max(80).default(""), color: z.string().max(80).default("") })).min(1).max(40),
});

function fail(message: string) { return { ok: false as const, message }; }
async function requireAdmin() {
  if (!(await isAdminAuthenticated())) throw new Error("Tu sesión de administración expiró. Vuelve a iniciar sesión.");
}
function makeSlug(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
async function saveSetting(key: string, value: string) {
  await db.insert(siteSettings).values({ key, value, updatedAt: new Date().toISOString() }).onConflictDoUpdate({
    target: siteSettings.key,
    set: { value, updatedAt: new Date().toISOString() },
  });
}

export async function loginAdmin(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (!(await setAdminSession(password))) redirect("/Padmin?error=login");
  redirect("/Padmin");
}

export async function logoutAdmin() {
  await clearAdminSession();
  redirect("/Padmin");
}

export async function createOrder(payload: unknown) {
  const parsed = customerSchema.safeParse(payload);
  if (!parsed.success) return fail("Revisa los datos de contacto y envío.");
  await ensureDatabase();
  const data = parsed.data;
  const settings = await getSettings();
  const destinations = readDestinations(settings.shippingDestinations);
  const account = await getCurrentCustomer();
  const customerName = account?.name ?? data.name;
  const customerEmail = account?.email ?? data.email;
  const localOnly = settings.localDeliveryOnly === "true";
  const pickup = data.deliveryMethod === "pickup";
  if (pickup && settings.pickupEnabled !== "true") return fail("El retiro en sucursal no está habilitado actualmente.");
  if (!pickup && (data.street.length<2 || !data.streetNumber || data.city.length<2 || data.region.length<2)) return fail("Completa la dirección para el despacho.");
  const destination = resolveDestination(destinations, localOnly, data.zone);
  const configuredRate = destination?.price;
  if (!destination || typeof configuredRate !== "number" || !Number.isInteger(configuredRate) || configuredRate < 0) return fail("Ese destino no está disponible. Actualiza la cotización.");
  if (!pickup && !checkoutDestinationMatches(data.region, destination)) return fail("La región del pedido no coincide con el destino seleccionado.");
  if (!pickup && !citiesForRegion(destination.id).includes(data.city)) return fail("Selecciona una ciudad válida para la región elegida.");
  const shippingPrice = pickup ? 0 : configuredRate;

  const orderId = `AY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const uploadToken = randomUUID();
  const trackingToken = randomUUID();
  try {
    const result = await db.transaction(async (tx) => {
      const ids = [...new Set(data.lines.map((line) => line.productId))];
      const rows = await tx.select().from(products).where(and(inArray(products.id, ids), eq(products.active, true)));
      if (rows.length !== ids.length) throw new Error("Uno de los productos ya no está disponible.");
      const byId = new Map(rows.map((row) => [row.id, row]));
      const lineItems = data.lines.map((line) => {
        const product = byId.get(line.productId)!;
        if (product.stock < line.quantity) throw new Error(`No queda stock suficiente de ${product.name}.`);
        const models = safeOptions(product.models); const colors = safeOptions(product.colors);
        if (line.model && !models.includes(line.model)) throw new Error(`El modelo de ${product.name} ya no está disponible.`);
        if (line.color && !colors.includes(line.color)) throw new Error(`El color de ${product.name} ya no está disponible.`);
        return { productId: product.id, productName: product.name, unitPrice: product.price, quantity: line.quantity, selection: [line.model, line.color].filter(Boolean).join(" · ") };
      });
      const totals = calculateOrderTotals(lineItems, shippingPrice);
      for (const item of lineItems) {
        const updated = await tx.update(products).set({ stock: sql`${products.stock} - ${item.quantity}` })
          .where(and(eq(products.id, item.productId), gte(products.stock, item.quantity))).returning({ id: products.id });
        if (!updated.length) throw new Error(`El stock de ${item.productName} acaba de cambiar. Revisa tu bolsa.`);
      }
      await tx.insert(orders).values({
        id: orderId, customerId: account?.id ?? null, deliveryMethod: data.deliveryMethod, customerName, email: customerEmail, phone: data.phone,
        address: pickup ? (settings.pickupAddress || "Retiro en sucursal") : `${data.street} ${data.streetNumber}${data.addressDetail ? `, ${data.addressDetail}` : ""}`, commune: pickup ? "Retiro en sucursal" : data.city, region: pickup ? "Región de Aysén" : data.region,
        deliveryNote: data.note, shippingZone: pickup ? "pickup" : data.zone, shippingDestinationName: pickup ? "Retiro en sucursal" : destination.name, ...totals,
        transferTokenHash: createHash("sha256").update(uploadToken).digest("hex"),
        trackingTokenHash: createHash("sha256").update(trackingToken).digest("hex"),
        status: "Pendiente de transferencia", createdAt: new Date().toISOString(),
      });
      await tx.insert(orderItems).values(lineItems.map((item) => ({ id: randomUUID(), orderId, ...item })));
      return totals;
    });
    revalidatePath("/");
    let emailSent = false;
    try {
      const origin = process.env.SITE_URL || (await headers()).get("origin") || "";
      if (origin) emailSent = await sendOrderReceipt({ to: customerEmail, orderId, total: result.total, trackingUrl: `${origin.replace(/\/$/, "")}/pedido/seguimiento/${trackingToken}` });
    } catch { emailSent = false; }
    const origin = process.env.SITE_URL || (await headers()).get("origin") || "";
    return { ok: true as const, orderId, uploadToken, emailSent, customerEmail, trackingUrl: `${origin.replace(/\/$/, "")}/pedido/seguimiento/${trackingToken}`, ...result, message: "Pedido registrado. Completa la transferencia con los datos indicados." };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "No se pudo registrar tu pedido.");
  }
}

const registerSchema = z.object({ name: z.string().trim().min(2).max(100), email: z.string().trim().email().max(200), password: z.string().min(12).max(200), termsAccepted: z.literal(true), privacyAccepted: z.literal(true) });
export async function registerCustomer(payload: unknown) {
  const parsed = registerSchema.safeParse(payload);
  if (!parsed.success) return fail("Completa los datos, acepta los términos y la política de privacidad, y usa una clave de al menos 12 caracteres.");
  if (!process.env.CUSTOMER_SESSION_SECRET && !process.env.ADMIN_SESSION_SECRET) return fail("La tienda aún no tiene configurada su clave de sesiones.");
  await ensureDatabase();
  const email = parsed.data.email.toLowerCase();
  const [existing] = await db.select({ id: customers.id }).from(customers).where(eq(customers.email, email)).limit(1);
  if (existing) return fail("Ya existe una cuenta con ese correo. Inicia sesión.");
  const now = new Date().toISOString(); const id = randomUUID();
  try {
    await db.insert(customers).values({ id, name: parsed.data.name, email, passwordHash: await hashCustomerPassword(parsed.data.password), termsAcceptedAt: now, privacyAcceptedAt: now, createdAt: now });
    await setCustomerSession(id); revalidatePath("/cuenta");
    return { ok: true as const, message: "Cuenta creada correctamente." };
  } catch { return fail("No se pudo crear la cuenta. Revisa el correo e inténtalo otra vez."); }
}

export async function loginCustomer(payload: unknown) {
  const parsed = z.object({ email: z.string().trim().email().max(200), password: z.string().min(1).max(200) }).safeParse(payload);
  if (!parsed.success) return fail("Ingresa un correo y una contraseña válidos.");
  if (!process.env.CUSTOMER_SESSION_SECRET && !process.env.ADMIN_SESSION_SECRET) return fail("La tienda aún no tiene configurada su clave de sesiones.");
  await ensureDatabase();
  const [customer] = await db.select().from(customers).where(eq(customers.email, parsed.data.email.toLowerCase())).limit(1);
  if (!customer || !(await verifyCustomerPassword(parsed.data.password, customer.passwordHash))) return fail("Correo o contraseña incorrectos.");
  await setCustomerSession(customer.id); revalidatePath("/cuenta");
  return { ok: true as const, message: "Sesión iniciada." };
}

export async function requestCustomerPasswordReset(payload: unknown) {
  if ((await getSetting("passwordResetEnabled", "false")) !== "true") return fail("La recuperación por correo está deshabilitada por la tienda.");
  const parsed = z.object({ email: z.string().trim().email().max(200) }).safeParse(payload);
  if (!parsed.success) return fail("Ingresa un correo electrónico válido.");
  const genericMessage = "Si existe una cuenta con ese correo, recibirás un enlace para cambiar la contraseña.";
  await ensureDatabase();
  const email = parsed.data.email.toLowerCase();
  const [customer] = await db.select({ id: customers.id, email: customers.email }).from(customers).where(eq(customers.email, email)).limit(1);
  if (!customer) return { ok: true as const, message: genericMessage };

  const now = new Date();
  const recentSince = new Date(now.getTime() - 60_000).toISOString();
  const [recent] = await db.select({ id: customerPasswordResetTokens.id }).from(customerPasswordResetTokens)
    .where(and(eq(customerPasswordResetTokens.customerId, customer.id), isNull(customerPasswordResetTokens.usedAt), gte(customerPasswordResetTokens.createdAt, recentSince))).limit(1);
  if (recent) return { ok: true as const, message: genericMessage };

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const createdAt = now.toISOString();
  const tokenId = randomUUID();
  await db.update(customerPasswordResetTokens).set({ usedAt: createdAt }).where(and(eq(customerPasswordResetTokens.customerId, customer.id), isNull(customerPasswordResetTokens.usedAt)));
  await db.insert(customerPasswordResetTokens).values({ id: tokenId, customerId: customer.id, tokenHash, expiresAt: new Date(now.getTime() + 30 * 60_000).toISOString(), createdAt });
  const baseUrl = process.env.SITE_URL || (await headers()).get("origin") || "";
  const emailSent = baseUrl ? await sendCustomerPasswordReset({ to: customer.email, resetUrl: `${baseUrl.replace(/\/$/, "")}/cuenta/recuperar/${rawToken}` }) : false;
  if (!emailSent) await db.update(customerPasswordResetTokens).set({ usedAt: new Date().toISOString() }).where(eq(customerPasswordResetTokens.id, tokenId));
  return { ok: true as const, message: genericMessage };
}

export async function resetCustomerPassword(payload: unknown) {
  if ((await getSetting("passwordResetEnabled", "false")) !== "true") return fail("La recuperación por correo está deshabilitada por la tienda.");
  const parsed = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/), password: z.string().min(12).max(200) }).safeParse(payload);
  if (!parsed.success) return fail("El enlace no es válido o la contraseña no cumple los requisitos.");
  await ensureDatabase();
  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
  const now = new Date().toISOString();
  const [record] = await db.select().from(customerPasswordResetTokens).where(and(eq(customerPasswordResetTokens.tokenHash, tokenHash), isNull(customerPasswordResetTokens.usedAt))).limit(1);
  if (!record || record.expiresAt <= now) return fail("El enlace venció o ya fue utilizado. Solicita uno nuevo.");
  const passwordHash = await hashCustomerPassword(parsed.data.password);
  const consumed = await db.update(customerPasswordResetTokens).set({ usedAt: now }).where(and(eq(customerPasswordResetTokens.id, record.id), isNull(customerPasswordResetTokens.usedAt), gte(customerPasswordResetTokens.expiresAt, now))).returning({ id: customerPasswordResetTokens.id });
  if (!consumed.length) return fail("El enlace venció o ya fue utilizado. Solicita uno nuevo.");
  await db.update(customers).set({ passwordHash }).where(eq(customers.id, record.customerId));
  await db.update(customerPasswordResetTokens).set({ usedAt: now }).where(and(eq(customerPasswordResetTokens.customerId, record.customerId), isNull(customerPasswordResetTokens.usedAt)));
  await setCustomerSession(record.customerId);
  revalidatePath("/cuenta");
  return { ok: true as const, message: "Contraseña actualizada. Ya puedes entrar a tu cuenta." };
}

export async function logoutCustomer() { await clearCustomerSession(); revalidatePath("/cuenta"); redirect("/"); }

export async function saveCustomerProfile(formData: FormData) {
  const customer = await getCurrentCustomer(); if (!customer) redirect("/cuenta/ingresar");
  const parsed = z.object({ name:z.string().trim().min(2).max(100), phone:z.string().trim().min(6).max(40) }).safeParse({ name:formData.get("name"), phone:formData.get("phone") });
  if (!parsed.success) return { ok:false, message:"Revisa el nombre y teléfono." };
  await db.update(customers).set(parsed.data).where(eq(customers.id, customer.id)); revalidatePath("/cuenta"); return { ok:true, message:"Perfil actualizado." };
}

export async function changeCustomerPassword(formData: FormData) {
  const customer = await getCurrentCustomer(); if (!customer) redirect("/cuenta/ingresar");
  const current = String(formData.get("currentPassword") ?? ""), next = String(formData.get("newPassword") ?? "");
  const [record] = await db.select().from(customers).where(eq(customers.id, customer.id)).limit(1);
  if (!record || !(await verifyCustomerPassword(current, record.passwordHash))) return { ok:false, message:"La contraseña actual no coincide." };
  if (next.length < 12 || next.length > 200) return { ok:false, message:"La nueva contraseña debe tener al menos 12 caracteres." };
  await db.update(customers).set({ passwordHash: await hashCustomerPassword(next) }).where(eq(customers.id, customer.id)); revalidatePath("/cuenta"); return { ok:true, message:"Contraseña actualizada." };
}

export async function saveCustomerAddress(formData: FormData) {
  const customer = await getCurrentCustomer(); if (!customer) redirect("/cuenta/ingresar");
  const raw = { id:String(formData.get("id")??""), label:String(formData.get("label")??"Casa"), region:String(formData.get("region")??""), city:String(formData.get("city")??""), street:String(formData.get("street")??""), streetNumber:String(formData.get("streetNumber")??""), detail:String(formData.get("detail")??""), isDefault:formData.get("isDefault")==="on" };
  const parsed = z.object({ id:z.string(),label:z.string().trim().min(2).max(40),region:z.string().trim().min(2).max(100),city:z.string().trim().min(2).max(100),street:z.string().trim().min(2).max(120),streetNumber:z.string().trim().min(1).max(20),detail:z.string().trim().max(60),isDefault:z.boolean() }).safeParse(raw);
  if (!parsed.success) return { ok:false, message:"Completa la dirección." };
  if (!citiesForRegion(resolveRegionId(parsed.data.region)).includes(parsed.data.city)) return { ok:false, message:"Selecciona una ciudad válida para la región." };
  const { id, ...values } = parsed.data; const addressId=id||randomUUID();
  if (values.isDefault) await db.update(customerAddresses).set({isDefault:false}).where(eq(customerAddresses.customerId,customer.id));
  const [existing] = id ? await db.select({id:customerAddresses.id}).from(customerAddresses).where(and(eq(customerAddresses.id,id),eq(customerAddresses.customerId,customer.id))).limit(1) : [];
  if (existing) await db.update(customerAddresses).set(values).where(eq(customerAddresses.id,id)); else await db.insert(customerAddresses).values({ ...values,id:addressId,customerId:customer.id });
  revalidatePath("/cuenta"); return {ok:true,message:"Dirección guardada."};
}

export async function deleteCustomerAddress(id:string) { const customer=await getCurrentCustomer(); if(!customer) redirect("/cuenta/ingresar"); await db.delete(customerAddresses).where(and(eq(customerAddresses.id,id),eq(customerAddresses.customerId,customer.id))); revalidatePath("/cuenta"); return {ok:true,message:"Dirección eliminada."}; }

function resolveRegionId(region:string) { return chileRegions.find(x=>x.name.toLowerCase()===region.toLowerCase()||x.id===region)?.id ?? ""; }

export async function saveCategory(payload: unknown) {
  await requireAdmin(); await ensureDatabase();
  const parsed=z.object({id:z.string().optional(),name:z.string().trim().min(2).max(50),active:z.boolean().default(true),sortOrder:z.number().int().min(0).max(999).default(0)}).safeParse(payload);
  if(!parsed.success) return fail("Escribe un nombre de categoría válido.");
  const id=parsed.data.id||randomUUID();
  const duplicate=await db.select({id:categories.id}).from(categories).where(eq(categories.name,parsed.data.name)).limit(1);
  if(duplicate.length&&duplicate[0].id!==id) return fail("Ya existe una categoría con ese nombre.");
  if(parsed.data.id){ const [old]=await db.select({name:categories.name}).from(categories).where(eq(categories.id,id)).limit(1); if(old&&old.name!==parsed.data.name) await db.update(products).set({category:parsed.data.name}).where(eq(products.category,old.name)); }
  await db.insert(categories).values({id,name:parsed.data.name,active:parsed.data.active,sortOrder:parsed.data.sortOrder}).onConflictDoUpdate({target:categories.id,set:{name:parsed.data.name,active:parsed.data.active,sortOrder:parsed.data.sortOrder}});
  revalidatePath("/");revalidatePath("/Padmin");return {ok:true as const,message:"Categoría guardada."};
}
export async function deleteCategory(id:string) { await requireAdmin();await ensureDatabase();const [used]=await db.select({id:products.id}).from(products).where(eq(products.category,(await db.select({name:categories.name}).from(categories).where(eq(categories.id,id)).limit(1))[0]?.name??"__none__")).limit(1);if(used)return fail("La categoría se usa en productos. Cambia primero sus productos a otra categoría.");await db.delete(categories).where(eq(categories.id,id));revalidatePath("/");revalidatePath("/Padmin");return {ok:true as const,message:"Categoría eliminada."}; }

const transferProofSchema = z.object({ orderId: z.string().min(8).max(40), token: z.string().uuid(), proof: z.string().min(40).max(4_000_000).regex(/^data:(?:image\/(?:webp|jpeg|png)|application\/pdf);base64,[A-Za-z0-9+/=]+$/) });
export async function uploadTransferProof(payload: unknown) {
  const parsed = transferProofSchema.safeParse(payload);
  if (!parsed.success) return fail("Selecciona una imagen válida del comprobante (PNG, JPG o WebP).");
  await ensureDatabase();
  const { orderId, token, proof } = parsed.data;
  const [order] = await db.select({ hash: orders.transferTokenHash }).from(orders).where(eq(orders.id, orderId)).limit(1);
  const submitted = createHash("sha256").update(token).digest();
  const saved = order?.hash ? Buffer.from(order.hash, "hex") : Buffer.alloc(submitted.length);
  if (saved.length !== submitted.length || !timingSafeEqual(saved, submitted) || !order?.hash) return fail("No se pudo verificar el pedido para adjuntar este comprobante.");
  await db.update(orders).set({ transferProof: proof, transferTokenHash: null }).where(eq(orders.id, orderId));
  revalidatePath("/Padmin");
  return { ok: true as const, message: "Comprobante adjuntado al pedido." };
}

function safeOptions(raw: string): string[] { try { const data = JSON.parse(raw); return Array.isArray(data) ? data.filter((item): item is string => typeof item === "string") : []; } catch { return []; } }

const productSchema = z.object({
  id: z.string().optional(), name: z.string().trim().min(2).max(120), description: z.string().trim().max(500),
  category: z.string().trim().min(2).max(50), price: z.number().int().nonnegative(), compareAtPrice: z.number().int().nonnegative().nullable().default(null), models: z.array(z.string().trim().min(1).max(80)).max(30).default([]), colors: z.array(z.string().trim().min(1).max(80)).max(30).default([]), stock: z.number().int().nonnegative(),
  imageUrl: z.string().max(500).optional().default(""), active: z.boolean().default(true),
});

export async function saveProduct(payload: unknown) {
  await requireAdmin(); await ensureDatabase();
  const parsed = productSchema.safeParse(payload);
  if (!parsed.success) return fail("Datos de producto inválidos.");
  const data = parsed.data;
  if (data.compareAtPrice !== null && data.compareAtPrice <= data.price) return fail("El precio anterior de una oferta debe ser mayor al precio actual.");
  const id = data.id || randomUUID();
  const baseSlug = makeSlug(data.name) || id;
  const slug = `${baseSlug}-${id.slice(0, 5)}`;
  const { models, colors, ...productData } = data;
  await db.insert(products).values({ ...productData, models: JSON.stringify(models), colors: JSON.stringify(colors), id, slug, createdAt: new Date().toISOString() }).onConflictDoUpdate({
    target: products.id,
    set: { name: data.name, slug, description: data.description, category: data.category, price: data.price, compareAtPrice: data.compareAtPrice, models: JSON.stringify(data.models), colors: JSON.stringify(data.colors), stock: data.stock, imageUrl: data.imageUrl, active: data.active },
  });
  revalidatePath("/"); revalidatePath("/Padmin");
  return { ok: true as const, message: "Producto guardado." };
}

export async function setProductActive(id: string, active: boolean) {
  await requireAdmin(); await ensureDatabase();
  await db.update(products).set({ active }).where(eq(products.id, id));
  revalidatePath("/"); revalidatePath("/Padmin");
  return { ok: true as const };
}

const settingsSchema = z.object({
  siteName: z.string().trim().min(2).max(100), siteDescription: z.string().trim().min(10).max(300),
  logoData: z.string().max(800_000).optional().default(""), faviconData: z.string().max(200_000).optional().default(""),
  bankName: z.string().trim().max(100), bankAccountType: z.string().trim().max(60), bankAccount: z.string().trim().max(100),
  bankRut: z.string().trim().max(30), bankHolder: z.string().trim().max(100), bankEmail: z.string().trim().max(160),
  companyName: z.string().trim().max(120), companyRut: z.string().trim().max(30), companyAddress: z.string().trim().max(200),
  companyEmail: z.string().trim().max(160), companyPhone: z.string().trim().max(40), legalRepresentative: z.string().trim().max(120),
});

export async function saveSiteSettings(payload: unknown) {
  await requireAdmin(); await ensureDatabase();
  const parsed = settingsSchema.safeParse(payload);
  if (!parsed.success) return fail("Revisa el nombre y la descripción de la tienda.");
  const previous = await getSettings();
  for (const [key, rawValue] of Object.entries(parsed.data)) {
    const value = (key === "logoData" || key === "faviconData") && !rawValue ? previous[key] ?? "" : rawValue;
    if ((key === "logoData" || key === "faviconData") && value && !/^data:image\/(png|jpeg|webp);base64,/.test(value)) return fail("Usa una imagen PNG, JPG o WebP.");
    await saveSetting(key, value);
  }
  revalidatePath("/"); revalidatePath("/Padmin");
  return { ok: true as const, message: "Configuración del sitio guardada." };
}

const storefrontContentSchema = z.object({
  heroEyebrow: z.string().trim().max(120), tagline: z.string().trim().min(2).max(120),
  heroDescription: z.string().trim().max(300), heroCtaText: z.string().trim().max(60),
  heroCtaHref: z.string().trim().max(300).refine((value) => value.startsWith("/") || value.startsWith("#") || /^https:\/\//i.test(value), "Usa un enlace interno, ancla o URL HTTPS."),
  heroNote: z.string().trim().max(100), storyEyebrow: z.string().trim().max(120),
  storyTitle: z.string().trim().max(180), storyDescription: z.string().trim().max(700),
  storyCoordinates: z.string().trim().max(100), footerDescription: z.string().trim().max(400),
});

export async function saveStorefrontContent(payload: unknown) {
  await requireAdmin(); await ensureDatabase();
  const parsed = storefrontContentSchema.safeParse(payload);
  if (!parsed.success) return fail("Revisa los textos y el enlace del botón de portada.");
  for (const [key, value] of Object.entries(parsed.data)) await saveSetting(key, value);
  revalidatePath("/"); revalidatePath("/Padmin");
  return { ok: true as const, message: "Contenido de la tienda guardado." };
}

export async function setPasswordResetEnabled(enabled: boolean) {
  await requireAdmin(); await ensureDatabase();
  if (typeof enabled !== "boolean") return fail("Opción inválida.");
  await saveSetting("passwordResetEnabled", String(enabled));
  if (!enabled) await db.update(customerPasswordResetTokens).set({ usedAt: new Date().toISOString() }).where(isNull(customerPasswordResetTokens.usedAt));
  revalidatePath("/"); revalidatePath("/cuenta/ingresar"); revalidatePath("/cuenta/recuperar"); revalidatePath("/Padmin");
  return { ok: true as const, message: enabled ? "Recuperación por correo habilitada." : "Recuperación por correo deshabilitada." };
}

const shippingConfigSchema = z.object({ localOnly: z.boolean(), destinations: z.array(z.object({ id: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/), name: z.string().trim().min(2).max(100), price: z.number().int().nonnegative().max(10_000_000), days: z.string().trim().min(2).max(60), enabled: z.boolean() })).max(60) });
export async function saveShippingConfiguration(payload: unknown) {
  await requireAdmin(); await ensureDatabase();
  const parsed = shippingConfigSchema.safeParse(payload);
  if (!parsed.success || new Set(parsed.data.destinations.map((destination) => destination.id)).size !== parsed.data.destinations.length || !parsed.data.destinations.some((destination) => destination.id === "aysen") || (!parsed.data.localOnly && !parsed.data.destinations.some((destination) => destination.enabled))) return fail("Revisa los destinos: Aysén debe permanecer y debe existir al menos un destino activo.");
  const destinations = parsed.data.destinations.map((destination) => parsed.data.localOnly ? { ...destination, enabled: destination.id === "aysen" } : destination);
  await saveSetting("shippingDestinations", JSON.stringify(destinations));
  await saveSetting("localDeliveryOnly", String(parsed.data.localOnly));
  revalidatePath("/"); revalidatePath("/Padmin");
  return { ok: true as const, message: parsed.data.localOnly ? "Entrega local en Aysén activada." : "Destinos y tarifas guardados." };
}

export async function savePickupConfiguration(payload: unknown) {
  await requireAdmin(); await ensureDatabase();
  const parsed=z.object({enabled:z.boolean(),address:z.string().trim().min(3).max(200)}).safeParse(payload);
  if(!parsed.success)return fail("Indica la dirección de retiro en sucursal.");
  await saveSetting("pickupEnabled",String(parsed.data.enabled)); await saveSetting("pickupAddress",parsed.data.address);
  revalidatePath("/");revalidatePath("/Padmin");return {ok:true as const,message:"Configuración de retiro guardada."};
}

export async function setSiiEmissionEnabled(enabled:boolean) {
  await requireAdmin();await ensureDatabase();
  if(enabled && process.env.NODE_ENV === "production") return fail("No se puede habilitar en producción: falta completar y certificar el conector SII.");
  await saveSetting("siiEmissionEnabled",String(enabled));revalidatePath("/Padmin");return {ok:true as const,message:enabled?"Modo de integración SII activado para desarrollo. No emitirá DTE válidos.":"Modo de integración SII deshabilitado."};
}

const bannerSchema = z.object({ id: z.string().optional(), title: z.string().trim().min(2).max(100), message: z.string().trim().min(2).max(240), linkText: z.string().trim().max(40).default(""), linkUrl: z.string().trim().max(500).default(""), backgroundColor:z.string().regex(/^#[0-9a-f]{6}$/i).default("#1b2620"), textColor:z.string().regex(/^#[0-9a-f]{6}$/i).default("#eefaf0"), fontSize:z.number().int().min(12).max(28).default(15), bold:z.boolean().default(false), italic:z.boolean().default(false), startsAt: z.string().datetime().nullable().default(null), endsAt: z.string().datetime().nullable().default(null), active: z.boolean().default(true), sortOrder: z.number().int().min(0).max(999).default(0) });
export async function saveBanner(payload: unknown) {
  await requireAdmin(); await ensureDatabase();
  const parsed = bannerSchema.safeParse(payload);
  if (!parsed.success) return fail("Revisa el título, mensaje y fechas de vigencia del banner.");
  const data = parsed.data;
  if (data.startsAt && data.endsAt && new Date(data.endsAt) <= new Date(data.startsAt)) return fail("La fecha de término debe ser posterior al inicio.");
  if (Boolean(data.linkText) !== Boolean(data.linkUrl) || (data.linkUrl && !/^(https?:\/\/|\/)/.test(data.linkUrl))) return fail("El botón necesita texto y una URL segura (https:// o ruta interna).");
  const id = data.id || randomUUID();
  await db.insert(siteBanners).values({ ...data, id, createdAt: new Date().toISOString() }).onConflictDoUpdate({ target: siteBanners.id, set: { title: data.title, message: data.message, linkText: data.linkText, linkUrl: data.linkUrl, backgroundColor:data.backgroundColor,textColor:data.textColor,fontSize:data.fontSize,bold:data.bold,italic:data.italic,startsAt: data.startsAt, endsAt: data.endsAt, active: data.active, sortOrder: data.sortOrder } });
  revalidatePath("/"); revalidatePath("/Padmin");
  return { ok: true as const, id, message: "Banner guardado correctamente." };
}

export async function deleteBanner(id: string) {
  await requireAdmin(); await ensureDatabase();
  await db.delete(siteBanners).where(eq(siteBanners.id, id));
  revalidatePath("/"); revalidatePath("/Padmin");
  return { ok: true as const, message: "Banner eliminado." };
}

export async function updateOrderStatus(id: string, status: string) {
  await requireAdmin(); await ensureDatabase();
  const allowed = ["Pendiente de transferencia", "Pago confirmado", "Preparando envío", "Despachado", "Entregado", "Cancelado"];
  if (!allowed.includes(status)) return fail("Estado de pedido inválido.");
  await db.update(orders).set({ status }).where(eq(orders.id, id));
  revalidatePath("/Padmin"); revalidatePath(`/Padmin/orders/${id}/ticket`);
  return { ok: true as const, message: "Estado actualizado." };
}

export async function getAdminData() {
  await requireAdmin(); await ensureDatabase();
  const [allProducts, allOrders, items, banners, categoryRows, settings] = await Promise.all([
    db.select().from(products).orderBy(desc(products.createdAt)),
    db.select({ id: orders.id, deliveryMethod:orders.deliveryMethod,customerName: orders.customerName, email: orders.email, phone: orders.phone, address: orders.address, commune: orders.commune, region: orders.region, deliveryNote: orders.deliveryNote, shippingZone: orders.shippingZone, shippingDestinationName: orders.shippingDestinationName, subtotal: orders.subtotal, shippingPrice: orders.shippingPrice, total: orders.total, status: orders.status, createdAt: orders.createdAt, hasTransferProof: sql<boolean>`${orders.transferProof} IS NOT NULL` }).from(orders).orderBy(desc(orders.createdAt)),
    db.select().from(orderItems),
    db.select().from(siteBanners).orderBy(siteBanners.sortOrder, desc(siteBanners.createdAt)),
    db.select().from(categories).orderBy(categories.sortOrder, categories.name),
    getSettings(),
  ]);
  return { products: allProducts, orders: allOrders, items, banners, categories: categoryRows, settings: { ...settings, logoData: "", faviconData: "" } };
}
