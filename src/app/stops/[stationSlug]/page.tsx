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
import { getAllArrivalsForStation } from "@/lib/gtfsrt";

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
    description: `Real-time subway arrivals at ${station.name}.`,
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

  try {
    const arrivalsByRoute = await getAllArrivalsForStation(
      station.childStopIds,
      routes.map((route) => route.id),
      3
    );

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

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
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
              <li key={`${item.tripId}-${item.route.id}-uptown-${i}`} className="py-2 flex items-center gap-3">
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
              <li key={`${item.tripId}-${item.route.id}-downtown-${i}`} className="py-2 flex items-center gap-3">
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
              </li>
            ))}
          </ul>
          {downtownArrivals.length === 0 && (
            <p className="text-muted text-xs mt-2">No upcoming downtown trains.</p>
          )}
        </section>
      </div>
    </main>
  );
}
