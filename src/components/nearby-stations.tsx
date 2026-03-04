"use client";

import { useState, useEffect, useMemo } from "react";
import type { Route, Station } from "@/lib/gtfs";
import { RouteBullet } from "./route-bullet";
import { haversineDistance, formatDistance } from "@/lib/geo";

interface NearbyStationsProps {
  stations: Station[];
  routes: Route[];
  stationRoutes: Record<string, string[]>;
}

type State =
  | { status: "checking" }
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; lat: number; lon: number }
  | { status: "denied" }
  | { status: "error"; message: string };

function fetchPosition(
  onSuccess: (lat: number, lon: number) => void,
  onDenied: () => void,
  onError: (message: string) => void
) {
  navigator.geolocation.getCurrentPosition(
    (position) => {
      onSuccess(position.coords.latitude, position.coords.longitude);
    },
    (error) => {
      if (error.code === error.PERMISSION_DENIED) {
        onDenied();
      } else {
        const message =
          error.code === error.TIMEOUT
            ? "Location request timed out. Try again."
            : "Unable to determine your location. Try again.";
        onError(message);
      }
    },
    { timeout: 10000, enableHighAccuracy: false }
  );
}

export function NearbyStations({ stations, routes, stationRoutes }: NearbyStationsProps) {
  const [state, setState] = useState<State>({ status: "checking" });

  const routeMap = useMemo(() => new Map(routes.map((r) => [r.id, r])), [routes]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setState({ status: "idle" });
      return;
    }

    if (!navigator.permissions?.query) {
      setState({ status: "idle" });
      return;
    }

    navigator.permissions.query({ name: "geolocation" }).then((result) => {
      if (result.state === "granted") {
        setState({ status: "loading" });
        fetchPosition(
          (lat, lon) => setState({ status: "success", lat, lon }),
          () => setState({ status: "denied" }),
          (message) => setState({ status: "error", message })
        );
      } else if (result.state === "denied") {
        setState({ status: "denied" });
      } else {
        setState({ status: "idle" });
      }
    }).catch(() => {
      setState({ status: "idle" });
    });
  }, []);

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
      setState({ status: "error", message: "Geolocation is not supported by your browser." });
      return;
    }

    setState({ status: "loading" });

    fetchPosition(
      (lat, lon) => setState({ status: "success", lat, lon }),
      () => setState({ status: "denied" }),
      (message) => setState({ status: "error", message })
    );
  }

  if (state.status === "checking") return null;

  return (
    <div>
      {state.status === "idle" && (
        <button
          onClick={handleClick}
          className="w-full border border-border px-3 py-2 text-sm bg-white text-left cursor-pointer hover:border-foreground"
        >
          Find nearby stations
        </button>
      )}

      {state.status === "loading" && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Nearby</h3>
          <ul className="divide-y divide-border">
            {Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="py-2 flex items-center justify-between gap-2">
                <span className="flex flex-col gap-1">
                  <span className="h-4 w-32 bg-border/60 rounded animate-pulse" />
                  <span className="h-3 w-16 bg-border/40 rounded animate-pulse" />
                </span>
                <span className="flex gap-1">
                  <span className="h-5 w-5 bg-border/60 rounded-full animate-pulse" />
                  <span className="h-5 w-5 bg-border/60 rounded-full animate-pulse" />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {state.status === "denied" && (
        <p className="text-xs text-muted">
          Enable location in your browser settings to see nearby stations.
        </p>
      )}

      {state.status === "error" && (
        <div>
          <p className="text-xs text-muted" role="alert">{state.message}</p>
          <button
            onClick={handleClick}
            className="mt-2 text-xs text-muted underline hover:text-foreground cursor-pointer"
          >
            Try again
          </button>
        </div>
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
