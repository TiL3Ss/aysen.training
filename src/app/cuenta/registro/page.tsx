import { CustomerAuthForm } from "@/components/customer-auth-form";
import { BackLink } from "@/components/back-link";
export default function RegisterPage() { return <main className="account-page"><section className="account-card"><BackLink/><CustomerAuthForm mode="register"/></section></main>; }
