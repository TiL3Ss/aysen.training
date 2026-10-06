import "server-only";

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char); }

export async function sendOrderReceipt({ to, orderId, total, trackingUrl }: { to: string; orderId: string; total: number; trackingUrl: string }) {
  const apiKey = process.env.RESEND_API_KEY; const from = process.env.RESEND_FROM;
  if (!apiKey || !from) return false;
  const formattedTotal = `$${new Intl.NumberFormat("es-CL").format(total)}`;
  const safeId = escapeHtml(orderId); const safeUrl = escapeHtml(trackingUrl);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject: `Pedido ${orderId} recibido · Aysén Training Store`, text: `Recibimos tu pedido ${orderId} por ${formattedTotal}. Revisa su estado en: ${trackingUrl}`, html: `<div style="font-family:Arial,sans-serif;color:#1b2620;max-width:560px;margin:auto;padding:24px"><h1 style="font-size:22px">Pedido recibido</h1><p>Tu pedido <strong>${safeId}</strong> por <strong>${formattedTotal}</strong> quedó registrado.</p><p>Guarda este enlace para revisar su estado:</p><p><a href="${safeUrl}" style="display:inline-block;background:#1b2620;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Ver estado del pedido</a></p><p style="font-size:12px;color:#58645c">Pago por transferencia bancaria. La tienda actualizará el estado cuando verifique el pago.</p></div>` }),
  });
  return response.ok;
}

export async function sendCustomerPasswordReset({ to, resetUrl }: { to: string; resetUrl: string }) {
  const apiKey = process.env.RESEND_API_KEY; const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    console.error("[password-reset-email] Resend is not configured", { apiKeyConfigured: Boolean(apiKey), senderConfigured: Boolean(from) });
    return false;
  }
  const safeUrl = escapeHtml(resetUrl);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject: "Restablece tu contraseña · Aysén Training Store", text: `Usa este enlace para crear una contraseña nueva. Vence en 30 minutos: ${resetUrl}\nSi no solicitaste este cambio, ignora este correo.`, html: `<div style="font-family:Arial,sans-serif;color:#1b2620;max-width:560px;margin:auto;padding:24px"><h1 style="font-size:22px">Restablece tu contraseña</h1><p>Solicitaste cambiar la contraseña de tu cuenta en Aysén Training Store.</p><p><a href="${safeUrl}" style="display:inline-block;background:#1b2620;color:#eefaf0;padding:12px 18px;border-radius:8px;text-decoration:none">Crear contraseña nueva</a></p><p>El enlace vence en 30 minutos y solo se puede usar una vez. Si no solicitaste este cambio, ignora este correo.</p></div>` }),
    });
    if (!response.ok) console.error("[password-reset-email] Resend rejected the request", { status: response.status, hint: "Verify the API key, sender domain, and recipient restrictions in Resend." });
    return response.ok;
  } catch (error) {
    console.error("[password-reset-email] Resend request failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
    return false;
  }
}
