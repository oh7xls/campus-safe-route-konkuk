import type { Place } from "@/lib/types";
import pilotArea from "@/data/pilot-area.json";

export const PILOT_AREA_LABEL = pilotArea.label;

export const PILOT_CENTER = pilotArea.center;

export const PILOT_RADIUS_METERS = pilotArea.radiusMeters;

export const PILOT_PLACES: Place[] = [
  {
    id: "konkuk-station-exit-2",
    name: "건대입구역 2번 출구",
    address: "서울 광진구 화양동 건대입구역",
    coordinate: { lat: 37.54012558, lng: 127.07045784 },
    source: "pilot",
  },
  {
    id: "konkuk-sangheo-gate",
    name: "건국대학교 상허문",
    address: "서울 광진구 능동로 120",
    // 2026-09-05 TMAP POI의 실제 출입구 좌표를 확인했습니다.
    coordinate: { lat: 37.53948681, lng: 127.07259655 },
    source: "pilot",
  },
  {
    id: "konkuk-geonguk-gate",
    name: "건국대학교 건국문",
    address: "서울 광진구 능동로 120",
    coordinate: { lat: 37.54518066, lng: 127.07656825 },
    source: "pilot",
  },
  {
    id: "konkuk-food-street",
    name: "건대맛의거리",
    address: "서울 광진구 화양동 건대맛의거리",
    coordinate: { lat: 37.54270851, lng: 127.06443054 },
    source: "pilot",
  },
  {
    id: "children-park-station-exit-3",
    name: "어린이대공원역 3번 출구",
    address: "서울 광진구 화양동 어린이대공원역",
    coordinate: { lat: 37.54704152, lng: 127.07448505 },
    source: "pilot",
  },
  {
    id: "konkuk-ilgam-gate",
    name: "건국대학교 일감문",
    address: "서울 광진구 능동로 120",
    coordinate: { lat: 37.53895912, lng: 127.07429086 },
    source: "pilot",
  },
];

export function searchPilotPlaces(query: string) {
  const normalized = query.trim().replace(/\s+/g, "").toLocaleLowerCase("ko-KR");

  if (!normalized) {
    return PILOT_PLACES.slice(0, 5);
  }

  return PILOT_PLACES.filter((place) =>
    `${place.name} ${place.address}`
      .replace(/\s+/g, "")
      .toLocaleLowerCase("ko-KR")
      .includes(normalized),
  );
}
