import { getRoutes, getStationRoutes, getStations } from "@/lib/gtfs";
import { HomeSearch } from "@/components/home-search";
import { NearbyStations } from "@/components/nearby-stations";
import { RecentStations } from "@/components/recent-stations";

export default function Home() {
  const stations = getStations();
  const routes = getRoutes();
  const stationRoutes = getStationRoutes();

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight">NYC Subway Status</h1>
      <p className="mt-2 text-muted text-xs leading-relaxed">
        Real-time arrival times for every station and line.
      </p>

      <div className="mt-6">
        <HomeSearch
          stations={stations}
          routes={routes}
          stationRoutes={stationRoutes}
        />
      </div>

      <div className="mt-4">
        <NearbyStations
          stations={stations}
          routes={routes}
          stationRoutes={stationRoutes}
        />
      </div>

      <div className="mt-4">
        <RecentStations
          stations={stations}
          routes={routes}
          stationRoutes={stationRoutes}
        />
      </div>

      <div className="mt-6 flex gap-4">
        <a href="/stops" className="text-sm no-underline hover:opacity-70">All Stops →</a>
        <a href="/lines" className="text-sm no-underline hover:opacity-70">All Lines →</a>
      </div>

    </main>
  );
}
