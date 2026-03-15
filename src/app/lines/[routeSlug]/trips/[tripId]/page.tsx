import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRouteBySlug, getStationByChildStopId } from "@/lib/gtfs";
import { getTripById } from "@/lib/gtfsrt";
import { PageHeader } from "@/components/page-header";
import { RouteBullet } from "@/components/route-bullet";
import { ArrivalTime } from "@/components/arrival-time";
import { AutoRefresh } from "@/components/auto-refresh";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

interface Props {
  params: Promise<{ routeSlug: string; tripId: string }>;
  searchParams: Promise<{ from?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { routeSlug, tripId } = await params;
  const route = getRouteBySlug(routeSlug);
  if (!route) return {};

  const trip = await getTripById(route.id, tripId);
  if (!trip || trip.stopTimes.length === 0) {
    return { title: `${route.shortName} Train` };
  }

  const dirLabel = trip.directionId === 0 ? "Uptown" : "Downtown";
  const lastStop = trip.stopTimes[trip.stopTimes.length - 1];
  const lastStation = getStationByChildStopId(lastStop.stopId);
  const destination = lastStation ? ` to ${lastStation.name}` : "";

  return {
    title: `${route.shortName} Train — ${dirLabel}${destination}`,
    description: `Track this ${route.shortName} train${destination}. See every upcoming stop with live arrival times.`,
  };
}

export default async function TripPage({ params, searchParams }: Props) {
  const { routeSlug, tripId } = await params;
  const { from } = await searchParams;
  const route = getRouteBySlug(routeSlug);
  if (!route) notFound();

  const trip = await getTripById(route.id, tripId);
  if (!trip) notFound();

  const now = Math.floor(Date.now() / 1000);

  // Resolve station info for each stop and determine passed/upcoming
  const stops = trip.stopTimes.map((st) => {
    const station = getStationByChildStopId(st.stopId);
    const time = st.arrivalTime ?? st.departureTime;
    const passed = time !== null && time <= now;
    return {
      ...st,
      station,
      time,
      passed,
    };
  });

  const nextStopIndex = stops.findIndex((s) => !s.passed);
  const dirLabel = trip.directionId === 0 ? "Uptown" : "Downtown";
  const lastStation = stops[stops.length - 1]?.station;
  const destination = lastStation ? lastStation.name : "";

  return (
    <main id="main-content" className="max-w-2xl mx-auto px-4 py-8">
      <AutoRefresh />
      <PageHeader
        title={`${dirLabel}${destination ? ` to ${destination}` : ""}`}
        backHref={from ? `/stops/${from}/lines/${route.slug}` : `/lines/${route.slug}`}
        backLabel={from ? "Back to arrivals" : `${route.shortName} line`}
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
        <p className="text-xs text-muted">
          {stops.length} stops · {dirLabel}
        </p>
      </div>

      <section>
        <ul>
          {stops.map((stop, i) => {
            const isOrigin = from && stop.station?.slug === from;
            const isNextStop = i === nextStopIndex;
            const highlight = isNextStop || isOrigin;
            return (
              <li
                key={stop.stopId}
                className="flex rounded-lg -mx-2 px-2"
                style={
                  highlight
                    ? { backgroundColor: `${route.color}12` }
                    : undefined
                }
              >
                {/* Vertical timeline */}
                <div className="flex flex-col items-center shrink-0 w-5 mr-3 z-10">
                  {i === 0 ? (
                    <div className="flex-1" />
                  ) : (
                    <div
                      className="w-0.5 flex-1"
                      style={{
                        backgroundColor: stop.passed
                          ? `${route.color}40`
                          : route.color,
                      }}
                    />
                  )}
                  <div
                    className={`rounded-full shrink-0 ${highlight ? "w-4 h-4 ring-2 ring-white" : "w-2.5 h-2.5"}`}
                    style={{
                      backgroundColor: stop.passed
                        ? `${route.color}40`
                        : route.color,
                    }}
                  />
                  {i === stops.length - 1 ? (
                    <div className="flex-1" />
                  ) : (
                    <div
                      className="w-0.5 flex-1"
                      style={{
                        backgroundColor:
                          stop.passed && stops[i + 1]?.passed
                            ? `${route.color}40`
                            : route.color,
                      }}
                    />
                  )}
                </div>

                {/* Stop info */}
                {stop.station ? (
                  <a
                    href={`/stops/${stop.station.slug}/lines/${route.slug}`}
                    className={`flex-1 flex items-center justify-between flex-wrap gap-y-1 py-3 border-b border-border no-underline hover:opacity-70 ${
                      stop.passed ? "opacity-50" : ""
                    }`}
                  >
                    <span
                      className={`text-sm ${
                        highlight
                          ? "font-bold"
                          : stop.passed
                            ? "text-muted"
                            : "font-medium"
                      }`}
                    >
                      {stop.station.name}
                      {isNextStop && (
                        <span
                          className="text-[10px] font-semibold uppercase tracking-wide ml-2 px-1.5 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${route.color}20`,
                            color: route.color,
                          }}
                        >
                          Next stop
                        </span>
                      )}
                      {isOrigin && !isNextStop && (
                        <span
                          className="text-[10px] font-semibold uppercase tracking-wide ml-2 px-1.5 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${route.color}20`,
                            color: route.color,
                          }}
                        >
                          You are here
                        </span>
                      )}
                    </span>
                    {stop.time !== null && !stop.passed && (
                      <span className="text-xs shrink-0">
                        <ArrivalTime timestamp={stop.time} />
                      </span>
                    )}
                    {stop.time !== null && stop.passed && (
                      <span className="text-xs text-muted tabular-nums shrink-0">
                        {new Date(stop.time * 1000).toLocaleTimeString(
                          "en-US",
                          { hour: "numeric", minute: "2-digit" }
                        )}
                      </span>
                    )}
                  </a>
                ) : (
                  <div className="flex-1 py-3 border-b border-border text-sm text-muted">
                    {stop.stopId}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <nav className="mt-8 pt-6 border-t border-border">
        <div className="flex flex-col gap-2">
          <a
            href={`/lines/${route.slug}`}
            className="text-sm no-underline hover:opacity-70 transition"
          >
            {route.shortName} line — all stations →
          </a>
          {from && (
            <a
              href={`/stops/${from}/lines/${route.slug}`}
              className="text-sm no-underline hover:opacity-70 transition"
            >
              Back to arrivals →
            </a>
          )}
        </div>
      </nav>
    </main>
  );
}
