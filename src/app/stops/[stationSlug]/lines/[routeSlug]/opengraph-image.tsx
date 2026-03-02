import { ImageResponse } from "next/og";
import {
  getStationBySlug,
  getRouteBySlug,
  getStationRoutes,
} from "@/lib/gtfs";
import {
  getFont,
  OG_SIZE,
  OgContainer,
  OgBranding,
  OgRouteBullet,
  TEXT_COLOR,
  MUTED_COLOR,
} from "@/lib/og";

export const runtime = "nodejs";
export const alt = "NYC subway station and line — real-time train arrivals";
export const size = OG_SIZE;
export const contentType = "image/png";

interface Props {
  params: Promise<{ stationSlug: string; routeSlug: string }>;
}

export default async function Image({ params }: Props) {
  const { stationSlug, routeSlug } = await params;
  const station = getStationBySlug(stationSlug);
  const route = getRouteBySlug(routeSlug);

  if (!station || !route) {
    const { default: RootImage } = await import("@/app/opengraph-image");
    return RootImage();
  }

  // Verify route serves this station
  const stationRoutes = getStationRoutes();
  const routeIds = stationRoutes[station.id] || [];
  if (!routeIds.includes(route.id)) {
    const { default: RootImage } = await import("@/app/opengraph-image");
    return RootImage();
  }

  return new ImageResponse(
    (
      <OgContainer>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 40,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 20,
              borderLeft: `6px solid ${route.color}`,
              paddingLeft: 32,
            }}
          >
            <OgRouteBullet
              shortName={route.shortName}
              color={route.color}
              textColor={route.textColor}
              size={100}
            />

            <span
              style={{
                fontSize: 44,
                fontWeight: 700,
                color: TEXT_COLOR,
                letterSpacing: "-0.02em",
              }}
            >
              {station.name}
            </span>

            <span
              style={{
                fontSize: 24,
                color: MUTED_COLOR,
              }}
            >
              {route.shortName} Train — {route.longName}
            </span>
          </div>
        </div>

        <OgBranding />
      </OgContainer>
    ),
    {
      ...size,
      fonts: [
        {
          name: "GeistMono",
          data: getFont(),
          style: "normal",
          weight: 700,
        },
      ],
    }
  );
}
