import { getSetting } from "@/db";

export const dynamic = "force-dynamic";
const fallback = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="17" fill="#1b2620"/><path fill="#5f754e" d="M5 45 21 18l12 17 10-22 17 32H5Z"/><path fill="#eefaF0" d="m15 30 6-11 7 10-6-2-3 3-4 1Zm20-2 8-15 10 19-8-5-4 4-6-3Z"/><path fill="none" stroke="#1b2620" stroke-width="3" d="M27 36h10v5c0 4-2 7-5 7s-5-3-5-7v-5Zm-4 2h5m10 0h5M30 34c0-2 1-3 2-3s2 1 2 3"/></svg>`;

export async function GET() {
  const data = await getSetting("faviconData");
  if (!data) return new Response(fallback, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" } });
  const [metadata, payload] = data.split(",", 2);
  const mime = metadata?.match(/^data:(image\/(?:png|jpeg|webp|svg\+xml));base64$/)?.[1];
  if (!mime || !payload) return new Response(fallback, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" } });
  const bytes = Uint8Array.from(Buffer.from(payload, "base64"));
  return new Response(bytes, { headers: { "Content-Type": mime, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
