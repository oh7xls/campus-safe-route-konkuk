'use client';

import { useCallback, useMemo, useState } from 'react';
import SafeMap from '@/components/SafeMap';
import PlaceSearchInput, {
  type PlacePoint,
} from '@/components/PlaceSearchInput';
import facilitiesData from '@/data/facilities-konkuk-pilot.json';

type Facility = {
  id: string;
  type: '보행등';
  name: string;
  lat: number;
  lng: number;
  quantity: number;
  source: string;
  source_updated_at: string;
};

const facilities = facilitiesData as Facility[];

/*
  건대입구역 중심점입니다.
  파일럿 범위 검증과 기본 화면 위치에 사용합니다.
*/
const KONKUK_STATION = {
  name: '건대입구역',
  lat: 37.54037,
  lng: 127.06935,
};

const presets = {
  start: {
    name: '건대입구역',
    lat: 37.54037,
    lng: 127.06935,
  },
  end: {
    name: '건국대학교 서울캠퍼스 정문',
    lat: 37.54341,
    lng: 127.07646,
  },
};

/**
 * 두 위도·경도 지점 사이의 직선거리(m)를 계산합니다.
 * 실제 보행거리가 아니라, 시설과 경로의 인접성 계산에만 사용합니다.
 */
function distanceInMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
) {
  const earthRadius = 6_371_000;
  const radians = Math.PI / 180;

  const x =
    (b.lng - a.lng) *
    radians *
    Math.cos(((a.lat + b.lat) / 2) * radians);

  const y = (b.lat - a.lat) * radians;

  return Math.sqrt(x * x + y * y) * earthRadius;
}

/**
 * TMAP 경로 좌표는 [경도, 위도] 순서입니다.
 * 경로의 좌표 중 하나에서 45m 이내인 보행등 위치를 찾습니다.
 */
function getFacilitiesNearRoute(
  routeCoordinates: number[][],
  allFacilities: Facility[],
  radiusMeters = 45
) {
  return allFacilities.filter((facility) =>
    routeCoordinates.some(([lng, lat]) => {
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        return false;
      }

      return (
        distanceInMeters(
          { lat: facility.lat, lng: facility.lng },
          { lat, lng }
        ) <= radiusMeters
      );
    })
  );
}

