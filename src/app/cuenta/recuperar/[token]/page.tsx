import { BackLink } from "@/components/back-link";
import { PasswordResetForm } from "@/components/password-reset-form";
import { getSetting } from "@/db";

export default async function PasswordResetPage({ params }: { params: Promise<{ token: string }> }) {
  const [{ token }, enabledValue] = await Promise.all([params, getSetting("passwordResetEnabled", "false")]);
  return <main className="account-page"><section className="account-card"><BackLink/><PasswordResetForm token={token} enabled={enabledValue === "true"}/></section></main>;
}
