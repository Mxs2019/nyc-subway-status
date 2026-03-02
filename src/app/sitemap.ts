import type { MetadataRoute } from "next";
import { getRoutes, getStationRoutes, getStations } from "@/lib/gtfs";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://nyc-subway-status.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const stations = getStations();
  const routes = getRoutes();
  const stationRoutes = getStationRoutes();

  const routeMap = new Map(routes.map((r) => [r.id, r]));

  const entries: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${BASE_URL}/stops`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/lines`, changeFrequency: "weekly", priority: 0.8 },
  ];

  // Station pages
  for (const station of stations) {
    entries.push({
      url: `${BASE_URL}/stops/${station.slug}`,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  // Route pages
  for (const route of routes) {
    entries.push({
      url: `${BASE_URL}/lines/${route.slug}`,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  // Station x Route pages (the core status pages)
  for (const station of stations) {
    const routeIds = stationRoutes[station.id] || [];
    for (const routeId of routeIds) {
      const route = routeMap.get(routeId);
      if (!route) continue;
      entries.push({
        url: `${BASE_URL}/stops/${station.slug}/lines/${route.slug}`,
        changeFrequency: "always",
        priority: 0.7,
      });
    }
  }

  return entries;
}
