import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getRouteBySlug,
  getRoutes,
  getStationsForRoute,
} from "@/lib/gtfs";
import { getNextArrivalsForRoute } from "@/lib/gtfsrt";
import { PageHeader } from "@/components/page-header";
import { RouteBullet } from "@/components/route-bullet";
import { ArrivalTime } from "@/components/arrival-time";
import { RecentTracker } from "@/components/recent-tracker";

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
    description: `Stations and real-time status for the ${route.shortName} line.`,
  };
}

export default async function RoutePage({ params }: Props) {
  const { routeSlug } = await params;
  const route = getRouteBySlug(routeSlug);
  if (!route) notFound();

  const stations = getStationsForRoute(route.id);

  let nextArrivals: Awaited<ReturnType<typeof getNextArrivalsForRoute>> = new Map();
  try {
    nextArrivals = await getNextArrivalsForRoute(route.id, stations);
  } catch (err) {
    console.error("Failed to fetch realtime data for route:", err);
  }

  // Only show stations with upcoming arrivals
  const activeStations = stations.filter((station) => {
    const arrivals = nextArrivals.get(station.id);
    return arrivals && (arrivals.uptown || arrivals.downtown);
  });

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
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
          {activeStations.length} stations
        </p>
      </div>

      <section>
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted mb-3">
          Stations
        </h2>
        <ul className="divide-y divide-border">
          {activeStations.map((station) => {
            const arrivals = nextArrivals.get(station.id)!;
            return (
              <li key={station.id} className="py-3">
                <a
                  href={`/stops/${station.slug}/lines/${route.slug}`}
                  className="flex items-center justify-between no-underline hover:opacity-70"
                >
                  <span className="text-sm font-medium">{station.name}</span>
                  <div className="flex gap-6 text-xs text-muted">
                    {arrivals.uptown && (
                      <span>
                        ↑ <ArrivalTime timestamp={arrivals.uptown.arrivalTime} />
                      </span>
                    )}
                    {arrivals.downtown && (
                      <span>
                        ↓ <ArrivalTime timestamp={arrivals.downtown.arrivalTime} />
                      </span>
                    )}
                  </div>
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
