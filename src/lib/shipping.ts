export type ShippingDestination = { id: string; name: string; price: number; days: string; enabled: boolean };
export const chileRegions: ShippingDestination[] = [
  ["aysen","Región de Aysén",2990,"1–2 días hábiles"],["magallanes","Región de Magallanes",6990,"3–6 días hábiles"],["los-lagos","Región de Los Lagos",5990,"3–5 días hábiles"],["los-rios","Región de Los Ríos",5990,"3–5 días hábiles"],["araucania","Región de La Araucanía",5990,"3–5 días hábiles"],["nuble","Región de Ñuble",4990,"3–5 días hábiles"],["biobio","Región del Biobío",4990,"3–5 días hábiles"],["maule","Región del Maule",4990,"3–5 días hábiles"],["ohiggins","Región de O’Higgins",4990,"3–5 días hábiles"],["metropolitana","Región Metropolitana",4990,"3–5 días hábiles"],["valparaiso","Región de Valparaíso",4990,"3–5 días hábiles"],["coquimbo","Región de Coquimbo",6990,"5–8 días hábiles"],["atacama","Región de Atacama",6990,"5–8 días hábiles"],["antofagasta","Región de Antofagasta",6990,"5–8 días hábiles"],["tarapaca","Región de Tarapacá",6990,"5–8 días hábiles"],["arica","Región de Arica y Parinacota",6990,"5–8 días hábiles"],
].map(([id,name,price,days])=>({id:String(id),name:String(name),price:Number(price),days:String(days),enabled:true}));
export function readDestinations(raw?: string): ShippingDestination[] {
  try { const parsed = JSON.parse(raw ?? "[]"); if (Array.isArray(parsed) && parsed.every((x) => x && typeof x.id === "string" && typeof x.name === "string" && Number.isInteger(x.price))) return parsed; } catch { /* migrate legacy rates below */ }
  return chileRegions;
}
export function resolveDestination(destinations: ShippingDestination[], localOnly: boolean, id: string) {
  return destinations.find((destination) => destination.id === id && destination.enabled && (!localOnly || destination.id === "aysen"));
}
export function calculateOrderTotals(lines: { unitPrice: number; quantity: number }[], deliveryPrice: number) {
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  return { subtotal, shippingPrice: deliveryPrice, total: subtotal + deliveryPrice };
}
export function checkoutDestinationMatches(region: string, destination: ShippingDestination) {
  return region.trim() === destination.name;
}
