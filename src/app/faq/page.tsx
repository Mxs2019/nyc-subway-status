import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Frequently asked questions about NYC Subway Status — how arrival data works, update frequency, station groupings, and supported lines.",
};

const faqs = [
  {
    q: "Where does the arrival data come from?",
    a: "All arrival times come directly from the MTA's official GTFS-Realtime feeds. These are the same feeds that power the countdown clocks in subway stations.",
  },
  {
    q: "How often is the data updated?",
    a: "Every time you load a page, we fetch fresh data from the MTA. Nothing is cached — you always see the latest available predictions.",
  },
  {
    q: "Why do arrival times sometimes jump or disappear?",
    a: "The MTA updates its predictions continuously based on real-time train positions. A train may be added, removed, or rescheduled as conditions change, which can cause times to shift.",
  },
  {
    q: "What do the directions (Northbound/Southbound) mean?",
    a: "Northbound generally means trains heading uptown or toward the Bronx/Queens. Southbound means downtown or toward Brooklyn. On crosstown lines like the L or shuttle, these map to eastbound and westbound.",
  },
  {
    q: "Are all subway lines included?",
    a: "Yes. All 26 NYC subway routes are included: the numbered lines (1–7), lettered lines (A–Z), and the Staten Island Railway (SIR).",
  },
  {
    q: "Does this work for the PATH, LIRR, or Metro-North?",
    a: "No. This site only covers the NYC subway system operated by the MTA. PATH, LIRR, and Metro-North use separate data systems.",
  },
  {
    q: "Why are some stations grouped together?",
    a: "The MTA defines station complexes where multiple stations share a physical connection (e.g., Union Square combines the 4/5/6, L, and N/Q/R/W platforms). We group these so you can see all arrivals in one place.",
  },
  {
    q: "Is an API key required?",
    a: "Not for users of this site. The MTA's GTFS-Realtime feeds are publicly available without authentication.",
  },
];

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: {
        "@type": "Answer",
        text: a,
      },
    })),
  };

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <a
        href="/"
        className="text-sm text-muted hover:text-foreground transition-colors"
      >
        &larr; Home
      </a>

      <h1 className="mt-4 text-2xl font-bold tracking-tight">
        Frequently Asked Questions
      </h1>

      <dl className="mt-8 space-y-8">
        {faqs.map(({ q, a }) => (
          <div key={q}>
            <dt className="font-semibold">{q}</dt>
            <dd className="mt-1 text-sm text-muted">{a}</dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
