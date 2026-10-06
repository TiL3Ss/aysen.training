"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import { ArrowDownRight, ArrowRight, Dumbbell, Mountain, PackageCheck, Search, ShoppingBag, ShieldCheck, X, ShoppingCart } from "lucide-react";
import type { Product } from "@/db/schema";
import { createOrder, uploadTransferProof } from "@/lib/actions";
import Link from "next/link";
import type { ShippingDestination } from "@/lib/shipping";
import { citiesForRegion } from "@/lib/chile-address";
import { PromoCarousel } from "@/components/promo-carousel";

type CartItem = { id: string; quantity: number; model?: string; color?: string };
type Settings = Record<string, string>;
const CART_KEY = "aysen-cart-v1";
let cartCache: CartItem[] = [];
let cartCacheRaw: string | null | undefined;
const serverCart: CartItem[] = [];
function cartSnapshot() {
  const raw = localStorage.getItem(CART_KEY);
  if (raw === cartCacheRaw) return cartCache;
  cartCacheRaw = raw;
  try { cartCache = JSON.parse(raw ?? "[]") as CartItem[]; } catch { cartCache = []; }
  return cartCache;
}
function subscribeCart(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("aysen-cart-change", callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener("aysen-cart-change", callback); };
}
function serverCartSnapshot(): CartItem[] { return serverCart; }
function updateCart(updater: (current: CartItem[]) => CartItem[]) {
  const next = updater(cartSnapshot());
  cartCache = next; cartCacheRaw = JSON.stringify(next);
  localStorage.setItem(CART_KEY, cartCacheRaw);
  window.dispatchEvent(new Event("aysen-cart-change"));
}
const formatPrice = (value: number) => `$${new Intl.NumberFormat("es-CL").format(value)}`;

function compressProof(file: File) {
  if (file.type === "application/pdf") {
    if (file.size > 2_800_000) return Promise.reject(new Error("El comprobante PDF debe pesar menos de 2.8 MB."));
    return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => { const value = String(reader.result ?? ""); if (value.length > 3_900_000) reject(new Error("El PDF sigue siendo demasiado grande.")); else resolve(value); }; reader.onerror = () => reject(new Error("No se pudo leer el comprobante PDF.")); reader.readAsDataURL(file); });
  }
  if (!file.type.startsWith("image/")) return Promise.reject(new Error("El comprobante debe ser una imagen o un archivo PDF."));
  if (file.size > 12 * 1024 * 1024) return Promise.reject(new Error("La imagen debe pesar menos de 12 MB."));
  return new Promise<string>((resolve, reject) => {
    const url = URL.createObjectURL(file); const image = new window.Image();
    image.onload = () => { const ratio = Math.min(1, 1400 / Math.max(image.width, image.height)); const canvas = document.createElement("canvas"); canvas.width = Math.round(image.width * ratio); canvas.height = Math.round(image.height * ratio); canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height); URL.revokeObjectURL(url); const result = canvas.toDataURL("image/webp", 0.78); if (result.length > 3_900_000) reject(new Error("La imagen sigue siendo demasiado grande. Selecciona una foto más liviana.")); else resolve(result); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo leer la imagen.")); }; image.src = url;
  });
}

