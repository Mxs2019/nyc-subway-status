import type { Metadata } from "next";
import { getRoutes } from "@/lib/gtfs";
import { PageHeader } from "@/components/page-header";
import { RouteList } from "@/components/route-list";

export const metadata: Metadata = {
  title: "All Lines",
  description:
    "Browse all NYC subway lines. View real-time train arrivals, station lists, and service status for every route in the system.",
};

export default function LinesPage() {
  const routes = getRoutes();

  return (
    <main id="main-content" className="max-w-2xl mx-auto px-4 py-8">
      <PageHeader title="All Lines" backHref="/" backLabel="Home" />
      <p className="text-muted text-xs mb-4">{routes.length} lines</p>
      <RouteList routes={routes} />
    </main>
  );
}
