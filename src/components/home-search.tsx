"use client";

import { useState, useEffect } from "react";
import type { Route, Station } from "@/lib/gtfs";
import { RouteBullet } from "./route-bullet";
import { useFuzzySearch } from "@/hooks/use-fuzzy-search";
import { getScoredRecents, type RecentPage } from "@/hooks/use-recent-pages";

interface HomeSearchProps {
  stations: Station[];
  routes: Route[];
  stationRoutes: Record<string, string[]>;
}

const STATION_FIELDS = ["name"];
const ROUTE_FIELDS = ["shortName", "longName"];
const MAX_RESULTS = 5;

export function hasExactRouteMatch(
  query: string,
  routes: { shortName: string }[]
): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return false;
  return routes.some((r) => r.shortName.toLowerCase() === trimmed);
}

export function HomeSearch({ stations, routes, stationRoutes }: HomeSearchProps) {
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<RecentPage[]>([]);

  useEffect(() => {
    setRecents(getScoredRecents());
  }, []);

  const routeMap = new Map(routes.map((r) => [r.id, r]));
  const stationBySlug = new Map(stations.map((s) => [s.slug, s]));
  const routeBySlug = new Map(routes.map((r) => [r.slug, r]));

  const { items: matchedStations, topScore: stationsScore } = useFuzzySearch(stations, STATION_FIELDS, query);
  const { items: matchedRoutes, topScore: routesScore } = useFuzzySearch(routes, ROUTE_FIELDS, query);

  const hasQuery = query.trim().length > 0;
  const hasResults = matchedStations.length > 0 || matchedRoutes.length > 0;

  const stopsSection = (
    <div key="stops">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Stops</h3>
      <ul className="divide-y divide-border">
        {matchedStations.slice(0, MAX_RESULTS).map((station) => {
          const routeIds = stationRoutes[station.id] || [];
          return (
            <li key={station.id} className="py-2">
              <a
                href={`/stops/${station.slug}`}
                className="flex items-center justify-between gap-2 no-underline hover:opacity-70"
              >
                <span className="text-sm">{station.name}</span>
                <span className="flex gap-1 flex-wrap justify-end">
                  {routeIds.map((rid) => {
                    const r = routeMap.get(rid);
                    if (!r) return null;
                    return (
                      <RouteBullet
                        key={rid}
                        shortName={r.shortName}
                        color={r.color}
                        textColor={r.textColor}
                        size="sm"
                      />
                    );
                  })}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );

  const linesSection = (
    <div key="lines">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Lines</h3>
      <ul className="divide-y divide-border">
        {matchedRoutes.slice(0, MAX_RESULTS).map((route) => (
          <li key={route.id} className="py-2">
            <a
              href={`/lines/${route.slug}`}
              className="flex items-center gap-3 no-underline hover:opacity-70"
            >
              <RouteBullet
                shortName={route.shortName}
                color={route.color}
                textColor={route.textColor}
              />
              <span className="text-sm">{route.longName}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );

  const exactRouteMatch = hasExactRouteMatch(query, routes);

  const sections: { score: number; element: React.ReactNode }[] = [];
  if (matchedStations.length > 0) sections.push({ score: stationsScore, element: stopsSection });
  if (matchedRoutes.length > 0) sections.push({ score: exactRouteMatch ? Infinity : routesScore, element: linesSection });
  sections.sort((a, b) => b.score - a.score);

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search stops and lines..."
        className="w-full border border-border px-3 py-2 text-sm bg-white focus:outline-none focus:border-foreground"
      />

      {hasQuery && (
        <div className="mt-4 space-y-4">
          {hasResults ? (
            sections.map((s) => s.element)
          ) : (
            <p className="text-muted text-sm">No results found.</p>
          )}
        </div>
      )}

      {!hasQuery && recents.length > 0 && (() => {
        const MAX_PER_SECTION = 5;
        const recentStops = recents.filter((r) => r.type === "stop").slice(0, MAX_PER_SECTION);
        const recentLines = recents.filter((r) => r.type === "line").slice(0, MAX_PER_SECTION);
        const recentArrivals = recents.filter((r) => r.type === "arrival").slice(0, MAX_PER_SECTION);

        return (
          <div className="mt-4 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Recents</h3>

            {recentStops.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted mb-1">Stops</h4>
                <ul className="divide-y divide-border">
                  {recentStops.map((recent) => {
                    const station = recent.stationSlug ? stationBySlug.get(recent.stationSlug) : undefined;
                    if (!station) return null;
                    const routeIds = stationRoutes[station.id] || [];
                    return (
                      <li key={`stop-${recent.stationSlug}`} className="py-2">
                        <a
                          href={`/stops/${station.slug}`}
                          className="flex items-center justify-between gap-2 no-underline hover:opacity-70"
                        >
                          <span className="text-sm">{station.name}</span>
                          <span className="flex gap-1 flex-wrap justify-end">
                            {routeIds.map((rid) => {
                              const r = routeMap.get(rid);
                              if (!r) return null;
                              return (
                                <RouteBullet
                                  key={rid}
                                  shortName={r.shortName}
                                  color={r.color}
                                  textColor={r.textColor}
                                  size="sm"
                                />
                              );
                            })}
                          </span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {recentLines.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted mb-1">Lines</h4>
                <ul className="divide-y divide-border">
                  {recentLines.map((recent) => {
                    const route = recent.routeSlug ? routeBySlug.get(recent.routeSlug) : undefined;
                    if (!route) return null;
                    return (
                      <li key={`line-${recent.routeSlug}`} className="py-2">
                        <a
                          href={`/lines/${route.slug}`}
                          className="flex items-center gap-3 no-underline hover:opacity-70"
                        >
                          <RouteBullet
                            shortName={route.shortName}
                            color={route.color}
                            textColor={route.textColor}
                          />
                          <span className="text-sm">{route.longName}</span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {recentArrivals.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted mb-1">Arrivals</h4>
                <ul className="divide-y divide-border">
                  {recentArrivals.map((recent) => {
                    const station = recent.stationSlug ? stationBySlug.get(recent.stationSlug) : undefined;
                    const route = recent.routeSlug ? routeBySlug.get(recent.routeSlug) : undefined;
                    if (!station || !route) return null;
                    return (
                      <li key={`arrival-${recent.stationSlug}-${recent.routeSlug}`} className="py-2">
                        <a
                          href={`/stops/${station.slug}/lines/${route.slug}`}
                          className="flex items-center gap-3 no-underline hover:opacity-70"
                        >
                          <RouteBullet
                            shortName={route.shortName}
                            color={route.color}
                            textColor={route.textColor}
                            size="sm"
                          />
                          <span className="text-sm">{station.name}</span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
