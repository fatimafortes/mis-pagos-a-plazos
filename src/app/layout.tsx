import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mis pagos a plazos",
  description: "Sube capturas de tus apps de pagos a plazos y ve lo que vence por quincena.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX">
      <body>{children}</body>
    </html>
  );
}
