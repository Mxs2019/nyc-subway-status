"use client";

import { useState } from "react";
import type { Route, Station } from "@/lib/gtfs";
import { RouteBullet } from "./route-bullet";

interface HomeSearchProps {
  stations: Station[];
  routes: Route[];
  stationRoutes: Record<string, string[]>;
}

type Tab = "stops" | "lines";

export function HomeSearch({ stations, routes, stationRoutes }: HomeSearchProps) {
  const [tab, setTab] = useState<Tab>("stops");
  const [query, setQuery] = useState("");
  const q = query.toLowerCase();

  const routeMap = new Map(routes.map((r) => [r.id, r]));

  const filteredStations = q
    ? stations.filter((s) => s.name.toLowerCase().includes(q))
    : stations;

  const filteredRoutes = q
    ? routes.filter(
        (r) =>
          r.shortName.toLowerCase().includes(q) ||
          r.longName.toLowerCase().includes(q)
      )
    : routes;

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={tab === "stops" ? "Filter stations..." : "Filter lines..."}
        className="w-full border border-border px-3 py-2 text-sm bg-white focus:outline-none focus:border-foreground"
      />

      <div className="flex gap-0 mt-4 border-b border-border">
        <button
          onClick={() => setTab("stops")}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider -mb-px ${
            tab === "stops"
              ? "border-b-2 border-foreground text-foreground"
              : "text-muted hover:text-foreground"
          }`}
        >
          Stops ({filteredStations.length})
        </button>
        <button
          onClick={() => setTab("lines")}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider -mb-px ${
            tab === "lines"
              ? "border-b-2 border-foreground text-foreground"
              : "text-muted hover:text-foreground"
          }`}
        >
          Lines ({filteredRoutes.length})
        </button>
      </div>

      <div className="mt-2">
        {tab === "stops" && (
          <ul className="divide-y divide-border">
            {filteredStations.map((station) => {
              const routeIds = stationRoutes[station.id] || [];
              return (
                <li key={station.id} className="py-2">
                  <a
                    href={`/stops/${station.slug}`}
                    className="flex items-center justify-between gap-2 no-underline hover:opacity-70"
                  >
                    <span className="text-sm">{station.name}</span>
                    <span className="flex gap-1 shrink-0 flex-wrap justify-end">
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
            {filteredStations.length === 0 && (
              <li className="py-4 text-muted text-sm">No stations found.</li>
            )}
          </ul>
        )}

        {tab === "lines" && (
          <ul className="divide-y divide-border">
            {filteredRoutes.map((route) => (
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
            {filteredRoutes.length === 0 && (
              <li className="py-4 text-muted text-sm">No lines found.</li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
