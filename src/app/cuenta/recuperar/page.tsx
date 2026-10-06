import { BackLink } from "@/components/back-link";
import { PasswordResetRequestForm } from "@/components/password-reset-form";
import { getSetting } from "@/db";

export default async function PasswordResetRequestPage() {
  const enabled = (await getSetting("passwordResetEnabled", "false")) === "true";
  return <main className="account-page"><section className="account-card"><BackLink/><PasswordResetRequestForm enabled={enabled}/></section></main>;
}
