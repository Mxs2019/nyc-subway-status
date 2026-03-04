export const styles = `
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 12px;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 14px;
  color: #1a1a1a;
  background: transparent;
  line-height: 1.4;
}

.station-name {
  font-weight: 600;
  font-size: 15px;
}

.section-title {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #666;
  margin: 16px 0 8px;
  font-weight: 600;
}

.arrival-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid #eee;
}

.arrival-row:last-child {
  border-bottom: none;
}

.minutes {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  min-width: 48px;
  text-align: right;
}

.headsign {
  color: #444;
  flex: 1;
}

.arriving {
  color: #e63946;
  font-weight: 700;
}

.route-bullet {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-weight: 700;
  width: 24px;
  height: 24px;
  font-size: 12px;
  flex-shrink: 0;
  line-height: 1;
}

.route-bullet.sm {
  width: 20px;
  height: 20px;
  font-size: 10px;
}

.route-bullet.lg {
  width: 32px;
  height: 32px;
  font-size: 14px;
}

.direction-group {
  margin-bottom: 16px;
}

.direction-label {
  font-size: 13px;
  font-weight: 600;
  color: #333;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.trip-stop {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 13px;
}

.trip-stop.passed {
  opacity: 0.4;
}

.trip-stop .dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid;
  flex-shrink: 0;
}

.trip-stop.passed .dot {
  background: #ccc;
  border-color: #ccc;
}

.trip-stop.upcoming .dot {
  background: transparent;
}

.trip-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid #eee;
}

.trip-option:last-child {
  border-bottom: none;
}

.trip-detail {
  font-size: 12px;
  color: #666;
}

.empty-state {
  color: #999;
  font-style: italic;
  padding: 12px 0;
}

.search-result {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.search-result:last-child {
  border-bottom: none;
}

.route-pills {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
`;
