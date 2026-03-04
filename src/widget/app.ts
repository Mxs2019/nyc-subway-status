import { styles } from "./styles";
import { renderSearch } from "./views/search";
import { renderArrivals } from "./views/arrivals";
import { renderStation } from "./views/station";
import { renderTrip } from "./views/trip";
import { renderPlanner } from "./views/planner";
import type { WidgetView } from "./types";

// Inject styles
const styleEl = document.createElement("style");
styleEl.textContent = styles;
document.head.appendChild(styleEl);

const app = document.getElementById("app")!;

// MCP App SDK integration
declare const McpApp: {
  ontoolresult: ((result: { structuredContent?: unknown }) => void) | null;
  callServerTool: (
    name: string,
    args: Record<string, unknown>
  ) => Promise<unknown>;
};

if (typeof McpApp !== "undefined") {
  McpApp.ontoolresult = (result) => {
    const data = result.structuredContent as WidgetView;
    if (!data?.view) return;

    switch (data.view) {
      case "search":
        app.innerHTML = renderSearch(data);
        break;
      case "arrivals":
        app.innerHTML = renderArrivals(data);
        break;
      case "station":
        app.innerHTML = renderStation(data);
        break;
      case "trip":
        app.innerHTML = renderTrip(data);
        break;
      case "planner":
        app.innerHTML = renderPlanner(data);
        break;
    }
  };
}
