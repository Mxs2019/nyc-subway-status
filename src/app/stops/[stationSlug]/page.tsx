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
  searchParams: Promise<{ group?: string | string[] }>;
}

interface StationArrival {
  route: Route;
  tripId: string;
  arrivalTime: number;
}

interface RouteGroup {
  id: string;
  label: string;
  color: string;
  iconRoute: Route;
  routes: Route[];
}

const COLOR_GROUP_LABELS: Record<string, string> = {
  "#0039A6": "Blue Line",
  "#00933C": "Green Line",
  "#6CBE45": "Lime Line",
  "#996633": "Brown Line",
  "#A7A9AC": "Gray Line",
  "#B933AD": "Purple Line",
  "#EE352E": "Red Line",
  "#FCCC0A": "Yellow Line",
  "#FF6319": "Orange Line",
};

const COLOR_GROUP_ICON_ROUTE_IDS: Record<string, string[]> = {
  "#0039A6": ["A", "C", "E"],
  "#00933C": ["6", "5", "4", "6X"],
  "#6CBE45": ["G"],
  "#996633": ["J", "Z"],
  "#A7A9AC": ["L", "S", "GS", "FS", "H", "SI"],
  "#B933AD": ["7", "7X"],
  "#EE352E": ["1", "2", "3"],
  "#FCCC0A": ["Q", "N", "R", "W"],
  "#FF6319": ["B", "D", "F", "M", "FX"],
};

function getSelectedGroupId(group: string | string[] | undefined): string | null {
  if (!group) return null;
  if (Array.isArray(group)) return group[0] || null;
  return group;
}

function normalizeColor(color: string): string {
  return color.toUpperCase();
}

function buildRouteGroups(routes: Route[]): RouteGroup[] {
  const byColor = new Map<string, RouteGroup>();

  for (const route of routes) {
    const colorKey = normalizeColor(route.color);
    const existing = byColor.get(colorKey);
    if (existing) {
      existing.routes.push(route);
      continue;
    }

    byColor.set(colorKey, {
      id: `color-${colorKey.replace("#", "").toLowerCase()}`,
      label: "",
      color: route.color,
      iconRoute: route,
      routes: [route],
    });
  }

  const groups = Array.from(byColor.values());

  for (const group of groups) {
    if (group.routes.length === 1) {
      group.label = group.routes[0].shortName;
      group.id = `route-${group.routes[0].slug}`;
      group.iconRoute = group.routes[0];
      continue;
    }

    const colorLabel = COLOR_GROUP_LABELS[normalizeColor(group.color)];
    if (colorLabel) {
      group.label = colorLabel;
    } else {
      group.label = group.routes.map((route) => route.shortName).join("/");
    }

    const preferredRouteIds = COLOR_GROUP_ICON_ROUTE_IDS[normalizeColor(group.color)] || [];
    const preferredIconRoute = preferredRouteIds
      .map((routeId) => group.routes.find((route) => route.id === routeId))
      .find(Boolean);

    group.iconRoute = preferredIconRoute || group.routes[0];
  }

  return groups;
}

function getAllLinesAvatarColors(groups: RouteGroup[]): string[] {
  const palette = groups.slice(0, 4).map((group) => group.color);
  while (palette.length < 4) {
    palette.push("#D4D4D4");
  }
  return palette;
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

export default async function StationPage({ params, searchParams }: Props) {
  const { stationSlug } = await params;
  const query = await searchParams;
  const station = getStationBySlug(stationSlug);
  if (!station) notFound();

  const routes = getRoutesForStation(station.id);
  const routeGroups = buildRouteGroups(routes);
  const allLinesAvatarColors = getAllLinesAvatarColors(routeGroups);
  const selectedGroupId = getSelectedGroupId(query.group);
  const selectedGroup = selectedGroupId
    ? routeGroups.find((group) => group.id === selectedGroupId)
    : undefined;

  const filteredRoutes = selectedGroup ? selectedGroup.routes : routes;

  let error: string | null = null;
  const uptownArrivals: StationArrival[] = [];
  const downtownArrivals: StationArrival[] = [];

  try {
    const arrivalsByRoute = await getAllArrivalsForStation(
      station.childStopIds,
      filteredRoutes.map((route) => route.id),
      24,
      10
    );

    for (const route of filteredRoutes) {
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

      <section>
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted mb-3">Filter by line group</h2>
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <a
            href={`/stops/${station.slug}`}
            title="All lines"
            aria-label="All lines"
            className={`inline-flex items-center justify-center rounded-full border p-1 no-underline hover:opacity-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 ${
              !selectedGroup
                ? "border-foreground bg-white ring-2 ring-foreground/10"
                : "border-border bg-white/80 hover:border-foreground/40"
            }`}
          >
            <span className="inline-grid grid-cols-2 gap-0.5">
              {allLinesAvatarColors.map((color, idx) => (
                <span
                  key={`${color}-${idx}`}
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: color }}
                />
              ))}
            </span>
          </a>
          {routeGroups.map((group) => (
            <a
              key={group.id}
              href={`/stops/${station.slug}?group=${group.id}`}
              title={group.label}
              aria-label={group.label}
              className={`inline-flex items-center justify-center rounded-full border p-1 no-underline hover:opacity-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 ${
                selectedGroup?.id === group.id
                  ? "border-foreground bg-white ring-2 ring-foreground/10"
                  : "border-border bg-white/80 hover:border-foreground/40"
              }`}
            >
              <RouteBullet
                shortName={group.iconRoute.shortName}
                color={group.iconRoute.color}
                textColor={group.iconRoute.textColor}
              />
            </a>
          ))}
        </div>

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
              Uptown - Next 10 min
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
              <p className="text-muted text-xs mt-2">No uptown trains in the next 10 minutes.</p>
            )}
          </section>

          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted mb-3">
              Downtown - Next 10 min
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
              <p className="text-muted text-xs mt-2">No downtown trains in the next 10 minutes.</p>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
