"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getRouteFacilities } from "@/lib/route-facilities";
import type {
  Coordinate,
  FacilityKind,
  Place,
  RoutePlan,
  SafetyFacility,
} from "@/lib/types";

export type MapStageStatus = "loading" | "tmap" | "demo";

type MapStageProps = {
  origin: Place;
  destination: Place;
  route: RoutePlan | null;
  facilities: SafetyFacility[];
  visibleFacilityKinds: FacilityKind[];
  onStatusChange?: (status: MapStageStatus) => void;
};

const OVERLAY_UPDATE_INTERVAL_MS = 80;

type TmapScreenPoint = {
  x?: number;
  y?: number;
  getX?: () => number;
  getY?: () => number;
};
type TmapMap = {
  fitBounds?: (bounds: unknown) => void;
  realToScreen?: (position: unknown) => TmapScreenPoint | null;
};
type TmapApi = {
  Map: new (
    element: HTMLElement | string,
    options: Record<string, unknown>,
  ) => TmapMap;
  LatLng: new (lat: number, lng: number) => unknown;
  LatLngBounds: new () => { extend: (point: unknown) => void };
};

declare global {
  interface Window {
    Tmapv3?: TmapApi;
  }
}

const SDK_SCRIPT_ID = "tmap-vector-sdk-proxy";
let sdkLoadPromise: Promise<boolean> | null = null;

function isTmapReady(api: TmapApi | undefined): api is TmapApi {
  const isConstructor = (value: unknown) => {
    if (typeof value !== "function") return false;

    try {
      Reflect.construct(String, [], value);
      return true;
    } catch {
      return false;
    }
  };

  return Boolean(
    api &&
      isConstructor(api.Map) &&
      isConstructor(api.LatLng) &&
      isConstructor(api.LatLngBounds),
  );
}

