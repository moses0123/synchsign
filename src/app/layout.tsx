import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./fonts";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: { default: "SyncSign — Sign anything, anywhere", template: "%s · SyncSign" },
  description: "SyncSign is the fast, beautiful way to send, sign and verify documents from any device.",
  applicationName: "SyncSign",
  appleWebApp: { capable: true, title: "SyncSign", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7fbff" },
    { media: "(prefers-color-scheme: dark)", color: "#040d18" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
