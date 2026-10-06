"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { requestCustomerPasswordReset, resetCustomerPassword } from "@/lib/actions";
import { PasswordField } from "@/components/password-field";

export function PasswordResetRequestForm({ enabled = false }: { enabled?: boolean }) {
  const [busy, start] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  function submit(form: FormData) {
    setError(""); setMessage("");
    start(async () => {
      const result = await requestCustomerPasswordReset({ email: form.get("email") });
      if (result.ok) setMessage(result.message); else setError(result.message);
    });
  }
  return <div className="auth-content"><Link href="/">Aysén Training Store</Link><h1>Recupera tu contraseña</h1><p>{enabled ? "Si existe una cuenta y el correo está disponible, recibirás un enlace para crear una contraseña nueva. Si no llega, contacta a la tienda." : "La recuperación por correo está deshabilitada por la tienda."}</p>{enabled && <form action={submit}><label>Correo electrónico<input name="email" type="email" autoComplete="email" required maxLength={200}/></label>{error && <p className="error-message" role="alert">{error}</p>}{message && <p className="success-message" role="status">{message}</p>}<button className="primary-button" disabled={busy}>{busy ? "Enviando…" : "Enviar enlace"}</button></form>}<p><Link href="/cuenta/ingresar">Volver a iniciar sesión</Link></p></div>;
}

export function PasswordResetForm({ token, enabled = false }: { token: string; enabled?: boolean }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  function submit(form: FormData) {
    setError(""); setMessage("");
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("confirmPassword") ?? "")) { setError("Las contraseñas no coinciden."); return; }
    start(async () => {
      const result = await resetCustomerPassword({ token, password });
      if (!result.ok) { setError(result.message); return; }
      setMessage(result.message);
      window.setTimeout(() => { router.push("/cuenta"); router.refresh(); }, 1200);
    });
  }
  return <div className="auth-content"><Link href="/">Aysén Training Store</Link><h1>Crea una contraseña nueva</h1><p>{enabled ? "Usa al menos 12 caracteres para proteger tu cuenta." : "La recuperación por correo está deshabilitada por la tienda."}</p>{enabled && <form action={submit}><label>Nueva contraseña<PasswordField name="password" autoComplete="new-password" minLength={12} maxLength={200} required/></label><label>Confirma la contraseña<PasswordField name="confirmPassword" autoComplete="new-password" minLength={12} maxLength={200} required/></label>{error && <p className="error-message" role="alert">{error}</p>}{message && <p className="success-message" role="status">{message}</p>}<button className="primary-button" disabled={busy}>{busy ? "Actualizando…" : "Guardar contraseña"}</button></form>}{enabled && error && <p><Link href="/cuenta/recuperar">Solicitar otro enlace</Link></p>}</div>;
}
