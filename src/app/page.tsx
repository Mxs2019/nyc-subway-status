import { getRoutes, getStationRoutes, getStations } from "@/lib/gtfs";
import { HomeSearch } from "@/components/home-search";
import { NearbyStations } from "@/components/nearby-stations";

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

      <div className="mt-6 flex gap-4">
        <a href="/stops" className="text-sm no-underline hover:opacity-70">All Stops →</a>
        <a href="/lines" className="text-sm no-underline hover:opacity-70">All Lines →</a>
      </div>

      <footer className="mt-12 pt-4 border-t border-border flex gap-4">
        <a href="/faq" className="text-xs text-muted hover:text-foreground transition-colors">
          FAQ
        </a>
        <a href="/docs" className="text-xs text-muted hover:text-foreground transition-colors">
          API Docs
        </a>
        <a href="/llms.txt" className="text-xs text-muted hover:text-foreground transition-colors">
          llms.txt
        </a>
      </footer>
    </main>
  );
}
