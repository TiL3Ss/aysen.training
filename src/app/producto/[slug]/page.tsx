import Link from "next/link";
import { and, asc, eq, ne } from "drizzle-orm";
import { db, ensureDatabase, getSettings } from "@/db";
import { products } from "@/db/schema";
import { ProductDetail } from "@/components/product-detail";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  await ensureDatabase();
  const { slug } = await params;
  const [product] = await db.select().from(products).where(and(eq(products.slug, slug), eq(products.active, true))).limit(1);
  if (!product) return <main className="not-found-product"><h1>Producto no encontrado</h1><p>Puede que ya no esté disponible.</p><Link className="soft-button dark" href="/#tienda">Volver a la tienda</Link></main>;
  const [related, settings] = await Promise.all([
    db.select().from(products).where(and(eq(products.active, true), eq(products.category, product.category), ne(products.id, product.id))).orderBy(asc(products.name)).limit(4),
    getSettings(),
  ]);
  return <ProductDetail product={product} related={related} siteName={settings.siteName ?? "Aysén Training Store"}/>;
}
