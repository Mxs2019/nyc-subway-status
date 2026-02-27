import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getStationBySlug,
  getStations,
  getRoutesForStation,
} from "@/lib/gtfs";
import { PageHeader } from "@/components/page-header";
import { RouteBullet } from "@/components/route-bullet";

interface Props {
  params: Promise<{ stationSlug: string }>;
}

export async function generateStaticParams() {
  return getStations().map((s) => ({ stationSlug: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { stationSlug } = await params;
  const station = getStationBySlug(stationSlug);
  if (!station) return {};
  return {
    title: station.name,
    description: `Real-time subway arrivals at ${station.name}.`,
  };
}

export default async function StationPage({ params }: Props) {
  const { stationSlug } = await params;
  const station = getStationBySlug(stationSlug);
  if (!station) notFound();

  const routes = getRoutesForStation(station.id);

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <PageHeader title={station.name} backHref="/stops" backLabel="All Stops" />

      <section>
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted mb-3">
          Lines at this station
        </h2>
        <ul className="divide-y divide-border">
          {routes.map((route) => (
            <li key={route.id} className="py-2">
              <Link
                href={`/stops/${station.slug}/lines/${route.slug}`}
                className="flex items-center gap-3 no-underline hover:opacity-70"
              >
                <RouteBullet
                  shortName={route.shortName}
                  color={route.color}
                  textColor={route.textColor}
                />
                <span className="text-sm">{route.longName}</span>
                <span className="ml-auto text-xs text-muted">View arrivals →</span>
              </Link>
            </li>
          ))}
        </ul>
        {routes.length === 0 && (
          <p className="text-muted text-sm">No lines found for this station.</p>
        )}
      </section>
    </main>
  );
}
