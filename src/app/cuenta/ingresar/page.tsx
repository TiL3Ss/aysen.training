import { CustomerAuthForm } from "@/components/customer-auth-form";
import { BackLink } from "@/components/back-link";
import { getSetting } from "@/db";
export default async function LoginPage() { const resetEnabled = (await getSetting("passwordResetEnabled", "false")) === "true"; return <main className="account-page"><section className="account-card"><BackLink/><CustomerAuthForm mode="login" passwordResetEnabled={resetEnabled}/></section></main>; }
