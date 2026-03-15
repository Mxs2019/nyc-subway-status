import type { Metadata } from "next";
import { BreadcrumbJsonLd } from "@/components/breadcrumb-jsonld";

export const metadata: Metadata = {
  title: "About",
  description:
    "About NYC Subway Status and changelog of recent updates.",
};

const changelog: { date: string; changes: string[] }[] = [
  {
    date: "Mar 2, 2026",
    changes: [
      "Nearby stations — find the 5 closest stations using your location",
      "Auto-refresh realtime pages every 30 seconds",
      "Design clarity improvements and SEO enhancements",
    ],
  },
  {
    date: "Mar 1, 2026",
    changes: [
      "Unique social card images per page type",
      "Custom domain setup (nyc-subway-status.com)",
    ],
  },
  {
    date: "Feb 28, 2026",
    changes: [
      "Smart recents — frequently visited pages ranked higher",
      "Recent pages on homepage",
      "Exact route match priority in search (type \"A\" → A train first)",
      "Universal homepage search across stops and lines",
      "Station ordering on route pages matches real line sequence",
    ],
  },
  {
    date: "Feb 27, 2026",
    changes: [
      "Vercel Web Analytics",
      "Route bullet color contrast fixes for accessibility",
      "Station complex merging (e.g., Union Square shows all platforms)",
      "Tabbed home page (Stops | Lines)",
      "Disabled all caching for realtime data",
      "Sitemap generation",
      "All station, route, and realtime arrival pages",
      "GTFS-RT realtime feed integration",
      "GTFS static data pipeline",
      "Initial launch",
    ],
  },
];

export default function AboutPage() {
  return (
    <main id="main-content" className="max-w-2xl mx-auto px-4 py-12">
      <BreadcrumbJsonLd items={[{ name: "Home", href: "/" }, { name: "About" }]} />
      <a
        href="/"
        className="text-sm text-muted hover:text-foreground transition-colors"
      >
        &larr; Home
      </a>

      <h1 className="mt-4 text-2xl font-bold tracking-tight">About</h1>
      <p className="mt-2 text-sm text-muted">
        Built by Max Shaw. Real-time NYC subway arrivals, powered by the MTA&apos;s official GTFS-Realtime feeds. No API key, no caching — every page load is fresh data.
      </p>
      <p className="mt-2 text-sm">
        <a href="https://github.com/Mxs2019/nyc-subway-status" className="text-muted hover:text-foreground transition-colors">GitHub →</a>
      </p>

      <h2 className="mt-10 text-lg font-bold tracking-tight">Changelog</h2>
      <div className="mt-4 space-y-6">
        {changelog.map(({ date, changes }) => (
          <div key={date}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted">{date}</h3>
            <ul className="mt-1 space-y-1">
              {changes.map((change) => (
                <li key={change} className="text-sm">
                  — {change}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </main>
  );
}
