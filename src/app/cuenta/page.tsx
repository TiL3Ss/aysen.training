import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, ensureDatabase } from "@/db";
import { customerAddresses, orders } from "@/db/schema";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { logoutCustomer } from "@/lib/actions";
import { AccountSettings } from "@/components/account-settings";
import { BackLink } from "@/components/back-link";
export const dynamic = "force-dynamic";
export default async function AccountPage() {
  await ensureDatabase(); const customer = await getCurrentCustomer(); if (!customer) redirect("/cuenta/ingresar");
  const [list,addresses] = await Promise.all([
    db.select({ id: orders.id, createdAt: orders.createdAt, status: orders.status, total: orders.total }).from(orders).where(eq(orders.customerId, customer.id)).orderBy(desc(orders.createdAt)),
    db.select().from(customerAddresses).where(eq(customerAddresses.customerId,customer.id)),
  ]);
  return <main className="account-page"><section className="account-card account-wide"><div className="account-topline"><BackLink/><form action={logoutCustomer}><button className="soft-button logout-button">Cerrar sesión</button></form></div><div className="account-heading"><div><span className="kicker">Mi cuenta</span><h1>Hola, {customer.name}</h1><p>{customer.email}</p></div></div><AccountSettings name={customer.name} phone={customer.phone} addresses={addresses}/><h2>Mis pedidos</h2>{list.length ? list.map((order) => <article className="account-order" key={order.id}><div><b>{order.id}</b><small>{new Date(order.createdAt).toLocaleDateString("es-CL")}</small></div><strong>{order.status}</strong><b>${new Intl.NumberFormat("es-CL").format(order.total)}</b></article>) : <p>Aún no tienes pedidos vinculados a esta cuenta.</p>}</section></main>;
}
