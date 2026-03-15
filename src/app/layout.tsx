import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Analytics } from "@vercel/analytics/next";
import { DevTools } from "@/components/dev-tools";
import { PostHogProvider } from "@/components/posthog-provider";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

const mono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://nyc-subway-status.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "NYC Subway Status",
    template: "%s | NYC Subway Status",
  },
  description:
    "Real-time NYC subway arrival times for every station and line.",
  alternates: {
    canonical: "./",
  },
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
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "NYC Subway Status",
    url: siteUrl,
    description:
      "Real-time NYC subway arrival times for every station and line.",
  };

  return (
    <html lang="en">
      <body className={`${mono.variable} antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <PostHogProvider>
          {children}
          <SiteFooter />
        </PostHogProvider>
        <DevTools />
        <Analytics />
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
          <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
        )}
      </body>
    </html>
  );
}