function loadTmapSdk() {
  if (isTmapReady(window.Tmapv3)) {
    return Promise.resolve(true);
  }

  if (sdkLoadPromise) return sdkLoadPromise;

  sdkLoadPromise = new Promise<boolean>((resolve) => {
    let settled = false;

    const finish = (ready: boolean) => {
      if (settled) return;
      settled = true;
      window.clearInterval(pollTimer);
      window.clearTimeout(timeoutTimer);
      window.removeEventListener("tmap-sdk-ready", handleReady);
      window.removeEventListener("tmap-sdk-failed", handleFailed);
      resolve(ready);
    };

    const handleReady = () => {
      if (isTmapReady(window.Tmapv3)) finish(true);
    };
    const handleFailed = () => finish(false);

    window.addEventListener("tmap-sdk-ready", handleReady);
    window.addEventListener("tmap-sdk-failed", handleFailed);

    const pollTimer = window.setInterval(() => {
      if (isTmapReady(window.Tmapv3)) finish(true);
    }, 100);
    const timeoutTimer = window.setTimeout(() => finish(false), 10_000);

    if (!document.getElementById(SDK_SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = SDK_SCRIPT_ID;
      script.src = "/api/tmap-sdk";
      script.async = true;
      script.addEventListener("error", () => finish(false), { once: true });
      document.head.appendChild(script);
    }
  });

  return sdkLoadPromise;
}

function readScreenPoint(point: TmapScreenPoint | null) {
  if (!point) return null;

  const x = typeof point.getX === "function" ? point.getX() : point.x;
  const y = typeof point.getY === "function" ? point.getY() : point.y;

  return Number.isFinite(x) && Number.isFinite(y)
    ? { x: x as number, y: y as number }
    : null;
}

function RealTmap({
  origin,
  destination,
  route,
  facilities,
  visibleFacilityKinds,
}: MapStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const routeHaloRef = useRef<SVGPolylineElement>(null);
  const routeLineRef = useRef<SVGPolylineElement>(null);
  const startEndpointRef = useRef<HTMLDivElement>(null);
  const endEndpointRef = useRef<HTMLDivElement>(null);
  const facilityElementsRef = useRef(new Map<string, HTMLElement>());
  const mapRef = useRef<TmapMap | null>(null);
  const startPositionRef = useRef<unknown | null>(null);
  const endPositionRef = useRef<unknown | null>(null);
  const routePositionsRef = useRef<unknown[]>([]);
  const facilityPositionsRef = useRef<
    Array<{ id: string; position: unknown }>
  >([]);
  const animationFrameRef = useRef<number | null>(null);
  const initialCenterRef = useRef(origin.coordinate);
  const routeFacilities = useMemo(() => getRouteFacilities(route, facilities), [route, facilities]);

  useEffect(() => {
    const api = window.Tmapv3;
    const element = containerRef.current;
    if (!isTmapReady(api) || !element) return;

    const initialCenter = initialCenterRef.current;
    const facilityElements = facilityElementsRef.current;
    mapRef.current = new api.Map(element, {
      center: new api.LatLng(initialCenter.lat, initialCenter.lng),
      width: "100%",
      height: "100%",
      zoom: 16,
    });

    let active = true;
    let previousPoints = "";
    let lastOverlayUpdateAt = Number.NEGATIVE_INFINITY;

    const positionEndpoint = (
      endpoint: HTMLElement | null,
      position: unknown | null,
      map: TmapMap,
      anchor: "pin" | "center" = "pin",
    ) => {
      if (!endpoint || !position || !map.realToScreen) {
        if (endpoint && endpoint.style.visibility !== "hidden") {
          endpoint.style.visibility = "hidden";
        }
        return;
      }

      const point = readScreenPoint(map.realToScreen(position));
      if (!point) {
        if (endpoint.style.visibility !== "hidden") {
          endpoint.style.visibility = "hidden";
        }
        return;
      }

      const transform =
        anchor === "center"
          ? `translate3d(${point.x}px, ${point.y}px, 0) translate(-50%, -50%)`
          : `translate3d(${point.x}px, ${point.y}px, 0) translate(-50%, -100%)`;
      if (endpoint.style.visibility !== "visible") {
        endpoint.style.visibility = "visible";
      }
      if (endpoint.style.transform !== transform) {
        endpoint.style.transform = transform;
      }
    };

    const drawMapOverlay = (timestamp: number) => {
      if (!active) return;

      const shouldUpdate =
        timestamp - lastOverlayUpdateAt >= OVERLAY_UPDATE_INTERVAL_MS;
      const map = mapRef.current;
      if (map && shouldUpdate) {
        lastOverlayUpdateAt = timestamp;
        const positions = routePositionsRef.current;
        const projected = map.realToScreen
          ? positions
              .map((position) =>
                readScreenPoint(map.realToScreen?.(position) ?? null),
              )
              .filter(
                (point): point is { x: number; y: number } => point !== null,
              )
          : [];
        const points =
          projected.length >= 2
            ? projected.map((point) => `${point.x},${point.y}`).join(" ")
            : "";

        if (points !== previousPoints) {
          previousPoints = points;
          routeHaloRef.current?.setAttribute("points", points);
          routeLineRef.current?.setAttribute("points", points);
        }

        positionEndpoint(
          startEndpointRef.current,
          startPositionRef.current,
          map,
        );
        positionEndpoint(
          endEndpointRef.current,
          endPositionRef.current,
          map,
        );

        for (const facility of facilityPositionsRef.current) {
          positionEndpoint(
            facilityElements.get(facility.id) ?? null,
            facility.position,
            map,
            "center",
          );
        }
      }

      animationFrameRef.current = window.requestAnimationFrame(drawMapOverlay);
    };

    animationFrameRef.current = window.requestAnimationFrame(drawMapOverlay);

    return () => {
      active = false;
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      routePositionsRef.current = [];
      facilityPositionsRef.current = [];
      facilityElements.clear();
      startPositionRef.current = null;
      endPositionRef.current = null;
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const api = window.Tmapv3;
    const map = mapRef.current;
    if (!isTmapReady(api) || !map) return;

    const start = new api.LatLng(origin.coordinate.lat, origin.coordinate.lng);
    const end = new api.LatLng(
      destination.coordinate.lat,
      destination.coordinate.lng,
    );
    startPositionRef.current = start;
    endPositionRef.current = end;

    const bounds = new api.LatLngBounds();
    bounds.extend(start);
    bounds.extend(end);

    const routePoints = route?.mode === "tmap" ? route.points : [];
    routePositionsRef.current = routePoints.map((point) => {
      const position = new api.LatLng(point.lat, point.lng);
      bounds.extend(position);
      return position;
    });

    map.fitBounds?.(bounds);
  }, [destination, origin, route]);

  useEffect(() => {
    const api = window.Tmapv3;
    if (!isTmapReady(api) || !mapRef.current) return;

    facilityPositionsRef.current = routeFacilities
      .filter(
        (facility) =>
          visibleFacilityKinds.includes(facility.kind),
      )
      .map((facility) => ({
        id: facility.id,
        position: new api.LatLng(
          facility.coordinate.lat,
          facility.coordinate.lng,
        ),
      }));
  }, [routeFacilities, visibleFacilityKinds]);

  const visibleFacilities = routeFacilities.filter(
    (facility) =>
      visibleFacilityKinds.includes(facility.kind),
  );

  return (
    <div className="real-map-shell">
      <div
        className="real-map"
        ref={containerRef}
        aria-label={`TMAP 지도. 출발지 ${origin.name}, 도착지 ${destination.name}`}
      />
      <svg
        className="real-map-route-overlay"
        aria-hidden="true"
        focusable="false"
      >
        <polyline ref={routeHaloRef} className="real-map-route-halo" />
        <polyline ref={routeLineRef} className="real-map-route-line" />
      </svg>
      <div className="real-map-facilities" aria-hidden="true">
        {visibleFacilities.map((facility) => (
          <span
            key={facility.id}
            ref={(element) => {
              if (element) {
                facilityElementsRef.current.set(facility.id, element);
              } else {
                facilityElementsRef.current.delete(facility.id);
              }
            }}
            className={`facility-marker ${facility.kind}`}
            title={`${facility.name} · ${facility.sourceMode === "public" ? "공식 공개 좌표" : "시연 데이터"}`}
          >
            <span aria-hidden="true">
              {facility.kind === "cctv" ? "C" : "빛"}
            </span>
          </span>
        ))}
      </div>
      <div
        ref={startEndpointRef}
        className="real-map-endpoint start"
        aria-hidden="true"
      >
        <span className="real-map-endpoint-label">
          <small>출발</small>
          <strong>{origin.name}</strong>
        </span>
        <span className="real-map-endpoint-pin">A</span>
      </div>
      <div
        ref={endEndpointRef}
        className="real-map-endpoint end"
        aria-hidden="true"
      >
        <span className="real-map-endpoint-label">
          <small>도착</small>
          <strong>{destination.name}</strong>
        </span>
        <span className="real-map-endpoint-pin">B</span>
      </div>
    </div>
  );
}

function projectPoint(
  point: Coordinate,
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
) {
  const width = bounds.maxLng - bounds.minLng || 1;
  const height = bounds.maxLat - bounds.minLat || 1;
  return {
    x: 90 + ((point.lng - bounds.minLng) / width) * 820,
    y: 650 - ((point.lat - bounds.minLat) / height) * 570,
  };
}

function DemoMap({
  origin,
  destination,
}: MapStageProps) {
  const allPoints = useMemo(
    () => [
      origin.coordinate,
      destination.coordinate,
    ],
    [destination, origin],
  );
  const bounds = useMemo(() => {
    const lats = allPoints.map((point) => point.lat);
    const lngs = allPoints.map((point) => point.lng);
    const margin = 0.0012;
    return {
      minLat: Math.min(...lats) - margin,
      maxLat: Math.max(...lats) + margin,
      minLng: Math.min(...lngs) - margin,
      maxLng: Math.max(...lngs) + margin,
    };
  }, [allPoints]);
  const start = projectPoint(origin.coordinate, bounds);
  const end = projectPoint(destination.coordinate, bounds);

  return (
    <div className="demo-map" aria-label="파일럿 데모 개념도">
      <svg viewBox="0 0 1000 720" role="img" aria-labelledby="demo-map-title">
        <title id="demo-map-title">건국대 파일럿 개념도 · 실제 지도가 아닙니다</title>
        <defs>
          <pattern id="minor-grid" width="52" height="52" patternUnits="userSpaceOnUse">
            <path d="M52 0H0V52" fill="none" stroke="#dfe3dd" strokeWidth="2" />
          </pattern>
        </defs>
        <rect width="1000" height="720" fill="#f0f2ec" />
        <rect width="1000" height="720" fill="url(#minor-grid)" opacity=".66" />
        <path className="map-park" d="M680 0h320v310l-78 45-126-42-76-102Z" />
        <path className="map-campus" d="m570 160 235 55-48 245-238-74Z" />
        <path className="map-road major" d="M-30 610 240 518 460 445 680 355 1040 245" />
        <path className="map-road" d="M130 740 235 490 342 267 460-30" />
        <path className="map-road" d="M410 740 500 530 570 350 620 100 630-30" />
        <path className="map-road" d="M-20 300 250 340 470 320 690 250 1010 180" />
        <path className="map-road small" d="M40 465 280 430 510 510 820 580 1030 560" />
        <text className="map-label" x="390" y="470">실제 지도 연결 대기</text>

        <g transform={`translate(${start.x} ${start.y})`}>
          <circle className="map-pin-ring start" r="23" />
          <circle className="map-pin start" r="15" />
          <text className="map-pin-text" textAnchor="middle" y="5">A</text>
        </g>
        <g transform={`translate(${end.x} ${end.y})`}>
          <circle className="map-pin-ring end" r="23" />
          <circle className="map-pin end" r="15" />
          <text className="map-pin-text" textAnchor="middle" y="5">B</text>
        </g>
      </svg>
      <div className="demo-ribbon">
        <span /> 데모 개념도 · 실제 경로선과 시설은 표시하지 않습니다
      </div>
      <div className="map-place-label start-label" style={{ left: `${(start.x / 1000) * 100}%`, top: `${(start.y / 720) * 100}%` }}>
        <span>출발</span>
        <strong>{origin.name}</strong>
      </div>
      <div className="map-place-label end-label" style={{ left: `${(end.x / 1000) * 100}%`, top: `${(end.y / 720) * 100}%` }}>
        <span>도착</span>
        <strong>{destination.name}</strong>
      </div>
    </div>
  );
}

export function MapStage({ onStatusChange, ...props }: MapStageProps) {
  const [sdkStatus, setSdkStatus] = useState<"loading" | "ready" | "failed">(
    "loading",
  );

  useEffect(() => {
    let active = true;

    void loadTmapSdk().then((ready) => {
      if (active) setSdkStatus(ready ? "ready" : "failed");
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    onStatusChange?.(
      sdkStatus === "ready"
        ? "tmap"
        : sdkStatus === "failed"
          ? "demo"
          : "loading",
    );
  }, [onStatusChange, sdkStatus]);

  if (sdkStatus === "failed") {
    return <DemoMap {...props} />;
  }

  return sdkStatus === "ready" ? (
    <RealTmap {...props} />
  ) : (
    <div className="map-loading">TMAP 지도를 불러오는 중입니다…</div>
  );
}
