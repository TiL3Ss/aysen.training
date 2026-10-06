import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db, ensureDatabase } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { PrintTicket } from "@/components/print-ticket";

export const dynamic = "force-dynamic";
const money = (value: number) => `$${new Intl.NumberFormat("es-CL").format(value)}`;

export default async function ShippingTicket({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) redirect("/Padmin");
  await ensureDatabase();
  const { id } = await params;
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) notFound();
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
  return <main className="ticket-page"><div className="ticket-paper"><PrintTicket/><div className="ticket-paper-head"><div><h1>AYSÉN TRAINING STORE</h1><small>COYHAIQUE · PATAGONIA · CHILE</small></div><div><b>TICKET DE ENVÍO</b><br/>Pedido {order.id}<br/>{new Date(order.createdAt).toLocaleDateString("es-CL")}</div></div><div className="ticket-blocks"><section className="ticket-block"><b>DESTINATARIO</b><br/>{order.customerName}<br/>{order.phone}<br/>{order.email}</section><section className="ticket-block"><b>DIRECCIÓN DE ENTREGA</b><br/>{order.address}<br/>{order.commune}, {order.region}<br/>{order.deliveryNote && <>Referencia: {order.deliveryNote}</>}</section></div><b>CONTENIDO DEL PEDIDO</b><table><thead><tr><th>Artículo</th><th>Cant.</th><th>Total</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.productName}{item.selection && <small><br/>{item.selection}</small>}</td><td>× {item.quantity}</td><td>{money(item.unitPrice * item.quantity)}</td></tr>)}<tr><td><b>Productos</b></td><td/><td>{money(order.subtotal)}</td></tr><tr><td><b>{order.shippingDestinationName ? `Entrega · ${order.shippingDestinationName}` : `Envío · ${order.shippingZone}`}</b></td><td/><td>{money(order.shippingPrice)}</td></tr><tr><td><b>Total</b></td><td/><td><b>{money(order.total)}</b></td></tr></tbody></table><p>Estado: {order.status} · Pago por transferencia.<br/>Gracias por elegir Aysén Training Store.</p></div></main>;
}
