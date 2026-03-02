"use client";

import { useState, useMemo } from "react";
import type { Route, Station } from "@/lib/gtfs";
import { RouteBullet } from "./route-bullet";
import { haversineDistance, formatDistance } from "@/lib/geo";

interface NearbyStationsProps {
  stations: Station[];
  routes: Route[];
  stationRoutes: Record<string, string[]>;
}

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; lat: number; lon: number }
  | { status: "error"; message: string; recoverable: boolean };

export function NearbyStations({ stations, routes, stationRoutes }: NearbyStationsProps) {
  const [state, setState] = useState<State>({ status: "idle" });

  const routeMap = useMemo(() => new Map(routes.map((r) => [r.id, r])), [routes]);

  const nearby = useMemo(() => {
    if (state.status !== "success") return [];
    return stations
      .map((s) => ({
        station: s,
        distance: haversineDistance(state.lat, state.lon, s.lat, s.lon),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);
  }, [state, stations]);

  function handleClick() {
    if (!navigator.geolocation) {
      setState({ status: "error", message: "Geolocation is not supported by your browser.", recoverable: true });
      return;
    }

    setState({ status: "loading" });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          status: "success",
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      (error) => {
        const recoverable = error.code !== error.PERMISSION_DENIED;
        const message =
          error.code === error.PERMISSION_DENIED
            ? "Location permission denied."
            : error.code === error.TIMEOUT
              ? "Location request timed out. Try again."
              : "Unable to determine your location. Try again.";
        setState({ status: "error", message, recoverable });
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  }

  return (
    <div>
      {(state.status === "idle" || state.status === "loading" || (state.status === "error" && state.recoverable)) && (
        <button
          onClick={handleClick}
          disabled={state.status === "loading"}
          className={`w-full border border-border px-3 py-2 text-sm bg-white text-left${
            state.status === "loading" ? " opacity-50 cursor-wait" : " cursor-pointer hover:border-foreground"
          }`}
        >
          {state.status === "loading" ? "Locating…" : "Find nearby stations"}
        </button>
      )}

      {state.status === "error" && (
        <p className="mt-2 text-xs text-muted" role="alert">
          {state.message}
        </p>
      )}

      {state.status === "success" && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Nearby</h3>
          <ul className="divide-y divide-border">
            {nearby.map(({ station, distance }) => {
              const routeIds = stationRoutes[station.id] || [];
              return (
                <li key={station.id} className="py-2">
                  <a
                    href={`/stops/${station.slug}`}
                    className="flex items-center justify-between gap-2 no-underline hover:opacity-70"
                  >
                    <span className="flex flex-col">
                      <span className="text-sm">{station.name}</span>
                      <span className="text-xs text-muted">{formatDistance(distance)}</span>
                    </span>
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
    </div>
  );
}
