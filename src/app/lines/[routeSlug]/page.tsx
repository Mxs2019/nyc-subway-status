import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getRouteBySlug,
  getRoutes,
  getStationsForRoute,
} from "@/lib/gtfs";
import { PageHeader } from "@/components/page-header";
import { RouteBullet } from "@/components/route-bullet";

interface Props {
  params: Promise<{ routeSlug: string }>;
}

export async function generateStaticParams() {
  return getRoutes().map((r) => ({ routeSlug: r.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { routeSlug } = await params;
  const route = getRouteBySlug(routeSlug);
  if (!route) return {};
  return {
    title: `${route.shortName} Line`,
    description: `Stations and real-time status for the ${route.shortName} line.`,
  };
}

export default async function RoutePage({ params }: Props) {
  const { routeSlug } = await params;
  const route = getRouteBySlug(routeSlug);
  if (!route) notFound();

  const stations = getStationsForRoute(route.id);

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <PageHeader title={`${route.longName}`} backHref="/lines" backLabel="All Lines">
        <RouteBullet
          shortName={route.shortName}
          color={route.color}
          textColor={route.textColor}
          size="lg"
        />
      </PageHeader>

      <div
        className="border-l-4 pl-4 mb-6"
        style={{ borderColor: route.color }}
      >
        <p className="text-xs text-muted">
          {stations.length} stations
        </p>
      </div>

      <section>
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted mb-3">
          Stations
        </h2>
        <ul className="divide-y divide-border">
          {stations.map((station) => (
            <li key={station.id} className="py-2">
              <Link
                href={`/stops/${station.slug}/lines/${route.slug}`}
                className="flex items-center justify-between no-underline hover:opacity-70"
              >
                <span className="text-sm">{station.name}</span>
                <span className="text-xs text-muted">Status →</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
