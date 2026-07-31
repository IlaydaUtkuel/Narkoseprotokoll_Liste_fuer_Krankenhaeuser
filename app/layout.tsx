import type { Metadata, Viewport } from "next";
import AppProviders from "../components/AppProviders";
import "./globals.css";

export const metadata: Metadata = {
  title: "Narkoseprotokoll Demo",
  description:
    "Demo zur Erfassung der Basisdaten eines fiktiven Narkosefalls. Es werden ausschließlich fiktive Daten lokal im Browser gespeichert.",
  applicationName: "Narkose Demo",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Narkose Demo",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#1f7a63",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
