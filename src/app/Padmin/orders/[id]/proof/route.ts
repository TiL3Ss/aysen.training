import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, ensureDatabase } from "@/db";
import { orders } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) return new NextResponse("No autorizado", { status: 401 });
  await ensureDatabase();
  const { id } = await params;
  const [order] = await db.select({ proof: orders.transferProof }).from(orders).where(eq(orders.id, id)).limit(1);
  const match = order?.proof?.match(/^data:(image\/(?:webp|jpeg|png)|application\/pdf);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return new NextResponse("Comprobante no encontrado", { status: 404 });
  return new NextResponse(Buffer.from(match[2], "base64"), { headers: { "Content-Type": match[1], "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" } });
}
