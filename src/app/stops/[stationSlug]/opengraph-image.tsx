import { ImageResponse } from "next/og";
import { getStationBySlug, getRoutesForStation } from "@/lib/gtfs";
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
export const alt = "Station arrivals";
export const size = OG_SIZE;
export const contentType = "image/png";

interface Props {
  params: Promise<{ stationSlug: string }>;
}

export default async function Image({ params }: Props) {
  const { stationSlug } = await params;
  const station = getStationBySlug(stationSlug);

  if (!station) {
    // Fallback: generic branding
    const { default: RootImage } = await import("@/app/opengraph-image");
    return RootImage();
  }

  const routes = getRoutesForStation(station.id);

  return new ImageResponse(
    (
      <OgContainer>
        <div
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 32,
          }}
        >
          {routes.map((r) => (
            <OgRouteBullet
              key={r.id}
              shortName={r.shortName}
              color={r.color}
              textColor={r.textColor}
              size={64}
            />
          ))}
        </div>

        <span
          style={{
            fontSize: 48,
            fontWeight: 700,
            color: TEXT_COLOR,
            letterSpacing: "-0.02em",
            textAlign: "center",
          }}
        >
          {station.name}
        </span>

        <span
          style={{
            fontSize: 24,
            color: MUTED_COLOR,
            marginTop: 12,
          }}
        >
          Real-time subway arrivals
        </span>

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
