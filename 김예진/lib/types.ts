export type Coordinate = {
  lat: number;
  lng: number;
};

export type PlaceSource = "pilot" | "tmap";

export type Place = {
  id: string;
  name: string;
  address: string;
  coordinate: Coordinate;
  source: PlaceSource;
};

export type RouteMode = "demo" | "tmap";

export type RoutePlan = {
  mode: RouteMode;
  source: string;
  distanceMeters: number;
  durationMinutes: number;
  points: Coordinate[];
  generatedAt: string;
  expiresAt: string;
  notice?: string;
};

export type SearchResponse = {
  places: Place[];
  mode: "pilot" | "tmap";
  notice?: string;
};

export type FacilityKind = "cctv" | "security-light";

export type SafetyFacility = {
  id: string;
  kind: FacilityKind;
  name: string;
  coordinate: Coordinate;
  sourceDatasetId: string;
  sourceMode: "pilot" | "public";
  address?: string;
  purpose?: string;
  cameraCount?: number;
  managingAgency?: string;
  displayOnMap?: boolean;
  referenceDate?: string;
};

export type FacilityDatasetStatus =
  | "active"
  | "pilot-only"
  | "candidate"
  | "not-found";

export type FacilityDataset = {
  id: string;
  kind: FacilityKind | "mixed";
  name: string;
  provider: string;
  sourceUrl: string;
  coordinateSystem: "WGS84";
  updateCycle: string;
  sourceUpdatedAt?: string;
  snapshotGeneratedAt: string;
  status: FacilityDatasetStatus;
  note: string;
};

export type FacilityResponse = {
  mode: "pilot" | "public";
  facilities: SafetyFacility[];
  coverageArea: FacilityCoverageArea;
  datasets: FacilityDataset[];
  generatedAt: string;
  source: {
    status: "ready" | "fallback";
    checkedAt: string;
    message: string;
    publicCctvCount: number;
    publicSecurityLightLocationCount: number;
  };
  notice: string;
};

export type FacilityCoverageArea = {
  center: Coordinate;
  radiusMeters: number;
};

export type SafetyAnalysis = {
  status: "ready" | "route-required" | "facility-data-required";
  score: number | null;
  label: string;
  cctvNearRoute: number;
  securityLightsNearRoute: number;
  combinedCoveragePercent: number;
  cctvCoveragePercent: number;
  securityLightCoveragePercent: number;
  coverageAreaPercent: number;
  sampleCount: number;
  scoredSampleCount: number;
  reasons: string[];
  limitations: string[];
};
