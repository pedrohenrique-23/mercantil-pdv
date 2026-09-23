import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mercantil PDV",
  description: "Sistema de caixa e gestão para mercantil",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
