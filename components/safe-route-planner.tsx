"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MapStage,
  type MapStageStatus,
} from "@/components/map-stage";
import { PlaceCombobox } from "@/components/place-combobox";
import { FACILITY_LABEL } from "@/lib/route-facilities";
import { PILOT_PLACES } from "@/lib/places";
import { validateRouteRequest } from "@/lib/route-validation";
import { calculateSafetyAnalysis } from "@/lib/safety-score";
import type {
  FacilityKind,
  FacilityResponse,
  Place,
  RoutePlan,
  SafetyAnalysis,
  SafetyFacility,
} from "@/lib/types";

type RouteFailurePayload = {
  code?: string;
  message?: string;
  fallback?: RoutePlan;
};

function formatDistance(distance: number) {
  return distance >= 1_000
    ? `${(distance / 1_000).toFixed(1)}km`
    : `${distance.toLocaleString("ko-KR")}m`;
}

function formatSnapshotDate(timestamp: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeZone: "Asia/Seoul",
  }).format(new Date(timestamp));
}

function isRoutePlan(value: RoutePlan | RouteFailurePayload): value is RoutePlan {
  return "mode" in value && "points" in value;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function RouteSummary({ route }: { route: RoutePlan }) {
  const isActualRoute = route.mode === "tmap";

  return (
    <article className="route-summary" aria-live="polite">
      <div className="route-summary-heading">
        <div>
          <span className="summary-eyebrow">
            {isActualRoute ? "현재 추천" : "데모 결과"}
          </span>
          <h2>{isActualRoute ? "기본 보행 경로" : "거리·시간 추정"}</h2>
        </div>
        <span className={`source-chip ${route.mode}`}>
          {isActualRoute ? "실제 경로" : "데모 추정"}
        </span>
      </div>
      <div className="route-metrics">
        <div>
          <strong>{route.durationMinutes}</strong>
          <span>분</span>
          <small>{isActualRoute ? "예상 시간" : "예상 시간(추정)"}</small>
        </div>
        <div>
          <strong>{formatDistance(route.distanceMeters)}</strong>
          <small>{isActualRoute ? "이동 거리" : "이동 거리(추정)"}</small>
        </div>
        <div>
          <strong>{isActualRoute ? "1개" : "—"}</strong>
          <small>{isActualRoute ? "경로 후보" : "실제 경로선"}</small>
        </div>
      </div>
      <div className="route-reason">
        <span aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M12 3a7 7 0 0 0-4 12.7V20l4-2 4 2v-4.3A7 7 0 0 0 12 3Z" />
            <path d="m9.5 10.8 1.7 1.7 3.4-3.6" />
          </svg>
        </span>
        <p>
          <strong>{route.source}</strong>
          {route.notice ?? "현재 선택한 두 지점의 보행 경로를 표시합니다."}
        </p>
      </div>
    </article>
  );
}

function EmptyRouteSummary() {
  return (
    <article className="route-empty-state" aria-live="polite">
      <span className="summary-eyebrow">경로 미조회</span>
      <h2>보행 경로를 확인해 주세요</h2>
      <p>
        출발지와 목적지를 확인한 뒤 버튼을 누르면 TMAP 실제 경로를
        조회합니다. 연결할 수 없으면 거리·시간 추정값만 제공합니다.
      </p>
    </article>
  );
}

function SafetySummary({
  analysis,
  data,
  loading,
  error,
}: {
  analysis: SafetyAnalysis;
  data: FacilityResponse | null;
  loading: boolean;
  error: string | null;
}) {
  const scoreLabel = analysis.score === null ? "—" : `${analysis.score}`;

  return (
    <article className="safety-summary" aria-live="polite">
      <div className="safety-summary-heading">
        <div>
          <span className="summary-eyebrow">시설 기반 참고지수</span>
          <small
            className={`safety-data-badge ${data?.mode ?? (error ? "error" : "loading")}`}
          >
            {data?.mode === "public"
              ? `경로 주변 CCTV ${data.source.publicCctvCount}개 · 보안등 ${data.source.publicSecurityLightLocationCount.toLocaleString("ko-KR")}개`
              : data
                ? "시연 좌표 · 실제 설치 위치 아님"
                : error
                  ? "시설 데이터 연결 실패"
                  : loading
                    ? "경로 주변 시설 확인 중"
                    : "시설 데이터 대기"}
          </small>
          <h2>{analysis.label}</h2>
        </div>
        <div className="safety-score" aria-label={`참고지수 ${scoreLabel}점`}>
          <strong>{scoreLabel}</strong>
          <small>/100</small>
        </div>
      </div>

      {analysis.status === "ready" ? (
        <>
          <div className="coverage-bars">
            <div>
              <span>CCTV 영향권</span>
              <i>
                <b style={{ width: `${analysis.cctvCoveragePercent}%` }} />
              </i>
              <strong>{analysis.cctvCoveragePercent}%</strong>
            </div>
            <div>
              <span>보안등 영향권</span>
              <i>
                <b style={{ width: `${analysis.securityLightCoveragePercent}%` }} />
              </i>
              <strong>{analysis.securityLightCoveragePercent}%</strong>
            </div>
          </div>
          <ul className="safety-reasons">
            {analysis.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </>
      ) : (
        <p className="safety-placeholder">{analysis.reasons[0]}</p>
      )}

      <details className="data-details">
        <summary>데이터 출처·갱신주기·한계</summary>
        <p className="data-mode-notice">
          {data?.notice ?? error ?? "시설 데이터를 불러오는 중입니다."}
        </p>
        {data?.datasets.map((dataset) => (
          <div className="dataset-row" key={dataset.id}>
            <strong>{dataset.name}</strong>
            <span>
              {dataset.provider} · {dataset.coordinateSystem} · {dataset.updateCycle}
            </span>
            {dataset.sourceUpdatedAt ? (
              <span>원본 데이터 기준일 · {dataset.sourceUpdatedAt}</span>
            ) : null}
            <span>
              앱 스냅샷 생성일 · {formatSnapshotDate(dataset.snapshotGeneratedAt)}
            </span>
            <small>{dataset.note}</small>
            {dataset.sourceUrl ? (
              <a href={dataset.sourceUrl} target="_blank" rel="noreferrer">
                공식 출처 보기
              </a>
            ) : null}
          </div>
        ))}
        {analysis.limitations.map((limitation) => (
          <p className="analysis-limit" key={limitation}>
            {limitation}
          </p>
        ))}
      </details>
    </article>
  );
}

function FacilityLayerCard({
  data,
  routeReady,
  facilities,
  loading,
  error,
  visibleKinds,
  onToggle,
}: {
  data: FacilityResponse | null;
  routeReady: boolean;
  facilities: SafetyFacility[];
  loading: boolean;
  error: string | null;
  visibleKinds: FacilityKind[];
  onToggle: (kind: FacilityKind) => void;
}) {
  const counts = useMemo(
    () => ({
      cctv: facilities.filter((facility) => facility.kind === "cctv").length,
      "security-light": facilities.filter((facility) => facility.kind === "security-light").length,
    }),
    [facilities],
  );

  return (
    <section className="facility-layer-card" aria-label="시설 레이어 설정">
      <div className="facility-layer-heading">
        <div>
          <span>ON YOUR ROUTE</span>
          <strong>{routeReady ? "이 경로 주변 시설" : "경로를 먼저 조회해 주세요"}</strong>
        </div>
        <em>
          {routeReady ? "경로 주변만 표시" : "시설 표시 대기"}
        </em>
      </div>
      {routeReady ? <div className="facility-layer-toggles">
        {(["cctv", "security-light"] as const).map((kind) => (
          <button
            key={kind}
            className={kind}
            type="button"
            aria-pressed={visibleKinds.includes(kind)}
            onClick={() => onToggle(kind)}
          >
            <i aria-hidden="true">{kind === "cctv" ? "C" : "빛"}</i>
            {FACILITY_LABEL[kind]}{kind === "security-light" ? " 좌표" : ""}{" "}
            {counts[kind].toLocaleString("ko-KR")}개
          </button>
        ))}
      </div> : null}
      <small className={`catalog-status ${data?.source.status ?? "loading"}`}>
        {loading
          ? "시설 데이터를 불러오는 중입니다."
          : error
            ? error
            : routeReady
              ? "경로선에서 CCTV 70m · 보안등 35m 이내 위치만 표시합니다. 실제 촬영·조명 범위는 아닙니다."
              : "실제 보행 경로를 조회하면, 해당 경로에 가까운 CCTV·보안등만 나타납니다."}
      </small>
    </section>
  );
}

const MAP_STATUS_LABEL: Record<MapStageStatus, string> = {
  loading: "TMAP 지도 연결 중",
  tmap: "TMAP 지도 연결됨",
  demo: "데모 지도 모드",
};

export function SafeRoutePlanner() {
  const [origin, setOrigin] = useState<Place>(PILOT_PLACES[0]);
  const [destination, setDestination] = useState<Place>(PILOT_PLACES[2]);
  const [originConfirmed, setOriginConfirmed] = useState(true);
  const [destinationConfirmed, setDestinationConfirmed] = useState(true);
  const [selectionRevision, setSelectionRevision] = useState(0);
  const [route, setRoute] = useState<RoutePlan | null>(null);
  const [mapStatus, setMapStatus] = useState<MapStageStatus>("loading");
  const [facilityData, setFacilityData] = useState<FacilityResponse | null>(
    null,
  );
  const [facilityError, setFacilityError] = useState<string | null>(null);
  const [facilityLoading, setFacilityLoading] = useState(false);
  const [visibleFacilityKinds, setVisibleFacilityKinds] = useState<
    FacilityKind[]
  >(["cctv", "security-light"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const routeControllerRef = useRef<AbortController | null>(null);
  const routeRequestIdRef = useRef(0);
  const facilityRequestIdRef = useRef(0);

  const routeValidation = validateRouteRequest({ origin, destination });
  const selectionsConfirmed = originConfirmed && destinationConfirmed;
  const canRequestRoute = selectionsConfirmed && routeValidation.ok && !loading;
  const safetyAnalysis = useMemo(
    () =>
      calculateSafetyAnalysis(
        route,
        facilityData?.facilities ?? [],
        undefined,
        facilityData?.coverageArea,
      ),
    [facilityData, route],
  );
  const routeFacilities =
    route?.mode === "tmap" ? (facilityData?.facilities ?? []) : [];
  const routeMapReady = route?.mode === "tmap" && route.points.length >= 2 && mapStatus === "tmap";
  const hasPublicCctv =
    routeFacilities.some(
      (facility) => facility.kind === "cctv" && facility.sourceMode === "public",
    ) ?? false;
  const hasPublicSecurityLights =
    routeFacilities.some(
      (facility) =>
        facility.kind === "security-light" && facility.sourceMode === "public",
    ) ?? false;

  const cancelRouteRequest = useCallback(() => {
    routeRequestIdRef.current += 1;
    routeControllerRef.current?.abort();
    routeControllerRef.current = null;
    setLoading(false);
  }, []);

  useEffect(() => {
    return () => {
      routeRequestIdRef.current += 1;
      routeControllerRef.current?.abort();
      routeControllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (route?.mode !== "tmap") {
      return;
    }

    const controller = new AbortController();
    const routePoints = route.points;
    const requestId = facilityRequestIdRef.current + 1;
    facilityRequestIdRef.current = requestId;

    async function loadFacilities() {
      try {
        const response = await fetch("/api/facilities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ points: routePoints }),
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("시설 데이터를 불러오지 못했습니다.");
        }

        const payload = (await response.json()) as FacilityResponse;
        if (requestId !== facilityRequestIdRef.current) return;
        setFacilityData(payload);
        setFacilityError(null);
      } catch (loadError) {
        if (
          isAbortError(loadError) ||
          requestId !== facilityRequestIdRef.current
        ) {
          return;
        }
        setFacilityError(
          loadError instanceof Error
            ? loadError.message
            : "시설 데이터를 불러오지 못했습니다.",
        );
      } finally {
        if (
          !controller.signal.aborted &&
          requestId === facilityRequestIdRef.current
        ) {
          setFacilityLoading(false);
        }
      }
    }

    void loadFacilities();
    return () => {
      controller.abort();
      if (requestId === facilityRequestIdRef.current) {
        facilityRequestIdRef.current += 1;
      }
    };
  }, [route]);

  function toggleFacilityKind(kind: FacilityKind) {
    setVisibleFacilityKinds((current) =>
      current.includes(kind)
        ? current.filter((candidate) => candidate !== kind)
        : [...current, kind],
    );
  }

  const requestRoute = useCallback(async () => {
    if (!originConfirmed || !destinationConfirmed) {
      setError("출발지와 목적지를 검색 제안에서 선택해 주세요.");
      return;
    }

    const validation = validateRouteRequest({ origin, destination });
    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    routeControllerRef.current?.abort();
    const controller = new AbortController();
    const requestId = routeRequestIdRef.current + 1;
    routeRequestIdRef.current = requestId;
    routeControllerRef.current = controller;

    setLoading(true);
    setRoute(null);
    setFacilityData(null);
    setError(null);
    setFacilityLoading(false);
    setFacilityError(null);

    try {
      const response = await fetch("/api/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.value),
        signal: controller.signal,
      });
      const payload = (await response.json()) as RoutePlan | RouteFailurePayload;

      if (requestId !== routeRequestIdRef.current) {
        return;
      }

      if (!response.ok) {
        if (!isRoutePlan(payload) && payload.fallback) {
          setRoute(payload.fallback);
        }

        const message = isRoutePlan(payload)
          ? "경로를 불러오지 못했습니다."
          : (payload.message ?? "경로를 불러오지 못했습니다.");
        throw new Error(message);
      }

      if (!isRoutePlan(payload)) {
        throw new Error("경로 응답 형식을 확인할 수 없습니다.");
      }

      if (payload.mode === "tmap") {
        setFacilityLoading(true);
      }
      setRoute(payload);
    } catch (requestError) {
      if (isAbortError(requestError) || requestId !== routeRequestIdRef.current) {
        return;
      }

      setError(
        requestError instanceof Error
          ? requestError.message
          : "경로를 불러오지 못했습니다.",
      );
    } finally {
      if (requestId === routeRequestIdRef.current) {
        if (routeControllerRef.current === controller) {
          routeControllerRef.current = null;
        }
        setLoading(false);
      }
    }
  }, [destination, destinationConfirmed, origin, originConfirmed]);

  const invalidateRouteForEditing = useCallback(() => {
    cancelRouteRequest();
    setRoute(null);
    setFacilityData(null);
    setError(null);
    setFacilityLoading(false);
  }, [cancelRouteRequest]);

  const handleOriginSelectionState = useCallback(
    (confirmed: boolean) => {
      setOriginConfirmed(confirmed);
      if (!confirmed) {
        invalidateRouteForEditing();
      }
    },
    [invalidateRouteForEditing],
  );

  const handleDestinationSelectionState = useCallback(
    (confirmed: boolean) => {
      setDestinationConfirmed(confirmed);
      if (!confirmed) {
        invalidateRouteForEditing();
      }
    },
    [invalidateRouteForEditing],
  );

  function choosePlaces(nextOrigin: Place, nextDestination: Place) {
    cancelRouteRequest();
    setSelectionRevision((current) => current + 1);
    setOrigin(nextOrigin);
    setDestination(nextDestination);
    setOriginConfirmed(true);
    setDestinationConfirmed(true);
    setRoute(null);
    setFacilityData(null);
    setError(null);
    setFacilityLoading(false);
  }

  function swapPlaces() {
    choosePlaces(destination, origin);
  }

  const formMessage = !selectionsConfirmed
    ? "입력한 장소를 검색 제안에서 확정해 주세요."
    : !routeValidation.ok
      ? routeValidation.message
      : null;

  return (
    <section className="planner-layout" id="top">
      <aside className="route-panel">
        <div className="panel-intro">
          <span className="week-label">WEEK 02 · PUBLIC DATA LAYER</span>
          <h1>
            오늘 귀갓길,
            <br />먼저 확인해 보세요.
          </h1>
          <p>건국대와 건대입구역 주변, 내 경로에 필요한 시설만 확인하세요.</p>
        </div>

        <div className="route-form">
          <div className="field-connector" aria-hidden="true" />
          <PlaceCombobox
            key={`origin-${selectionRevision}`}
            label="출발지"
            marker="start"
            value={origin}
            onSelectionStateChange={handleOriginSelectionState}
            onChange={(place) => {
              cancelRouteRequest();
              setOrigin(place);
              setRoute(null);
              setError(null);
            }}
          />
          <button
            className="swap-button"
            type="button"
            onClick={swapPlaces}
            aria-label="출발지와 목적지 바꾸기"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m8 7 3-3 3 3M11 4v13M16 17l-3 3-3-3m3 3V7" />
            </svg>
          </button>
          <PlaceCombobox
            key={`destination-${selectionRevision}`}
            label="목적지"
            marker="end"
            value={destination}
            onSelectionStateChange={handleDestinationSelectionState}
            onChange={(place) => {
              cancelRouteRequest();
              setDestination(place);
              setRoute(null);
              setError(null);
            }}
          />

          <div className="quick-routes">
            <span>빠른 선택</span>
            <button
              type="button"
              onClick={() => choosePlaces(PILOT_PLACES[0], PILOT_PLACES[2])}
            >
              건대입구역 → 건국문
            </button>
            <button
              type="button"
              onClick={() => choosePlaces(PILOT_PLACES[3], PILOT_PLACES[2])}
            >
              맛의거리 → 건국문
            </button>
          </div>

          <button
            type="button"
            className="route-button"
            onClick={() => void requestRoute()}
            disabled={!canRequestRoute}
          >
            {loading ? <span className="button-spinner" /> : null}
            {loading ? "경로를 찾는 중…" : "보행 경로 확인하기"}
          </button>
          {formMessage ? <p className="form-message">{formMessage}</p> : null}
          {error ? <p className="form-message error">{error}</p> : null}
        </div>

        {route ? <RouteSummary route={route} /> : <EmptyRouteSummary />}
        {route?.mode === "tmap" ? (
          <SafetySummary
            analysis={safetyAnalysis}
            data={facilityData}
            loading={facilityLoading}
            error={facilityError}
          />
        ) : null}
      </aside>

      <div className="map-panel">
        <MapStage
          origin={origin}
          destination={destination}
          route={route}
          facilities={routeFacilities}
          visibleFacilityKinds={visibleFacilityKinds}
          onStatusChange={setMapStatus}
        />
        <div className="map-top-controls">
          <div className={`live-status ${mapStatus}`}>
            <span aria-hidden="true" />
            {MAP_STATUS_LABEL[mapStatus]}
          </div>
          <div className="location-control">
            <button
              className="location-button"
              type="button"
              disabled
              aria-describedby="location-help"
              title="현재 위치는 다음 단계에서 지원합니다."
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
              </svg>
              현재 위치
            </button>
            <small id="location-help">현재 위치는 다음 단계에서 지원합니다.</small>
          </div>
        </div>
        {route?.mode === "demo" ? (
          <div className="map-demo-notice" role="status">
            데모 추정값 · 실제 보행 경로선은 표시하지 않습니다
          </div>
        ) : mapStatus === "demo" && route?.mode === "tmap" ? (
          <div className="map-demo-notice" role="status">
            실제 경로 정보는 조회됐지만 지도 SDK를 불러오지 못해 경로선은 표시하지 않습니다
          </div>
        ) : null}
        <div className="map-legend" aria-label="지도 범례">
          <div>
            <span className="legend-endpoint start">A</span>
            출발지
          </div>
          <div>
            <span className="legend-endpoint end">B</span>
            도착지
          </div>
          {route?.mode === "tmap" && mapStatus === "tmap" ? (
            <div>
              <span className="legend-route" />
              선택된 보행 경로
            </div>
          ) : null}
          <div>
            <span className="legend-pilot" />
            MVP 대상 지역
          </div>
          {routeMapReady && hasPublicCctv && visibleFacilityKinds.includes("cctv") ? (
            <div>
              <span className="legend-facility cctv">C</span>
              CCTV · {hasPublicCctv ? "공식 공개 좌표" : "시연 좌표"}
            </div>
          ) : null}
          {routeMapReady && hasPublicSecurityLights && visibleFacilityKinds.includes("security-light") ? (
            <div>
              <span className="legend-facility security-light">빛</span>
              보안등 · {hasPublicSecurityLights ? "공식 공개 좌표" : "시연 좌표"}
            </div>
          ) : null}
        </div>
        <FacilityLayerCard
          data={facilityData}
          routeReady={routeMapReady}
          facilities={routeFacilities}
          loading={facilityLoading}
          error={facilityError}
          visibleKinds={visibleFacilityKinds}
          onToggle={toggleFacilityKind}
        />
      </div>
    </section>
  );
}
