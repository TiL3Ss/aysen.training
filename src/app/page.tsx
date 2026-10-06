import { asc, eq } from "drizzle-orm";
import { db, ensureDatabase, getSettings } from "@/db";
import { products } from "@/db/schema";
import { Shopfront } from "@/components/shopfront";
import { readDestinations } from "@/lib/shipping";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { siteBanners } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function Home() {
  await ensureDatabase();
  const [items, settings, customer, banners] = await Promise.all([
    db.select().from(products).where(eq(products.active, true)).orderBy(asc(products.name)),
    getSettings(),
    getCurrentCustomer(),
    db.select().from(siteBanners).where(eq(siteBanners.active, true)).orderBy(asc(siteBanners.sortOrder)),
  ]);
  const destinations = readDestinations(settings.shippingDestinations);
  // eslint-disable-next-line react-hooks/purity -- time window is evaluated once for this dynamic server response.
  const now = Date.now();
  const liveBanners = banners.filter((banner) => (!banner.startsAt || Date.parse(banner.startsAt) <= now) && (!banner.endsAt || Date.parse(banner.endsAt) >= now));
  return <Shopfront products={items} settings={{ ...settings, logoData: "", faviconData: "" }} destinations={destinations} localOnly={settings.localDeliveryOnly === "true"} customer={customer} banners={liveBanners} />;
}
