import Image from "next/image";
import Link from "next/link";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getAdminData, loginAdmin } from "@/lib/actions";
import { AdminDashboard } from "@/components/admin-dashboard";
import { PasswordField } from "@/components/password-field";

export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!(await isAdminAuthenticated())) {
    const configured = Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_SESSION_SECRET);
    const { error } = await searchParams;
    return <main className="login-page"><section className="login-card"><div className="brand-inline"><Image src="/api/brand/logo" alt="" width={48} height={48} unoptimized/><span className="brandtype">AYSÉN<small>ÁREA DE GESTIÓN</small></span></div><h1>Panel privado</h1><p>Ingresa con la clave administrativa para gestionar productos, pedidos y los datos del sitio.</p>{!configured && <div className="soft-alert">El panel aún no está configurado. Define <b>ADMIN_PASSWORD</b> y <b>ADMIN_SESSION_SECRET</b> en tu archivo local <code>.env</code> y reinicia el servidor.</div>}{error && <p className="error-message">Clave incorrecta. Inténtalo nuevamente.</p>}<form action={loginAdmin}><label className="field-label" htmlFor="password">Clave de administración</label><PasswordField id="password" name="password" autoComplete="current-password" required minLength={1} disabled={!configured}/><button className="primary-button" disabled={!configured}>Entrar al panel</button></form><Link href="/" className="site-only-admin">← Volver a la tienda</Link></section></main>;
  }
  const data = await getAdminData();
  return <AdminDashboard data={data} />;
}
