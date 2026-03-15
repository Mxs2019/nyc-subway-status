import type { ServiceAlert } from "@/lib/gtfsrt";
import { RouteBullet } from "./route-bullet";
import { getRouteById } from "@/lib/gtfs";

interface ServiceAlertsProps {
  alerts: ServiceAlert[];
}

const SEVERITY_STYLES: Record<string, { border: string; bg: string; text: string }> = {
  severe: { border: "border-red-400", bg: "bg-red-50", text: "text-red-800" },
  warning: { border: "border-yellow-400", bg: "bg-yellow-50", text: "text-yellow-800" },
  info: { border: "border-blue-300", bg: "bg-blue-50", text: "text-blue-800" },
  unknown: { border: "border-gray-300", bg: "bg-gray-50", text: "text-gray-700" },
};

export function ServiceAlerts({ alerts }: ServiceAlertsProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-3 mb-6">
      <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
        Service Alerts
      </h2>
      {alerts.map((alert) => {
        const styles = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.unknown;
        return (
          <div
            key={alert.id}
            className={`border ${styles.border} ${styles.bg} px-4 py-3 text-sm ${styles.text}`}
          >
            <div className="flex items-start gap-2">
              <span className="font-semibold text-xs uppercase shrink-0 mt-0.5">
                {alert.effect}
              </span>
              {alert.routeIds.length > 0 && (
                <div className="flex gap-1 shrink-0">
                  {alert.routeIds.map((routeId) => {
                    const route = getRouteById(routeId);
                    if (!route) return null;
                    return (
                      <RouteBullet
                        key={routeId}
                        shortName={route.shortName}
                        color={route.color}
                        textColor={route.textColor}
                        size="sm"
                      />
                    );
                  })}
                </div>
              )}
            </div>
            <p className="mt-1 font-medium">{alert.headerText}</p>
            {alert.descriptionText && (
              <p className="mt-1 text-xs opacity-80 line-clamp-3">
                {alert.descriptionText}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