type Banner = { id: string; title: string; message: string; linkText: string; linkUrl: string; backgroundColor:string;textColor:string;fontSize:number;bold:boolean;italic:boolean };
type Customer = { id: string; name: string; email: string; phone:string } | null;
export function Shopfront({ products, settings, destinations, localOnly, customer = null, banners = [] }: { products: Product[]; settings: Settings; destinations: ShippingDestination[]; localOnly: boolean; customer?: Customer; banners?: Banner[] }) {
  const router = useRouter();
  const cart = useSyncExternalStore(subscribeCart, cartSnapshot, serverCartSnapshot);
  const setCart = updateCart;
  const [drawer, setDrawer] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [deliveryMethod,setDeliveryMethod]=useState<"shipping"|"pickup">("shipping");
  const [confirmation, setConfirmation] = useState<{ orderId: string; total: number; uploadToken: string; emailSent: boolean; customerEmail: string; trackingUrl: string } | null>(null);
  const [zone, setZone] = useState(destinations.find((item) => item.enabled)?.id ?? "aysen");
  const [category, setCategory] = useState("Todo");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");
  const [city, setCity] = useState(citiesForRegion(destinations.find((item) => item.id === zone)?.id ?? "aysen")[0] ?? "");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofBusy, setProofBusy] = useState(false);
  const [proofMessage, setProofMessage] = useState("");

  const filtered = useMemo(() => products.filter((p) => (category === "Todo" || p.category === category) && `${p.name} ${p.description}`.toLowerCase().includes(search.toLowerCase())), [products, category, search]);
  const lines = cart.map((line) => ({ ...line, product: products.find((p) => p.id === line.id) })).filter((line): line is CartItem & { product: Product } => !!line.product);
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.product.price, 0);
  const shipping = deliveryMethod === "pickup" ? 0 : destinations.find((item) => item.id === zone)?.price ?? 0;
  const total = subtotal + shipping;
  const currentZone = destinations.find((item) => item.id === zone) ?? destinations[0];
  const cityOptions = citiesForRegion(localOnly ? "aysen" : zone);

  function changeDestination(id: string) {
    setZone(id);
    const firstCity = citiesForRegion(id)[0] ?? "";
    setCity(firstCity);
  }

  function changeQty(product: Product, diff: number, model = "", color = "") {
    updateCart((current) => {
      const line = current.find((item) => item.id === product.id && (item.model ?? "") === model && (item.color ?? "") === color);
      const next = (line?.quantity ?? 0) + diff;
      if (next > product.stock) { setError("No hay más unidades disponibles en este momento."); return current; }
      setError("");
      if (next > 0 && !line) setToast(`${product.name} agregado a tu bolsa`);
      return next < 1 ? current.filter((item) => !(item.id === product.id && (item.model ?? "") === model && (item.color ?? "") === color)) : line ? current.map((item) => item === line ? { ...item, quantity: next } : item) : [...current, { id: product.id, quantity: next, model, color }];
    });
    window.setTimeout(() => setToast(""), 2500);
  }

  async function submitOrder(formData: FormData) {
    setError(""); setSubmitting(true);
    const payload = {
      name: formData.get("name"), email: formData.get("email"), phone: formData.get("phone"),
      street: formData.get("street") ?? "", streetNumber: formData.get("streetNumber") ?? "", addressDetail: formData.get("addressDetail") ?? "", city: formData.get("city") ?? "", region: formData.get("region") ?? "",
      note: formData.get("note"), zone: localOnly ? "aysen" : zone, deliveryMethod, lines: cart.map(({ id, quantity, model = "", color = "" }) => ({ productId: id, quantity, model, color })),
    };
    try {
      const result = await createOrder(payload);
      if (!result.ok) { setError(result.message); setSubmitting(false); return; }
      setConfirmation({ orderId: result.orderId, total: result.total, uploadToken: result.uploadToken, emailSent: result.emailSent, customerEmail: result.customerEmail, trackingUrl: result.trackingUrl }); setProofFile(null); setProofMessage(""); updateCart(() => []); setCheckout(false); setDrawer(false); setSubmitting(false); router.refresh();
    } catch { setError("No se pudo guardar el pedido. Inténtalo otra vez."); setSubmitting(false); }
  }

  async function attachProof() {
    if (!confirmation || !proofFile) return;
    setProofBusy(true); setProofMessage("");
    try {
      const proof = await compressProof(proofFile);
      const result = await uploadTransferProof({ orderId: confirmation.orderId, token: confirmation.uploadToken, proof });
      if (!result.ok) setProofMessage(result.message);
      else { setProofMessage("Comprobante recibido. La tienda verificará la transferencia."); setProofFile(null); }
    } catch (cause) { setProofMessage(cause instanceof Error ? cause.message : "No se pudo adjuntar el comprobante."); }
    finally { setProofBusy(false); }
  }

  const imageLogo = <Image src="/api/brand/logo" alt={settings.siteName || "Aysén Training Store"} width={48} height={48} className="brandmark" unoptimized />;

  return <>
    {toast && <div className="shop-toast" role="status">{toast}</div>}
    <PromoCarousel banners={banners} fallback={localOnly ? "Entrega local disponible en Aysén" : "Despachamos a todo Chile · Cotiza tu envío al comprar"}/>
    <header className="nav">
      <a className="brand" href="#inicio" aria-label="Volver al inicio">{imageLogo}<span className="brandtype">AYSÉN<small>TRAINING STORE</small></span></a>
      <nav className="navlinks"><a href="#tienda">Tienda</a><a href="#origen">Nuestro origen</a>{!localOnly && <a href="#envios">Envíos</a>}</nav>
      <div className="navactions"><Link className="account-link" href={customer ? "/cuenta" : "/cuenta/ingresar"}>{customer ? customer.name.split(" ")[0] : "Iniciar Sesión"}</Link><button className="soft-icon" aria-label="Abrir bolsa" onClick={() => setDrawer(true)}><ShoppingBag/><span className="cart-word">Bolsa</span><span className="count">{count}</span></button></div>
    </header>
    <main>
      <section className="hero" id="inicio"><div className="hero-panel"><div className="hero-copy"><span className="eyebrow">{settings.heroEyebrow || "Entrena a tu manera · desde la Patagonia"}</span><h1>{settings.tagline || "La fuerza de moverte."}</h1><p>{settings.heroDescription || "Equipo funcional para entrenar a tu manera, en el sur del mundo y donde tú llegues."}</p><a className="soft-button dark hero-action" href={settings.heroCtaHref || "#tienda"}>{settings.heroCtaText || "Explorar equipamiento"} <ArrowDownRight/></a></div><span className="hero-note">{settings.heroNote || "AYSÉN · 45°34′S · 72°04′O"}</span></div></section>
      <section className="quickfacts" id={!localOnly ? "envios" : undefined}><div className="fact"><span className="fact-icon"><Mountain/></span><div><strong>{localOnly ? "Entrega local" : "Envío desde la Patagonia"}</strong><small>{localOnly ? "Coyhaique y alrededores" : "Coyhaique · Chile"}</small></div></div>{!localOnly && <div className="fact"><span className="fact-icon"><PackageCheck/></span><div><strong>Cotización por región</strong><small>Tarifa visible antes de pagar</small></div></div>}<div className="fact"><span className="fact-icon"><ShieldCheck/></span><div><strong>Transferencia directa</strong><small>Sin recargos de pasarela</small></div></div></section>
      <section className="section" id="tienda"><div className="section-head"><div><span className="kicker">Equipo seleccionado · Aysén</span><h2>Encuentra tu próximo impulso.</h2></div><span className="section-sub">{filtered.length} piezas para moverte a tu ritmo</span></div><div className="filterbar">{["Todo", ...new Set(products.map((p) => p.category))].map((item) => <button key={item} className={`category-chip ${category === item ? "active" : ""}`} onClick={() => setCategory(item)}>{item === "Todo" ? "Todo el equipo" : item}</button>)}<label className="search-box"><Search/><input placeholder="Busca tu equipo…" value={search} onChange={(event) => setSearch(event.target.value)}/></label></div>
        <div className="product-grid">{filtered.length ? filtered.map((product) => <article className="product-card" key={product.id}><Link className="product-photo" href={`/producto/${product.slug}`} aria-label={`Ver ${product.name}`}>{product.imageUrl && <Image src={product.imageUrl} alt={product.name} fill sizes="(max-width: 760px) 45vw, 25vw" unoptimized/>}<span className="product-tag">{product.category}</span>{product.compareAtPrice && product.compareAtPrice > product.price && <span className="offer-tag">Oferta</span>}<span className="stock-label">{product.stock > 0 ? `${product.stock} disponibles` : "Agotado"}</span></Link><div className="product-info"><span className="product-category">Aysén Training / {product.category}</span><Link href={`/producto/${product.slug}`}><h3>{product.name}</h3></Link><p>{product.description}</p><div className="product-buy"><span className="product-price">{formatPrice(product.price)} {product.compareAtPrice && product.compareAtPrice > product.price && <del>{formatPrice(product.compareAtPrice)}</del>}</span><button className="add-button" aria-label={`Agregar ${product.name}`} disabled={product.stock < 1} onClick={() => changeQty(product, 1)}><ShoppingCart size={17}/></button></div></div></article>) : <div className="empty-results">No encontramos equipo con ese nombre. Prueba otra búsqueda.</div>}</div>
      </section>
      <section className="story" id="origen"><div><span className="eyebrow">{settings.storyEyebrow || "Sur · movimiento · comunidad"}</span><h2>{settings.storyTitle || "El carácter del sur, en cada entrenamiento."}</h2></div><div><p>{settings.storyDescription || "Nacimos en Aysén con una idea sencilla: acercar buen equipamiento a quienes hacen del movimiento parte de su vida. Elegimos piezas funcionales y versátiles, hechas para acompañar desafíos grandes y pequeños."}</p><span className="coordinates">{settings.storyCoordinates || "COYHAIQUE, CHILE / 45°34′ S"}</span></div></section>
      <section className="newsletter"><div><strong>¿Tienes dudas sobre un producto?</strong><p>Conversemos y te ayudamos a elegir tu equipo.</p></div><a className="soft-button" href="https://instagram.com/aysen.training.store" target="_blank" rel="noreferrer">Escríbenos <ArrowRight size={14}/></a></section>
    </main>
    <footer><div className="footer-row"><div><div className="brand-inline">{imageLogo}<span className="brandtype">AYSÉN<small>TRAINING STORE</small></span></div><p>{settings.footerDescription || "Equipamiento deportivo seleccionado en Coyhaique, Patagonia. Entrena a tu manera, estés donde estés."}</p></div><p><b>Compra sin sorpresas</b><br/>{localOnly ? "Entrega local en Aysén." : "Cotiza el envío antes de finalizar."}<br/>Paga por transferencia bancaria.<br/>Te contactaremos para confirmar tu pedido.<br/><Link href="/terminos">Términos y condiciones</Link> · <Link href="/privacidad">Privacidad</Link></p></div><div className="copyright">© 2026 {settings.siteName || "Aysén Training Store"} · Hecho en Aysén, Patagonia.</div></footer>

    <div className={`overlay ${drawer ? "open" : ""}`} onClick={() => setDrawer(false)} />
    <aside className={`cart-drawer ${drawer ? "open" : ""}`} aria-label="Bolsa de compra"><div className="drawer-head"><h2>Tu bolsa <span className="section-sub">· {count} piezas</span></h2><button className="close-button" aria-label="Cerrar bolsa" onClick={() => setDrawer(false)}><X/></button></div><div className="cart-lines">{lines.length ? lines.map(({ product, quantity, model, color }) => <div className="cart-line" key={`${product.id}:${model}:${color}`}><Image src={product.imageUrl || "/placeholder.svg"} alt="" width={72} height={73} unoptimized/><div><b>{product.name}</b><small>{[model,color].filter(Boolean).join(" · ") || formatPrice(product.price)}</small><div className="quantity"><button onClick={() => changeQty(product, -1, model, color)} aria-label="Restar una unidad">−</button><span>{quantity}</span><button onClick={() => changeQty(product, 1, model, color)} aria-label="Sumar una unidad">+</button><button className="remove" onClick={() => setCart((current) => current.filter((item) => !(item.id === product.id && item.model === model && item.color === color)))}>Quitar</button></div></div><b>{formatPrice(product.price * quantity)}</b></div>) : <div className="empty-cart"><Dumbbell size={29}/><p>Tu bolsa está lista para el primer paso.</p></div>}</div>{lines.length > 0 && <div className="cart-summary">{!localOnly && <div className="shipping-sim"><label htmlFor="zone">Simula tu envío</label><select id="zone" value={zone} onChange={(event) => changeDestination(event.target.value)}>{destinations.filter((item) => item.enabled).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><small>Estimado: {currentZone.days}. Tarifa: {formatPrice(destinations.find(d=>d.id===zone)?.price??0)}. Confirmamos cobertura antes del despacho.</small></div>} {localOnly && <div className="shipping-sim local-delivery-card"><b>Entrega local en Aysén</b><small>Coyhaique y alrededores · {currentZone.days}</small></div>}<div className="summary-row"><span>Productos</span><b>{formatPrice(subtotal)}</b></div><div className="summary-row"><span>{localOnly ? "Entrega local" : `Envío · ${currentZone.name}`}</span><b>{formatPrice(destinations.find(d=>d.id===zone)?.price??0)}</b></div><div className="summary-row total"><span>Total estimado</span><span>{formatPrice(subtotal+(destinations.find(d=>d.id===zone)?.price??0))}</span></div><button className="primary-button" onClick={() => { setError(""); setDeliveryMethod("shipping"); setCheckout(true); }}>Continuar compra</button>{!localOnly && <p>Elige retiro en sucursal durante el checkout si prefieres no pagar despacho.</p>}</div>}</aside>

    {checkout && <div className="modal-backdrop visible" onMouseDown={(event) => { if (event.target === event.currentTarget) setCheckout(false); }}><section className="modal-card"><div className="modal-head"><h2>{deliveryMethod==="pickup"?"Prepara tu retiro":"Prepara tu envío"}</h2><button className="close-button" onClick={() => setCheckout(false)}><X/></button></div><p className="modal-body-copy">{deliveryMethod==="pickup"?`Retira tu pedido en ${settings.pickupAddress||"Coyhaique, Región de Aysén"}. Sin costo de envío.`:<>Tu total incluye el envío estimado a <b>{currentZone.name}</b>. Elige la región para ajustar la cotización.</>}</p><form action={submitOrder}><div className="checkout-fields"><label>Nombre y apellido<input name="name" autoComplete="name" defaultValue={customer?.name} required minLength={2}/></label><label>Teléfono<input name="phone" autoComplete="tel" defaultValue={customer?.phone} required/></label><label className="full">Correo electrónico<input type="email" name="email" autoComplete="email" defaultValue={customer?.email} required/></label>{settings.pickupEnabled==="true"&&<fieldset className="delivery-choice full"><legend>¿Cómo quieres recibir tu compra?</legend><label><input type="radio" name="deliveryChoice" checked={deliveryMethod==="shipping"} onChange={()=>setDeliveryMethod("shipping")}/> Envío a domicilio</label><label><input type="radio" name="deliveryChoice" checked={deliveryMethod==="pickup"} onChange={()=>setDeliveryMethod("pickup")}/> Retiro en sucursal sin costo</label></fieldset>}<input type="hidden" name="deliveryMethod" value={deliveryMethod}/>{deliveryMethod==="pickup"?<><input type="hidden" name="region" value="Región de Aysén"/><input type="hidden" name="city" value="Coyhaique"/></>:<><h3 className="address-divider">Dirección de entrega</h3>{localOnly?<input type="hidden" name="region" value={destinations.find((item)=>item.id==="aysen")?.name??"Región de Aysén"}/>:<label>Región<select className="region-select" name="region" required value={destinations.find((item)=>item.id===zone)?.name??""} onChange={(event)=>{const match=destinations.find((item)=>item.name===event.target.value);if(match)changeDestination(match.id)}}><option value="" disabled>Selecciona tu región</option>{destinations.filter((item)=>item.enabled).map(item=><option value={item.name} key={item.id}>{item.name}</option>)}</select></label>}<label>Ciudad<select className="region-select" name="city" required value={city} onChange={event=>setCity(event.target.value)}><option value="" disabled>Selecciona tu ciudad</option>{cityOptions.map(item=><option value={item} key={item}>{item}</option>)}</select></label><label>Calle<input name="street" autoComplete="address-line1" required maxLength={120}/></label><label>Número<input name="streetNumber" required maxLength={20}/></label><label>Depto / casa (opcional)<input name="addressDetail" autoComplete="address-line2" maxLength={60}/></label></>}<label className="full">Referencia para la entrega<textarea name="note" maxLength={300}/></label></div>{error&&<p className="error-message">{error}</p>}<div className="summary-row"><span>{deliveryMethod==="pickup"?"Retiro en sucursal":`Envío · ${currentZone.name}`}</span><b>{formatPrice(shipping)}</b></div><div className="summary-row total"><span>Total con entrega</span><span>{formatPrice(total)}</span></div><button disabled={submitting} className="primary-button">{submitting?"Registrando pedido…":"Confirmar pedido por transferencia"}</button></form><p className="notice">Al confirmar se reserva el stock. El equipo revisará la transferencia antes de preparar el despacho.</p></section></div>}

    {confirmation && <div className="modal-backdrop visible"><section className="modal-card"><div className="modal-head"><h2>Pedido recibido ✓</h2><button className="close-button" onClick={() => setConfirmation(null)}><X/></button></div><p className="modal-body-copy">Tu pedido <b>{confirmation.orderId}</b> quedó registrado por <b>{formatPrice(confirmation.total)}</b>. Indica el número de pedido al hacer la transferencia.</p><p className={confirmation.emailSent ? "success-message" : "notice"} role="status">{confirmation.emailSent ? <>Enviamos el comprobante a <b>{confirmation.customerEmail}</b>. <Link href={confirmation.trackingUrl}>Consultar estado del pedido</Link></> : <>No pudimos enviar el correo automáticamente. Guarda tu número de pedido y <Link href={confirmation.trackingUrl}>consulta aquí su estado</Link>.</>}</p><div className="transfer-box"><b>Datos para transferir</b><br/>{settings.bankHolder || "Aysén Training Store"}<br/>RUT: <b>{settings.bankRut || "Pendiente de configurar"}</b><br/>{settings.bankName || "Banco pendiente"} · {settings.bankAccountType || "Cuenta"}<br/>N.º cuenta: <b>{settings.bankAccount || "Pendiente de configurar"}</b><br/>Correo: <b>{settings.bankEmail || "Pendiente de configurar"}</b></div><section className="proof-upload"><h3>Enviar comprobante de transferencia</h3><p>Adjunta una foto, captura o PDF para que la tienda pueda verificar tu pago.</p><label className="proof-file">Seleccionar archivo<input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(event) => setProofFile(event.currentTarget.files?.[0] ?? null)}/></label>{proofFile && <small className="proof-filename">{proofFile.name}</small>}{proofMessage && <p className={proofMessage.startsWith("Comprobante recibido") ? "success-message" : "error-message"} role="status">{proofMessage}</p>}<button type="button" className="primary-button" disabled={!proofFile || proofBusy || Boolean(proofMessage.startsWith("Comprobante recibido"))} onClick={() => void attachProof()}>{proofBusy ? "Subiendo comprobante…" : "Enviar comprobante"}</button></section><p className="notice">Los datos de pago deben ser confirmados con la tienda. No realices una transferencia a datos de demostración.</p><button className="primary-button" onClick={() => setConfirmation(null)}>Listo</button></section></div>}
  </>;
}
