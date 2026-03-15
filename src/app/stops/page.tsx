import type { Metadata } from "next";
import { getRoutes, getStationRoutes, getStations } from "@/lib/gtfs";
import { PageHeader } from "@/components/page-header";
import { StationList } from "@/components/station-list";
import { BreadcrumbJsonLd } from "@/components/breadcrumb-jsonld";

export const metadata: Metadata = {
  title: "All Stops",
  description:
    "Browse all NYC subway stations. See real-time arrival times, upcoming trains, and service info for every stop in the system.",
};

export default function StopsPage() {
  const stations = getStations();
  const stationRoutes = getStationRoutes();
  const routes = getRoutes();

  return (
    <main id="main-content" className="max-w-2xl mx-auto px-4 py-8">
      <BreadcrumbJsonLd items={[{ name: "Home", href: "/" }, { name: "All Stops" }]} />
      <PageHeader
        title="All Stops"
        backHref="/"
        backLabel="Home"
      />
      <p className="text-muted text-xs mb-4">{stations.length} stations</p>
      <StationList
        stations={stations}
        stationRoutes={stationRoutes}
        routes={routes}
      />
    </main>
  );
}