export default function Page() {
  const [start, setStart] = useState<PlacePoint | null>(presets.start);
  const [end, setEnd] = useState<PlacePoint | null>(presets.end);

  const [line, setLine] = useState<number[][]>([]);

  const [routeInfo, setRouteInfo] = useState<{
    distance: number;
    duration: number;
    source: string;
  } | null>(null);

  const [notice, setNotice] = useState(
    '출발지와 목적지를 선택한 뒤 실제 보행 경로를 조회하세요.'
  );

  const [isRouteLoading, setIsRouteLoading] = useState(false);

  const [selectedReportLocation, setSelectedReportLocation] =
    useState<{ lng: number; lat: number } | null>(null);

  /*
    실제 TMAP 경로가 조회된 후에만,
    보행등 위치 230곳 중 경로 45m 이내 위치를 계산합니다.
  */
  const facilitiesNearRoute = useMemo(() => {
    if (line.length < 2) {
      return [];
    }

    return getFacilitiesNearRoute(line, facilities, 45);
  }, [line]);

  /*
    원본 데이터의 각 행을 보행등 위치 1곳으로 취급합니다.
    quantity는 현재 모두 1입니다.
  */
  const pedestrianLightCount = useMemo(() => {
    return facilitiesNearRoute.reduce(
      (sum, facility) => sum + facility.quantity,
      0
    );
  }, [facilitiesNearRoute]);

  const handleRouteRequest = async () => {
    if (isRouteLoading) {
      return;
    }

    if (!start || !end) {
      setNotice(
        '출발지와 목적지의 검색 결과를 각각 하나씩 선택한 뒤 경로를 조회하세요.'
      );
      return;
    }

    setIsRouteLoading(true);
    // 💡 TMAP 텍스트를 카카오로 변경
    setNotice('카카오 길찾기 경로를 조회 중입니다.');

    try {
      const response = await fetch('/api/route', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ start, end }),
      });

      const result = await response.json();

      if (!response.ok) {
        setNotice(
          result.error ??
            '경로를 가져오지 못했습니다. 잠시 후 다시 시도하세요.'
        );
        return;
      }

      // 💡 카카오 API 응답 구조에서 데이터 추출
      const routeData = result.routes?.[0];
      if (!routeData) {
        setNotice('경로를 찾을 수 없습니다.');
        return;
      }

      // 💡 카카오의 1차원 배열(vertexes)을 [경도, 위도] 형태의 2차원 배열로 변환
      const parsedCoordinates: number[][] = [];
      routeData.sections.forEach((section: any) => {
        section.roads.forEach((road: any) => {
          const vertexes = road.vertexes;
          for (let i = 0; i < vertexes.length; i += 2) {
            parsedCoordinates.push([vertexes[i], vertexes[i + 1]]);
          }
        });
      });

      if (parsedCoordinates.length < 2) {
        setNotice('유효한 경로 좌표를 받지 못했습니다.');
        return;
      }

      // 💡 지도에 선을 그리기 위해 변환한 좌표 세팅
      setLine(parsedCoordinates);

      // 💡 거리(m)와 시간(초) 세팅
      setRouteInfo({
        distance: routeData.summary.distance,
        duration: routeData.summary.duration,
        source: '카카오 모빌리티 (자동차 기준)',
      });

      setNotice(
        '카카오 길찾기 경로를 표시했습니다. 경로 주변 보행등 위치를 함께 계산합니다.'
      );
    } catch {
      setNotice(
        '경로 조회 중 네트워크 오류가 발생했습니다. 인터넷 연결을 확인하세요.'
      );
    } finally {
      setIsRouteLoading(false);
    }
  };

  const handleMapPick = useCallback((point: { lng: number; lat: number }) => {
    setSelectedReportLocation(point);

    setNotice(
      `제보 위치 선택: ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`
    );
  }, []);

  const handleReport = async () => {
    if (!selectedReportLocation) {
      setNotice('지도에서 제보 위치를 먼저 선택하세요.');
      return;
    }

    const description = window.prompt('제보 내용을 입력하세요.');

    if (!description) {
      return;
    }

    const type = window.prompt(
      '제보 유형: 가로등 고장 / 공사 중 / 통행 불가 / 어두운 구간 / 시설물 파손',
      '가로등 고장'
    );

    if (!type) {
      return;
    }

    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...selectedReportLocation,
          type,
          description,
        }),
      });

      if (!response.ok) {
        setNotice('제보 등록에 실패했습니다.');
        return;
      }

      setNotice(
        '제보가 등록되었습니다. 현재 MVP에서는 확인 필요 상태로 처리됩니다.'
      );
    } catch {
      setNotice('제보 등록 중 네트워크 오류가 발생했습니다.');
    }
  };

  const swapStartAndEnd = () => {
    if (!start || !end) {
      setNotice('출발지와 목적지의 검색 결과를 먼저 선택하세요.');
      return;
    }

    setStart(end);
    setEnd(start);
    setLine([]);
    setRouteInfo(null);

    setNotice(
      '출발지와 목적지를 바꿨습니다. 실제 보행 경로를 다시 조회하세요.'
    );
  };

  return (
    <main>
      <header>
        <div>
          <b>캠퍼스 안심길</b>
          <span>건대입구역 반경 1.5km 파일럿</span>
        </div>

        <small>
          현재 확인 가능한 정보 기준 안내 · 절대적 안전을 보장하지 않습니다.
        </small>
      </header>

      <section className="controls">
        <PlaceSearchInput
          label="출발지"
          value={start}
          onSelect={(point) => {
            setStart(point);
            setLine([]);
            setRouteInfo(null);
            setNotice(`출발지 선택: ${point.name}`);
          }}
          onClearSelection={() => {
            setStart(null);
            setLine([]);
            setRouteInfo(null);
          }}
        />

        <button
          type="button"
          onClick={swapStartAndEnd}
          aria-label="출발지와 목적지 교환"
        >
          ⇄
        </button>

        <PlaceSearchInput
          label="목적지"
          value={end}
          onSelect={(point) => {
            setEnd(point);
            setLine([]);
            setRouteInfo(null);
            setNotice(`목적지 선택: ${point.name}`);
          }}
          onClearSelection={() => {
            setEnd(null);
            setLine([]);
            setRouteInfo(null);
          }}
        />

        <button
          type="button"
          className="primary"
          onClick={handleRouteRequest}
          disabled={isRouteLoading}
        >
          {isRouteLoading ? '경로 조회 중…' : '실제 보행 경로'}
        </button>
      </section>

      <p className="notice">{notice}</p>

      <SafeMap
        line={line}
        facilities={facilitiesNearRoute}
        onPick={handleMapPick}
      />

      <section className="grid">
        <article>
          <h2>경로 정보</h2>

          {routeInfo ? (
            <>
              <strong>
                {(routeInfo.distance / 1000).toFixed(1)} km · 약{' '}
                {Math.ceil(routeInfo.duration / 60)}분
              </strong>
              <p>경로 출처: {routeInfo.source}</p>
            </>
          ) : (
            <p>
              TMAP 실제 보행 경로를 조회하면 거리와 예상 시간을 표시합니다.
            </p>
          )}
        </article>

        <article>
          <h2>경로 주변 보행등</h2>

          {routeInfo ? (
            <>
              <strong>
                경로 45m 이내 등록 보행등 위치: {pedestrianLightCount}곳
              </strong>

              <p>
                지도에는 현재 조회한 보행 경로 주변의 등록 보행등 위치만
                표시합니다.
              </p>

              <p className="muted">
                출처: 서울특별시 보행등 위치정보 현황
                <br />
                원천 파일 기준일: 2026-02-13
              </p>

              <p className="muted">
                보행등 위치 정보는 현재 확인 가능한 공공시설 정보이며, 특정
                경로의 안전을 보장하거나 범죄를 예측하지 않습니다.
              </p>
            </>
          ) : (
            <p>
              경로 조회 후, 경로 45m 이내에 등록된 보행등 위치 수를
              계산합니다.
            </p>
          )}
        </article>

        <article>
          <h2>현장 제보</h2>

          <p>지도 클릭 → 위치 선택 → 제보 등록</p>

          <button type="button" onClick={handleReport}>
            제보 등록
          </button>

          <p className="muted">
            사진 업로드, EXIF 삭제, 개인정보 블러, AI 중복 판정, 실시간
            저장은 다음 단계에서 연결합니다.
          </p>
        </article>
      </section>

      <section className="data-note">
        <h2>데이터 기준과 한계</h2>
        <ul>
          <li>
            파일럿 범위는 건대입구역 중심점 기준 직선거리 반경 1.5km입니다.
          </li>
          <li>
            경로 주변 보행등은 TMAP 경로 좌표에서 직선거리 45m 이내인 위치를
            계산한 결과입니다.
          </li>
          <li>
            스마트 조명 상태 CSV에는 위치 정보가 없어, 현재 지도 및 경로
            계산에는 반영하지 않습니다.
          </li>
        </ul>
      </section>
    </main>
  );
}
