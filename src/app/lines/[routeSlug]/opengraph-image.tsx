import { ImageResponse } from "next/og";
import { getRouteBySlug } from "@/lib/gtfs";
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
export const alt = "Route info";
export const size = OG_SIZE;
export const contentType = "image/png";

interface Props {
  params: Promise<{ routeSlug: string }>;
}

export default async function Image({ params }: Props) {
  const { routeSlug } = await params;
  const route = getRouteBySlug(routeSlug);

  if (!route) {
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
          {/* Colored accent border */}
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
              {route.shortName} Line
            </span>

            <span
              style={{
                fontSize: 24,
                color: MUTED_COLOR,
              }}
            >
              {route.longName}
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
