/**
 * Route bullet — colored circle with route letter/number.
 * Colors come from GTFS route_color/route_text_color.
 */

interface RouteBulletProps {
  shortName: string;
  color: string;
  textColor: string;
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: "w-5 h-5 text-[10px]",
  md: "w-7 h-7 text-xs",
  lg: "w-9 h-9 text-sm",
};

export function RouteBullet({
  shortName,
  color,
  textColor,
  size = "md",
}: RouteBulletProps) {
  return (
    <span
      className={`${sizes[size]} inline-flex items-center justify-center rounded-full font-bold shrink-0 no-underline`}
      style={{ backgroundColor: color, color: textColor }}
    >
      {shortName}
    </span>
  );
}
