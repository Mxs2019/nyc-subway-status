import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getStationBySlug,
  getStations,
  getRouteBySlug,
  getRoutes,
  getStationRoutes,
  getRoutesForStation,
} from "@/lib/gtfs";
import { getArrivals } from "@/lib/gtfsrt";
import { PageHeader } from "@/components/page-header";
import { RouteBullet } from "@/components/route-bullet";
import { ArrivalTime } from "@/components/arrival-time";
import { RecentTracker } from "@/components/recent-tracker";
import { AutoRefresh } from "@/components/auto-refresh";

// No caching — every page load fetches fresh realtime data server-side
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

interface Props {
  params: Promise<{ stationSlug: string; routeSlug: string }>;
}

export async function generateStaticParams() {
  const stations = getStations();
  const routes = getRoutes();
  const stationRoutes = getStationRoutes();

  const params: { stationSlug: string; routeSlug: string }[] = [];

  for (const station of stations) {
    const routeIds = stationRoutes[station.id] || [];
    for (const routeId of routeIds) {
      const route = routes.find((r) => r.id === routeId);
      if (route) {
        params.push({
          stationSlug: station.slug,
          routeSlug: route.slug,
        });
      }
    }
  }

  return params;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { stationSlug, routeSlug } = await params;
  const station = getStationBySlug(stationSlug);
  const route = getRouteBySlug(routeSlug);
  if (!station || !route) return {};
  return {
    title: `${station.name} — ${route.shortName} Train`,
    description: `Real-time ${route.shortName} train arrivals at ${station.name}. See upcoming uptown and downtown departures with live countdown times.`,
  };
}

export default async function StationRoutePage({ params }: Props) {
  const { stationSlug, routeSlug } = await params;
  const station = getStationBySlug(stationSlug);
  const route = getRouteBySlug(routeSlug);

  if (!station || !route) notFound();

  // Verify this route serves this station
  const stationRoutes = getStationRoutes();
  const routeIds = stationRoutes[station.id] || [];
  if (!routeIds.includes(route.id)) notFound();

  let directionArrivals: Awaited<ReturnType<typeof getArrivals>>;
  let error: string | null = null;

  try {
    directionArrivals = await getArrivals(station.childStopIds, route.id);
  } catch (err) {
    console.error("Failed to fetch realtime data:", err);
    error = "Unable to load realtime data. Please try again.";
    directionArrivals = [];
  }

  return (
    <main id="main-content" className="max-w-2xl mx-auto px-4 py-8">
      <AutoRefresh />
      <RecentTracker type="arrival" stationSlug={station.slug} routeSlug={route.slug} />
      <PageHeader
        title={station.name}
        backHref={`/stops/${station.slug}`}
        backLabel={station.name}
      >
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
        <p className="text-sm font-medium">{route.longName}</p>
      </div>

      <p className="text-xs text-muted mb-6">Data is live — refresh for latest times.</p>

      {error && (
        <div className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 mb-6">
          {error}
        </div>
      )}

      {directionArrivals.length === 0 && !error && (
        <p className="text-muted text-sm">
          No upcoming arrivals found.
        </p>
      )}

      <div className="space-y-6">
        {directionArrivals.map((da) => (
          <section key={da.directionId}>
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted mb-3">
              {da.directionLabel}
            </h2>
            <ul className="divide-y divide-border">
              {da.arrivals.map((arrival, i) => (
                <li key={`${arrival.tripId}-${i}`} className="py-2">
                  <a
                    href={`/lines/${route.slug}/trips/${encodeURIComponent(arrival.tripId)}?from=${station.slug}`}
                    className="flex items-center justify-between no-underline hover:opacity-70"
                  >
                    <ArrivalTime timestamp={arrival.arrivalTime} />
                    <span className="text-xs text-muted">→</span>
                  </a>
                </li>
              ))}
            </ul>
            {da.arrivals.length === 0 && (
              <p className="text-muted text-xs">No trains in this direction.</p>
            )}
          </section>
        ))}
      </div>

      {(() => {
        const otherRoutes = getRoutesForStation(station.id).filter(
          (r) => r.id !== route.id
        );
        return (
          <nav className="mt-8 pt-6 border-t border-border space-y-4">
            {otherRoutes.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted mb-2">
                  Other lines at {station.name}
                </p>
                <div className="flex flex-wrap gap-2">
                  {otherRoutes.map((r) => (
                    <a
                      key={r.id}
                      href={`/stops/${station.slug}/lines/${r.slug}`}
                      className="no-underline hover:opacity-70 transition"
                    >
                      <RouteBullet
                        shortName={r.shortName}
                        color={r.color}
                        textColor={r.textColor}
                        size="md"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <a
                href={`/stops/${station.slug}`}
                className="text-sm no-underline hover:opacity-70 transition"
              >
                All lines at {station.name} →
              </a>
              <a
                href={`/lines/${route.slug}`}
                className="text-sm no-underline hover:opacity-70 transition"
              >
                {route.shortName} line — all stations →
              </a>
            </div>
          </nav>
        );
      })()}

    </main>
  );
}
