import { App } from "@modelcontextprotocol/ext-apps";
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

const appEl = document.getElementById("app")!;

function renderView(data: WidgetView) {
  switch (data.view) {
    case "search":
      appEl.innerHTML = renderSearch(data);
      break;
    case "arrivals":
      appEl.innerHTML = renderArrivals(data);
      break;
    case "station":
      appEl.innerHTML = renderStation(data);
      break;
    case "trip":
      appEl.innerHTML = renderTrip(data);
      break;
    case "planner":
      appEl.innerHTML = renderPlanner(data);
      break;
  }
}

// Initialize the MCP App SDK
const mcpApp = new App(
  { name: "NYC Subway Status", version: "1.0.0" },
  {},
);

mcpApp.ontoolresult = (result) => {
  // structuredContent is the primary data source (set by our MCP server)
  const structured = (result as Record<string, unknown>)
    .structuredContent as WidgetView | undefined;
  if (structured?.view) {
    renderView(structured);
    return;
  }

  // Fallback: parse from text content
  const textBlock = result.content?.find(
    (b: { type: string }) => b.type === "text",
  ) as { type: "text"; text: string } | undefined;
  if (textBlock) {
    try {
      const parsed = JSON.parse(textBlock.text) as WidgetView;
      if (parsed?.view) {
        renderView(parsed);
      }
    } catch {
      // Not JSON or not a view
    }
  }
};

// Connect to host — default transport is PostMessageTransport(window.parent)
mcpApp.connect().catch((err) => {
  console.error("[NYC Subway Widget] Failed to connect:", err);
});
