import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db, ensureDatabase } from "@/db";
import { orderItems, orders } from "@/db/schema";

export const dynamic = "force-dynamic";
const money = (n: number) => `$${new Intl.NumberFormat("es-CL").format(n)}`;

export default async function OrderTracking({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();
  await ensureDatabase();
  const hash = createHash("sha256").update(token).digest("hex");
  const [order] = await db.select({ id: orders.id, status: orders.status, createdAt: orders.createdAt, total: orders.total, shippingDestinationName: orders.shippingDestinationName, commune: orders.commune }).from(orders).where(eq(orders.trackingTokenHash, hash)).limit(1);
  if (!order) notFound();
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  return <main className="legal-page tracking-page"><Link href="/">← Volver a la tienda</Link><span className="kicker">Seguimiento</span><h1>Pedido {order.id}</h1><p>Estado actual: <strong>{order.status}</strong></p><p>Ingresado el {new Date(order.createdAt).toLocaleString("es-CL", { dateStyle: "long", timeStyle: "short" })}</p><h2>Resumen</h2>{items.map((item) => <p key={item.id}>{item.quantity} × {item.productName}{item.selection ? ` · ${item.selection}` : ""} — {money(item.unitPrice * item.quantity)}</p>)}<p>Entrega: {order.commune}, {order.shippingDestinationName}</p><p><strong>Total: {money(order.total)}</strong></p><p className="notice">Este enlace es privado. Compártelo solo con personas autorizadas a consultar el pedido.</p></main>;
}
