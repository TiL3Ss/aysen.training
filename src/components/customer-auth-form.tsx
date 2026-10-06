"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginCustomer, registerCustomer } from "@/lib/actions";
import { PasswordField } from "@/components/password-field";

export function CustomerAuthForm({ mode, passwordResetEnabled = false }: { mode: "login" | "register"; passwordResetEnabled?: boolean }) {
  const router = useRouter(); const [busy, start] = useTransition(); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  const isRegister = mode === "register";
  function submit(form: FormData) {
    setError(""); setMessage("");
    const payload = isRegister ? { name: form.get("name"), email: form.get("email"), password: form.get("password"), termsAccepted: form.get("terms") === "on", privacyAccepted: form.get("privacy") === "on" } : { email: form.get("email"), password: form.get("password") };
    start(async () => { const result = isRegister ? await registerCustomer(payload) : await loginCustomer(payload); if (!result.ok) { setError(result.message); return; } setMessage(result.message); router.push(isRegister?"/cuenta":"/"); router.refresh(); });
  }
  return <div className="auth-content"><Link href="/">Aysén Training Store</Link><h1>{isRegister ? "Crea tu cuenta" : "Inicia sesión"}</h1><p>Guarda tus datos y consulta tus pedidos.</p><form action={submit}>{isRegister && <label>Nombre completo<input name="name" autoComplete="name" minLength={2} required/></label>}<label>Correo electrónico<input name="email" type="email" autoComplete="email" required/></label><label>Contraseña<PasswordField name="password" autoComplete={isRegister ? "new-password" : "current-password"} minLength={isRegister ? 12 : 1} required/>{isRegister && <small>Al menos 12 caracteres.</small>}</label>{!isRegister && passwordResetEnabled && <Link className="forgot-password-link" href="/cuenta/recuperar">¿Olvidaste tu contraseña?</Link>}{isRegister && <div className="consent-checks"><label><input type="checkbox" name="terms" required/> Acepto los <Link href="/terminos" target="_blank">términos y condiciones</Link>.</label><label><input type="checkbox" name="privacy" required/> He leído la <Link href="/privacidad" target="_blank">política de privacidad</Link>.</label></div>}{error && <p className="error-message" role="alert">{error}</p>}{message && <p className="success-message" role="status">{message}</p>}<button className="primary-button" disabled={busy}>{busy ? "Procesando…" : isRegister ? "Crear cuenta" : "Entrar"}</button></form><p>{isRegister ? <>¿Ya tienes cuenta? <Link href="/cuenta/ingresar">Inicia sesión</Link></> : <>¿Primera vez? <Link href="/cuenta/registro">Crea una cuenta</Link></>}</p></div>;
}
