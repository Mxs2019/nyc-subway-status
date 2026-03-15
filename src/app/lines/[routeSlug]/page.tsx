import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getRouteBySlug,
  getRoutes,
  getStationsForRoute,
} from "@/lib/gtfs";
import { getNextArrivalsForRoute, getServiceAlerts, type ServiceAlert } from "@/lib/gtfsrt";
import { PageHeader } from "@/components/page-header";
import { RouteBullet } from "@/components/route-bullet";
import { ArrivalTime } from "@/components/arrival-time";
import { RecentTracker } from "@/components/recent-tracker";
import { AutoRefresh } from "@/components/auto-refresh";
import { ServiceAlerts } from "@/components/service-alerts";
import { BreadcrumbJsonLd } from "@/components/breadcrumb-jsonld";

// No caching — every page load fetches fresh realtime data server-side
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

interface Props {
  params: Promise<{ routeSlug: string }>;
}

export async function generateStaticParams() {
  return getRoutes().map((r) => ({ routeSlug: r.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { routeSlug } = await params;
  const route = getRouteBySlug(routeSlug);
  if (!route) return {};
  return {
    title: `${route.shortName} Line`,
    description: `Real-time ${route.shortName} train arrivals and status. See upcoming trains at every station on the ${route.longName} line.`,
  };
}

export default async function RoutePage({ params }: Props) {
  const { routeSlug } = await params;
  const route = getRouteBySlug(routeSlug);
  if (!route) notFound();

  const stations = getStationsForRoute(route.id);

  let nextArrivals: Awaited<ReturnType<typeof getNextArrivalsForRoute>> = new Map();
  let alerts: ServiceAlert[] = [];
  try {
    [nextArrivals, alerts] = await Promise.all([
      getNextArrivalsForRoute(route.id, stations),
      getServiceAlerts({ routeIds: [route.id] }).catch(() => [] as ServiceAlert[]),
    ]);
  } catch (err) {
    console.error("Failed to fetch realtime data for route:", err);
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://nyc-subway-status.com";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TransitLine",
    name: route.longName,
    alternateName: `${route.shortName} Train`,
    url: `${siteUrl}/lines/${route.slug}`,
    provider: {
      "@type": "Organization",
      name: "Metropolitan Transportation Authority (MTA)",
      url: "https://www.mta.info",
    },
  };

  return (
    <main id="main-content" className="max-w-2xl mx-auto px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BreadcrumbJsonLd items={[
        { name: "Home", href: "/" },
        { name: "All Lines", href: "/lines" },
        { name: `${route.shortName} Line` },
      ]} />
      <AutoRefresh />
      <RecentTracker type="line" routeSlug={route.slug} />
      <PageHeader title={`${route.longName}`} backHref="/lines" backLabel="All Lines">
        <RouteBullet
          shortName={route.shortName}
          color={route.color}
          textColor={route.textColor}
          size="lg"
        />
      </PageHeader>

      <div
        className="border-l-4 pl-4 mb-6"
        style={{ borderColor: route.color }}
      >
        <p className="text-xs text-muted">
          {stations.length} stations · ↑ Uptown · ↓ Downtown
        </p>
      </div>

      <ServiceAlerts alerts={alerts} />

      <section>
        <ul>
          {stations.map((station, i) => {
            const arrivals = nextArrivals.get(station.id);
            const hasArrivals = arrivals && (arrivals.uptown || arrivals.downtown);
            return (
              <li key={station.id} className="flex">
                <div className="flex flex-col items-center shrink-0 w-5 mr-3">
                  <div
                    className="w-0.5 flex-1"
                    style={i === 0 ? undefined : { backgroundColor: route.color }}
                  />
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: route.color }}
                  />
                  <div
                    className="w-0.5 flex-1"
                    style={i === stations.length - 1 ? undefined : { backgroundColor: route.color }}
                  />
                </div>
                <a
                  href={`/stops/${station.slug}/lines/${route.slug}`}
                  className="flex-1 flex items-center justify-between flex-wrap gap-y-1 py-3 border-b border-border no-underline hover:opacity-70"
                >
                  <span className={`text-sm font-medium ${hasArrivals ? '' : 'text-muted'}`}>{station.name}</span>
                  {hasArrivals && (
                    <div className="flex gap-6 text-xs shrink-0">
                      {arrivals!.uptown && (
                        <span>
                          ↑ <ArrivalTime timestamp={arrivals!.uptown.arrivalTime} />
                        </span>
                      )}
                      {arrivals!.downtown && (
                        <span>
                          ↓ <ArrivalTime timestamp={arrivals!.downtown.arrivalTime} />
                        </span>
                      )}
                    </div>
                  )}
                </a>
              </li>
            );
          })}
        </ul>
      </section>

      <nav className="mt-8 pt-6 border-t border-border">
        <div className="flex flex-col gap-2">
          <a
            href="/lines"
            className="text-sm no-underline hover:opacity-70 transition"
          >
            All lines →
          </a>
          <a
            href="/stops"
            className="text-sm no-underline hover:opacity-70 transition"
          >
            All stations →
          </a>
        </div>
      </nav>
    </main>
  );
}
