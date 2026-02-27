"use client";

import Link from "next/link";
import type { Route, Station } from "@/lib/gtfs";
import { RouteBullet } from "./route-bullet";
import { SearchFilter } from "./search-filter";

interface StationListProps {
  stations: Station[];
  stationRoutes: Record<string, string[]>;
  routes: Route[];
}

export function StationList({
  stations,
  stationRoutes,
  routes,
}: StationListProps) {
  const routeMap = new Map(routes.map((r) => [r.id, r]));

  return (
    <SearchFilter
      items={stations}
      filterFn={(station, query) =>
        station.name.toLowerCase().includes(query)
      }
      placeholder="Filter stations..."
    >
      {(filtered) => (
        <ul className="divide-y divide-border">
          {filtered.map((station) => {
            const routeIds = stationRoutes[station.id] || [];
            return (
              <li key={station.id} className="py-2">
                <Link
                  href={`/stops/${station.slug}`}
                  className="flex items-center justify-between gap-2 no-underline hover:opacity-70"
                >
                  <span className="text-sm">{station.name}</span>
                  <span className="flex gap-1 shrink-0">
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
                </Link>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="py-4 text-muted text-sm">No stations found.</li>
          )}
        </ul>
      )}
    </SearchFilter>
  );
}
