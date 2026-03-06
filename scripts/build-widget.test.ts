import { describe, expect, it } from "vitest";
import { injectWidgetJs } from "./build-widget";

describe("injectWidgetJs", () => {
  it("preserves replacement tokens from bundled JavaScript", () => {
    const template =
      '<!DOCTYPE html><html><body><script>/* __WIDGET_JS__ */</script></body></html>';
    const js = 'const markers = ["$&", "$`", "$\'"];';

    const html = injectWidgetJs(template, js);

    expect(html).toContain(js);
    expect((html.match(/<!DOCTYPE html>/g) || []).length).toBe(1);
  });
});
