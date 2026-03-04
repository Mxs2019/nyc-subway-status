export interface Arrival {
  headsign: string;
  minutes_away: number | null;
  trip_id: string;
}

export interface RouteBulletInfo {
  name: string;
  color: string;
  text_color: string;
}

export interface SearchView {
  view: "search";
  stations: {
    name: string;
    slug: string;
    routes: RouteBulletInfo[];
  }[];
  routes: {
    name: string;
    long_name: string;
    slug: string;
    color: string;
    text_color: string;
  }[];
  suggested_call?: {
    tool: string;
    params: Record<string, unknown>;
  };
}

export interface ArrivalsView {
  view: "arrivals";
  station: string;
  route: RouteBulletInfo;
  uptown_arrivals: Arrival[];
  downtown_arrivals: Arrival[];
}

export interface StationView {
  view: "station";
  station: string;
  routes: (RouteBulletInfo & {
    uptown: Arrival[];
    downtown: Arrival[];
  })[];
}

export interface TripView {
  view: "trip";
  trip_id: string;
  route: RouteBulletInfo;
  direction: string;
  stops: {
    station: string;
    minutes_away: number | null;
    status: "passed" | "upcoming";
  }[];
}

export interface PlannerView {
  view: "planner";
  origin: string;
  destination: string;
  trips: {
    route: RouteBulletInfo;
    depart_minutes: number;
    arrive_minutes: number;
    travel_minutes: number;
    num_stops: number;
  }[];
}

export type WidgetView =
  | SearchView
  | ArrivalsView
  | StationView
  | TripView
  | PlannerView;
