import { getSetting } from "@/db";

export const dynamic = "force-dynamic";
const defaultLogo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><path fill="#5f754e" d="M4 72 36 18l22 31 18-39 40 62H4Z"/><path fill="#eefaF0" d="m24 40 12-22 12 18-10-5-6 6-8 3Zm37-4 15-26 20 37-14-9-8 7-13-9Z"/><path fill="none" stroke="#1b2620" stroke-linecap="round" stroke-width="5" d="M48 50h24v14c0 9-5 15-12 15s-12-6-12-15V50Zm-10 3h11m23 0h11M55 46c0-5 3-8 5-8s5 3 5 8M5 74h109"/></svg>`;

export async function GET() {
  const data = await getSetting("logoData");
  if (!data) return new Response(defaultLogo, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" } });
  const [metadata, payload] = data.split(",", 2);
  const mime = metadata?.match(/^data:(image\/(?:png|jpeg|webp|svg\+xml));base64$/)?.[1];
  if (!mime || !payload) return new Response(defaultLogo, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" } });
  const bytes = Uint8Array.from(Buffer.from(payload, "base64"));
  return new Response(bytes, { headers: { "Content-Type": mime, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
