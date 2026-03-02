import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { DevTools } from "@/components/dev-tools";
import "./globals.css";

const mono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
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
    card: "summary_large_image",
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
