import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  category: text("category").notNull(),
  price: integer("price").notNull(),
  compareAtPrice: integer("compare_at_price"),
  models: text("models").notNull().default("[]"),
  colors: text("colors").notNull().default("[]"),
  stock: integer("stock").notNull().default(0),
  imageUrl: text("image_url").notNull().default(""),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

export const customers = sqliteTable("customers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull().default(""),
  passwordHash: text("password_hash").notNull(),
  termsAcceptedAt: text("terms_accepted_at").notNull(),
  privacyAcceptedAt: text("privacy_accepted_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

export const customerAddresses = sqliteTable("customer_addresses", {
  id: text("id").primaryKey(), customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  label: text("label").notNull().default("Casa"), region: text("region").notNull(), city: text("city").notNull(),
  street: text("street").notNull(), streetNumber: text("street_number").notNull(), detail: text("detail").notNull().default(""),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false), createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

export const customerPasswordResetTokens = sqliteTable("customer_password_reset_tokens", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(), name: text("name").notNull().unique(), active: integer("active", { mode: "boolean" }).notNull().default(true), sortOrder: integer("sort_order").notNull().default(0),
});

export const siteBanners = sqliteTable("site_banners", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  linkText: text("link_text").notNull().default(""),
  linkUrl: text("link_url").notNull().default(""),
  backgroundColor: text("background_color").notNull().default("#1b2620"),
  textColor: text("text_color").notNull().default("#eefaf0"),
  fontSize: integer("font_size").notNull().default(15),
  bold: integer("bold", { mode: "boolean" }).notNull().default(false),
  italic: integer("italic", { mode: "boolean" }).notNull().default(false),
  startsAt: text("starts_at"),
  endsAt: text("ends_at"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  customerId: text("customer_id"),
  deliveryMethod: text("delivery_method").notNull().default("shipping"),
  customerName: text("customer_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  commune: text("commune").notNull(),
  region: text("region").notNull(),
  deliveryNote: text("delivery_note").notNull().default(""),
  shippingZone: text("shipping_zone").notNull(),
  shippingDestinationName: text("shipping_destination_name").notNull().default(""),
  transferProof: text("transfer_proof"),
  transferTokenHash: text("transfer_token_hash"),
  trackingTokenHash: text("tracking_token_hash"),
  subtotal: integer("subtotal").notNull(),
  shippingPrice: integer("shipping_price").notNull(),
  total: integer("total").notNull(),
  status: text("status").notNull().default("Pendiente de transferencia"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

export const orderItems = sqliteTable("order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull(),
  productName: text("product_name").notNull(),
  unitPrice: integer("unit_price").notNull(),
  quantity: integer("quantity").notNull(),
  selection: text("selection").notNull().default(""),
});

export const siteSettings = sqliteTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
});

export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
