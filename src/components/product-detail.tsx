"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import type { Product } from "@/db/schema";

function options(raw: string) { try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : []; } catch { return []; } }
const money = (amount: number) => `$${new Intl.NumberFormat("es-CL").format(amount)}`;

export function ProductDetail({ product, related, siteName }: { product: Product; related: Product[]; siteName: string }) {
  const models = options(product.models); const colors = options(product.colors);
  const [model, setModel] = useState(models[0] ?? ""); const [color, setColor] = useState(colors[0] ?? ""); const [added, setAdded] = useState(false);
  function add() {
    const key = "aysen-cart-v1";
    let cart: { id: string; quantity: number; model?: string; color?: string }[] = [];
    try { cart = JSON.parse(localStorage.getItem(key) ?? "[]"); } catch { cart = []; }
    const line = cart.find((item) => item.id === product.id && (item.model ?? "") === model && (item.color ?? "") === color);
    if (line) line.quantity = Math.min(product.stock, line.quantity + 1); else cart.push({ id: product.id, quantity: 1, model, color });
    localStorage.setItem(key, JSON.stringify(cart)); window.dispatchEvent(new Event("aysen-cart-change")); setAdded(true); window.setTimeout(() => setAdded(false), 2500);
  }
  return <main className="product-detail-page"><header className="detail-nav"><Link className="brand-inline" href="/"><Image src="/api/brand/logo" alt="" width={40} height={40} unoptimized/><span className="brandtype">AYSÉN<small>TRAINING STORE</small></span></Link><Link className="soft-button" href="/#tienda"><ArrowLeft size={15}/> Volver a la tienda</Link></header><div className="product-detail-grid"><div className="detail-image">{product.imageUrl && <Image src={product.imageUrl} alt={product.name} fill sizes="(max-width: 760px) 100vw, 55vw" unoptimized/>}{product.compareAtPrice && product.compareAtPrice > product.price && <span className="offer-tag">Oferta</span>}</div><section className="detail-copy"><span className="kicker">{product.category} · {siteName}</span><h1>{product.name}</h1><p className="detail-price">{money(product.price)} {product.compareAtPrice && product.compareAtPrice > product.price && <del>{money(product.compareAtPrice)}</del>}</p><p>{product.description}</p>{models.length > 0 && <label className="detail-option">Modelo<select value={model} onChange={(e) => setModel(e.target.value)}>{models.map((item) => <option key={item}>{item}</option>)}</select></label>}{colors.length > 0 && <label className="detail-option">Color<select value={color} onChange={(e) => setColor(e.target.value)}>{colors.map((item) => <option key={item}>{item}</option>)}</select></label>}<p className="detail-stock">{product.stock > 0 ? `${product.stock} disponibles` : "Agotado"}</p><button className="primary-button" disabled={product.stock < 1} onClick={add}><ShoppingCart size={16}/> {added ? "Agregado a tu bolsa" : "Agregar al carro"}</button><p className="notice">Pago disponible por transferencia bancaria. La entrega se cotiza al continuar la compra.</p></section></div>{related.length > 0 && <section className="related-section"><div className="section-head"><div><span className="kicker">Completa tu equipo</span><h2>Productos relacionados</h2></div><Link href="/#tienda" className="mini-action">Ver tienda →</Link></div><div className="product-grid">{related.map((item) => <Link className="product-card related-card" href={`/producto/${item.slug}`} key={item.id}><div className="product-photo">{item.imageUrl && <Image src={item.imageUrl} alt={item.name} fill sizes="(max-width: 760px) 45vw, 25vw" unoptimized/>}</div><div className="product-info"><span className="product-category">{item.category}</span><h3>{item.name}</h3><span className="product-price">{money(item.price)}</span></div></Link>)}</div></section>}</main>;
}
