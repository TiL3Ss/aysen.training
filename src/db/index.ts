import "server-only";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import * as schema from "./schema";
import { chileRegions } from "@/lib/shipping";

const url = process.env.TURSO_DATABASE_URL ?? "file:./aysen.local.db";
const authToken = process.env.TURSO_AUTH_TOKEN;
const client = createClient({ url, ...(authToken ? { authToken } : {}) });
export const db = drizzle(client, { schema });

declare global {
  var aysenDbReady: Promise<void> | undefined;
}

const starterProducts = [
  { id: "gear-kettlebell-12", name: "Kettlebell de hierro 12 kg", slug: "kettlebell-hierro-12kg", description: "Agarre firme y acabado resistente para tus entrenamientos de fuerza.", category: "Fuerza", price: 34990, stock: 8, imageUrl: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1000&q=85", active: true },
  { id: "gear-bands-set", name: "Set de bandas de resistencia", slug: "bandas-resistencia-set", description: "Tres niveles de tensión, fáciles de llevar y guardar.", category: "Accesorios", price: 14990, stock: 14, imageUrl: "https://images.unsplash.com/photo-1598289431512-b97b0917affc?auto=format&fit=crop&w=1000&q=85", active: true },
  { id: "gear-training-mat", name: "Mat de entrenamiento", slug: "mat-entrenamiento", description: "Superficie antideslizante para movilidad, fuerza y recuperación.", category: "Entrenamiento", price: 22990, stock: 6, imageUrl: "https://images.unsplash.com/photo-1599447421416-3414500d18a5?auto=format&fit=crop&w=1000&q=85", active: true },
  { id: "gear-dumbbells-5", name: "Mancuernas hexagonales 5 kg", slug: "mancuernas-hexagonales-5kg", description: "Par recubierto, estable en el suelo y cómodo de sujetar.", category: "Fuerza", price: 27990, stock: 9, imageUrl: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=1000&q=85", active: true },
  { id: "gear-jump-rope", name: "Cuerda de salto ajustable", slug: "cuerda-salto-ajustable", description: "Ligera, regulable y lista para llevar a cualquier parte.", category: "Accesorios", price: 9990, stock: 20, imageUrl: "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1000&q=85", active: true },
  { id: "gear-training-bag", name: "Bolso Training 30 L", slug: "bolso-training-30l", description: "Espacio para tu equipo y lo esencial de cada jornada.", category: "Entrenamiento", price: 31990, stock: 5, imageUrl: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1000&q=85", active: true },
];

const starterSettings: Record<string, string> = {
  siteName: "Aysén Training Store",
  siteDescription: "Equipamiento deportivo seleccionado para acompañarte en cada entrenamiento, desde la Patagonia.",
  tagline: "La fuerza de moverte.",
  heroDescription: "Equipo funcional para entrenar a tu manera, en el sur del mundo y donde tú llegues.",
  heroEyebrow: "Entrena a tu manera · desde la Patagonia",
  heroCtaText: "Explorar equipamiento",
  heroCtaHref: "#tienda",
  heroNote: "AYSÉN · 45°34′S · 72°04′O",
  storyEyebrow: "Sur · movimiento · comunidad",
  storyTitle: "El carácter del sur, en cada entrenamiento.",
  storyDescription: "Nacimos en Aysén con una idea sencilla: acercar buen equipamiento a quienes hacen del movimiento parte de su vida. Elegimos piezas funcionales y versátiles, hechas para acompañar desafíos grandes y pequeños.",
  storyCoordinates: "COYHAIQUE, CHILE / 45°34′ S",
  footerDescription: "Equipamiento deportivo seleccionado en Coyhaique, Patagonia. Entrena a tu manera, estés donde estés.",
  passwordResetEnabled: "false",
  logoData: "",
  faviconData: "",
  bankName: "Pendiente de configurar",
  bankAccountType: "Cuenta vista",
  bankAccount: "",
  bankRut: "",
  bankHolder: "Aysén Training Store",
  bankEmail: "",
  companyName: "",
  companyRut: "",
  companyAddress: "",
  companyEmail: "",
  companyPhone: "",
  legalRepresentative: "",
  shippingRates: JSON.stringify({ aysen: 2990, patagonia: 6990, south: 5990, central: 4990, north: 6990 }),
  localDeliveryOnly: "false",
  siiEmissionEnabled: "false",
  pickupEnabled: "true",
  pickupAddress: "Coyhaique, Región de Aysén",
  shippingDestinations: JSON.stringify([
    ["aysen","Región de Aysén","aysen"],["magallanes","Región de Magallanes","patagonia"],["los-lagos","Región de Los Lagos","south"],["los-rios","Región de Los Ríos","south"],["araucania","Región de La Araucanía","south"],["nuble","Región de Ñuble","central"],["biobio","Región del Biobío","central"],["maule","Región del Maule","central"],["ohiggins","Región de O’Higgins","central"],["metropolitana","Región Metropolitana","central"],["valparaiso","Región de Valparaíso","central"],["coquimbo","Región de Coquimbo","north"],["atacama","Región de Atacama","north"],["antofagasta","Región de Antofagasta","north"],["tarapaca","Región de Tarapacá","north"],["arica","Región de Arica y Parinacota","north"]
  ].map(([id,name,zone])=>({id,name,price:({aysen:2990,patagonia:6990,south:5990,central:4990,north:6990} as Record<string,number>)[zone],days:id==="aysen"?"1–2 días hábiles":"3–8 días hábiles",enabled:true}))),
};

export async function ensureDatabase() {
  if (process.env.NODE_ENV === "production" && !process.env.TURSO_DATABASE_URL) {
    throw new Error("TURSO_DATABASE_URL debe configurarse en producción. No se permite usar SQLite local en Vercel.");
  }
  if (process.env.TURSO_DATABASE_URL && !process.env.TURSO_AUTH_TOKEN) {
    throw new Error("TURSO_AUTH_TOKEN es obligatorio para conectarse a Turso.");
  }
  if (!globalThis.aysenDbReady) {
    globalThis.aysenDbReady = (async () => {
      await client.executeMultiple(`
        CREATE TABLE IF NOT EXISTS customers (
          id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, phone TEXT NOT NULL DEFAULT '',
          password_hash TEXT NOT NULL, terms_accepted_at TEXT NOT NULL, privacy_accepted_at TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS customer_addresses (
          id TEXT PRIMARY KEY NOT NULL, customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
          label TEXT NOT NULL DEFAULT 'Casa', region TEXT NOT NULL, city TEXT NOT NULL, street TEXT NOT NULL,
          street_number TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', is_default INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS customer_password_reset_tokens (
          id TEXT PRIMARY KEY NOT NULL, customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
          token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, used_at TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL UNIQUE, active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS site_banners (
          id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL,
          link_text TEXT NOT NULL DEFAULT '', link_url TEXT NOT NULL DEFAULT '', starts_at TEXT, ends_at TEXT,
          background_color TEXT NOT NULL DEFAULT '#1b2620', text_color TEXT NOT NULL DEFAULT '#eefaf0', font_size INTEGER NOT NULL DEFAULT 15, bold INTEGER NOT NULL DEFAULT 0, italic INTEGER NOT NULL DEFAULT 0,
          active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
          description TEXT NOT NULL DEFAULT '', category TEXT NOT NULL, price INTEGER NOT NULL,
          stock INTEGER NOT NULL DEFAULT 0, image_url TEXT NOT NULL DEFAULT '',
          compare_at_price INTEGER, models TEXT NOT NULL DEFAULT '[]', colors TEXT NOT NULL DEFAULT '[]',
          active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY NOT NULL, customer_id TEXT, delivery_method TEXT NOT NULL DEFAULT 'shipping', customer_name TEXT NOT NULL, email TEXT NOT NULL,
          phone TEXT NOT NULL, address TEXT NOT NULL, commune TEXT NOT NULL, region TEXT NOT NULL,
          delivery_note TEXT NOT NULL DEFAULT '', shipping_zone TEXT NOT NULL,
          shipping_destination_name TEXT NOT NULL DEFAULT '',
          transfer_proof TEXT, transfer_token_hash TEXT, tracking_token_hash TEXT,
          subtotal INTEGER NOT NULL, shipping_price INTEGER NOT NULL, total INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'Pendiente de transferencia',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS order_items (
          id TEXT PRIMARY KEY NOT NULL, order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
          product_id TEXT NOT NULL, product_name TEXT NOT NULL, unit_price INTEGER NOT NULL, quantity INTEGER NOT NULL, selection TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS site_settings (
          key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      for (const [table, columns] of Object.entries({ customers: { phone: "TEXT NOT NULL DEFAULT ''" }, site_banners: { background_color: "TEXT NOT NULL DEFAULT '#1b2620'", text_color: "TEXT NOT NULL DEFAULT '#eefaf0'", font_size: "INTEGER NOT NULL DEFAULT 15", bold: "INTEGER NOT NULL DEFAULT 0", italic: "INTEGER NOT NULL DEFAULT 0" }, products: { compare_at_price: "INTEGER", models: "TEXT NOT NULL DEFAULT '[]'", colors: "TEXT NOT NULL DEFAULT '[]'" }, orders: { customer_id: "TEXT", delivery_method: "TEXT NOT NULL DEFAULT 'shipping'", shipping_destination_name: "TEXT NOT NULL DEFAULT ''", transfer_proof: "TEXT", transfer_token_hash: "TEXT", tracking_token_hash: "TEXT" }, order_items: { selection: "TEXT NOT NULL DEFAULT ''" } })) {
        const info = await client.execute(`PRAGMA table_info(${table})`);
        const present = new Set(info.rows.map((row) => String(row.name)));
        for (const [column, definition] of Object.entries(columns)) if (!present.has(column)) await client.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      }
      const current = await db.select({ id: schema.products.id }).from(schema.products).limit(1);
      if (!current.length && process.env.NODE_ENV !== "production") {
        await db.insert(schema.products).values(starterProducts);
      }
      const savedCategories = await db.select({ id: schema.categories.id }).from(schema.categories).limit(1);
      if (!savedCategories.length) {
        const existingProducts=await db.select({category:schema.products.category}).from(schema.products);
        const categoriesToSeed = [...new Set(existingProducts.map((product)=>product.category))].map((name, sortOrder) => ({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name, active: true, sortOrder }));
        if (categoriesToSeed.length) await db.insert(schema.categories).values(categoriesToSeed);
      }
      const existingSettings = await db.select().from(schema.siteSettings);
      const settingsMap = Object.fromEntries(existingSettings.map((row) => [row.key, row.value]));
      if (!settingsMap.shippingDestinations) {
        let legacyRates: Record<string, number> = {};
        try { legacyRates = JSON.parse(settingsMap.shippingRates ?? starterSettings.shippingRates) as Record<string, number>; } catch { legacyRates = {}; }
        const legacyZone: Record<string, string> = { aysen: "aysen", magallanes: "patagonia", "los-lagos": "south", "los-rios": "south", araucania: "south", nuble: "central", biobio: "central", maule: "central", ohiggins: "central", metropolitana: "central", valparaiso: "central", coquimbo: "north", atacama: "north", antofagasta: "north", tarapaca: "north", arica: "north" };
        starterSettings.shippingDestinations = JSON.stringify(chileRegions.map((destination) => ({ ...destination, price: legacyRates[legacyZone[destination.id]] ?? destination.price })));
      }
      for (const [key, value] of Object.entries(starterSettings)) {
        await db.insert(schema.siteSettings).values({ key, value }).onConflictDoNothing();
      }
    })();
  }
  await globalThis.aysenDbReady;
}

export async function getSettings() {
  await ensureDatabase();
  const rows = await db.select().from(schema.siteSettings);
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export async function getSetting(key: string, fallback = "") {
  await ensureDatabase();
  const [row] = await db.select({ value: schema.siteSettings.value }).from(schema.siteSettings).where(eq(schema.siteSettings.key, key)).limit(1);
  return row?.value ?? fallback;
}
