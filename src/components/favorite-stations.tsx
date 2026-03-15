"use client";

import { useState, useEffect } from "react";
import type { Route, Station } from "@/lib/gtfs";
import { RouteBullet } from "./route-bullet";
import { useFavorites } from "@/hooks/use-favorites";

interface FavoriteStationsProps {
  stations: Station[];
  routes: Route[];
  stationRoutes: Record<string, string[]>;
}

export function FavoriteStations({ stations, routes, stationRoutes }: FavoriteStationsProps) {
  const { favorites } = useFavorites();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || favorites.length === 0) return null;

  const routeMap = new Map(routes.map((r) => [r.id, r]));
  const stationBySlug = new Map(stations.map((s) => [s.slug, s]));

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Favorites</h3>
      <ul className="divide-y divide-border">
        {favorites.map((fav) => {
          const station = stationBySlug.get(fav.stationSlug);
          if (!station) return null;
          const routeIds = stationRoutes[station.id] || [];
          return (
            <li key={fav.stationSlug} className="py-2">
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
}
