import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getStationBySlug,
  getStations,
  getRoutesForStation,
  type Route,
} from "@/lib/gtfs";
import { PageHeader } from "@/components/page-header";
import { RouteBullet } from "@/components/route-bullet";
import { ArrivalTime } from "@/components/arrival-time";
import { RecentTracker } from "@/components/recent-tracker";
import { getAllArrivalsForStation, getServiceAlerts, type ServiceAlert } from "@/lib/gtfsrt";
import { AutoRefresh } from "@/components/auto-refresh";
import { ServiceAlerts } from "@/components/service-alerts";

// No caching — every page load fetches fresh realtime data server-side
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

interface Props {
  params: Promise<{ stationSlug: string }>;
}

interface StationArrival {
  route: Route;
  tripId: string;
  arrivalTime: number;
}

export async function generateStaticParams() {
  return getStations().map((s) => ({ stationSlug: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { stationSlug } = await params;
  const station = getStationBySlug(stationSlug);
  if (!station) return {};
  return {
    title: station.name,
    description: `Real-time subway arrivals at ${station.name}. See upcoming uptown and downtown trains, departure times, and all lines serving this station.`,
  };
}

export default async function StationPage({ params }: Props) {
  const { stationSlug } = await params;
  const station = getStationBySlug(stationSlug);
  if (!station) notFound();

  const routes = getRoutesForStation(station.id);

  let error: string | null = null;
  const uptownArrivals: StationArrival[] = [];
  const downtownArrivals: StationArrival[] = [];
  let alerts: ServiceAlert[] = [];

  try {
    const [arrivalsByRoute, fetchedAlerts] = await Promise.all([
      getAllArrivalsForStation(
        station.childStopIds,
        routes.map((route) => route.id),
        3,
      ),
      getServiceAlerts({
        routeIds: routes.map((r) => r.id),
        stopIds: station.childStopIds,
      }).catch(() => [] as ServiceAlert[]),
    ]);

    alerts = fetchedAlerts;

    for (const route of routes) {
      const directionArrivals = arrivalsByRoute.get(route.id) || [];
      for (const direction of directionArrivals) {
        const target = direction.directionId === 1 ? downtownArrivals : uptownArrivals;
        for (const arrival of direction.arrivals) {
          target.push({
            route,
            tripId: arrival.tripId,
            arrivalTime: arrival.arrivalTime,
          });
        }
      }
    }

    const sortByArrivalTime = (a: StationArrival, b: StationArrival) =>
      a.arrivalTime - b.arrivalTime;
    uptownArrivals.sort(sortByArrivalTime);
    downtownArrivals.sort(sortByArrivalTime);
  } catch (err) {
    console.error("Failed to fetch realtime station data:", err);
    error = "Unable to load realtime data. Please try again.";
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TransitStation",
    name: station.name,
    ...(station.lat != null &&
      station.lon != null && {
        geo: {
          "@type": "GeoCoordinates",
          latitude: station.lat,
          longitude: station.lon,
        },
      }),
  };

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <AutoRefresh />
      <RecentTracker type="stop" stationSlug={station.slug} />
      <PageHeader title={station.name} backHref="/stops" backLabel="All Stops" />

      <div className="flex flex-wrap items-center gap-2 mb-6">
        {routes.map((route) => (
          <a
            key={route.id}
            href={`/stops/${station.slug}/lines/${route.slug}`}
            title={`${route.shortName} - ${route.longName}`}
            className="no-underline hover:opacity-70 transition"
          >
            <RouteBullet
              shortName={route.shortName}
              color={route.color}
              textColor={route.textColor}
              size="md"
            />
          </a>
        ))}
      </div>

      <ServiceAlerts alerts={alerts} />

      <h2 className="text-lg font-bold mb-4">Upcoming Trains</h2>

      {error && (
        <div className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 mb-6">
          {error}
        </div>
      )}

      {!error && uptownArrivals.length === 0 && downtownArrivals.length === 0 && (
        <p className="text-muted text-sm mb-6">No upcoming arrivals found.</p>
      )}

      <div className="space-y-6">
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted mb-3">
            Uptown
          </h2>
          <ul className="divide-y divide-border">
            {uptownArrivals.map((item, i) => (
              <li key={`${item.tripId}-${item.route.id}-uptown-${i}`} className="py-2">
                <a
                  href={`/lines/${item.route.slug}/trips/${encodeURIComponent(item.tripId)}?from=${station.slug}`}
                  className="flex items-center gap-3 no-underline hover:opacity-70"
                >
                  <RouteBullet
                    shortName={item.route.shortName}
                    color={item.route.color}
                    textColor={item.route.textColor}
                    size="sm"
                  />
                  <span className="text-sm">{item.route.longName}</span>
                  <span className="ml-auto">
                    <ArrivalTime timestamp={item.arrivalTime} />
                  </span>
                  <span className="text-xs text-muted">→</span>
                </a>
              </li>
            ))}
          </ul>
          {uptownArrivals.length === 0 && (
            <p className="text-muted text-xs mt-2">No upcoming uptown trains.</p>
          )}
        </section>

        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted mb-3">
            Downtown
          </h2>
          <ul className="divide-y divide-border">
            {downtownArrivals.map((item, i) => (
              <li key={`${item.tripId}-${item.route.id}-downtown-${i}`} className="py-2">
                <a
                  href={`/lines/${item.route.slug}/trips/${encodeURIComponent(item.tripId)}?from=${station.slug}`}
                  className="flex items-center gap-3 no-underline hover:opacity-70"
                >
                  <RouteBullet
                    shortName={item.route.shortName}
                    color={item.route.color}
                    textColor={item.route.textColor}
                    size="sm"
                  />
                  <span className="text-sm">{item.route.longName}</span>
                  <span className="ml-auto">
                    <ArrivalTime timestamp={item.arrivalTime} />
                  </span>
                  <span className="text-xs text-muted">→</span>
                </a>
              </li>
            ))}
          </ul>
          {downtownArrivals.length === 0 && (
            <p className="text-muted text-xs mt-2">No upcoming downtown trains.</p>
          )}
        </section>
      </div>

      <nav className="mt-8 pt-6 border-t border-border">
        <p className="text-xs font-bold uppercase tracking-wider text-muted mb-2">
          Explore Lines
        </p>
        <div className="flex flex-col gap-2">
          {routes.map((route) => (
            <a
              key={route.id}
              href={`/lines/${route.slug}`}
              className="text-sm no-underline hover:opacity-70 transition flex items-center gap-2"
            >
              <RouteBullet
                shortName={route.shortName}
                color={route.color}
                textColor={route.textColor}
                size="sm"
              />
              {route.longName} — all stations →
            </a>
          ))}
        </div>
      </nav>
    </main>
  );
}
