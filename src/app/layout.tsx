import type { Metadata } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import { DevTools } from "@/components/dev-tools";
import "./globals.css";

const mono = localFont({
  src: "../../node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://nycsubwaystatus.com"
  ),
  title: {
    default: "NYC Subway Status",
    template: "%s | NYC Subway Status",
  },
  description:
    "Real-time NYC subway arrival times for every station and line.",
  openGraph: {
    type: "website",
    siteName: "NYC Subway Status",
  },
  twitter: {
    card: "summary",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${mono.variable} antialiased`}>
        {children}
        <DevTools />
        <Analytics />
      </body>
    </html>
  );
}
