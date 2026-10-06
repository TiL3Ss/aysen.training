import type { Metadata } from "next";
import { getSettings } from "@/db";
import "./globals.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const title = settings.siteName || "Aysén Training Store";
  const description = settings.siteDescription || "Equipamiento deportivo seleccionado para acompañarte en cada entrenamiento, desde la Patagonia.";
  return {
    title: { default: title, template: `%s | ${title}` },
    description,
    applicationName: title,
    openGraph: { title, description, type: "website", locale: "es_CL" },
    icons: { icon: "/api/brand/icon", shortcut: "/api/brand/icon", apple: "/api/brand/icon" },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es-CL"><body>{children}</body></html>;
}
