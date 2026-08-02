import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Gestion RH — Centre Médical",
    template: "%s — Gestion RH",
  },
  description: "Gestion RH du centre médical : congés, absences, stock, coûts et employés.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
