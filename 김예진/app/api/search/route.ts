import { NextRequest, NextResponse } from "next/server";
import { distanceMeters } from "@/lib/geo";
import {
  PILOT_CENTER,
  PILOT_RADIUS_METERS,
  searchPilotPlaces,
} from "@/lib/places";
import type { Place, SearchResponse } from "@/lib/types";

type TmapPoi = {
  id?: string;
  name?: string;
  frontLat?: string;
  frontLon?: string;
  noorLat?: string;
  noorLon?: string;
  upperAddrName?: string;
  middleAddrName?: string;
  lowerAddrName?: string;
  detailAddrName?: string;
};

type TmapSearchPayload = {
  searchPoiInfo?: {
    pois?: {
      poi?: TmapPoi[];
    };
  };
};

const SAME_PLACE_RADIUS_METERS = 12;

function normalizePlaceName(name: string) {
  return name.replace(/\s+/g, "").toLocaleLowerCase("ko-KR");
}

function isSamePlace(left: Place, right: Place) {
  return (
    normalizePlaceName(left.name) === normalizePlaceName(right.name) ||
    distanceMeters(left.coordinate, right.coordinate) <=
      SAME_PLACE_RADIUS_METERS
  );
}

function parseTmapPlaces(payload: TmapSearchPayload): Place[] {
  const pois = payload.searchPoiInfo?.pois?.poi ?? [];

  return pois.reduce<Place[]>((places, poi) => {
    const lat = Number(poi.frontLat ?? poi.noorLat);
    const lng = Number(poi.frontLon ?? poi.noorLon);

    if (!poi.name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return places;
    }

    const coordinate = { lat, lng };
    if (distanceMeters(PILOT_CENTER, coordinate) > PILOT_RADIUS_METERS) {
      return places;
    }

    const place: Place = {
      // TMAP은 서로 다른 출입구에 같은 POI id를 주기도 하므로 좌표를 포함해
      // React key와 선택 상태에서 항상 고유한 id를 사용합니다.
      id: `tmap-${poi.id ?? "poi"}-${lat.toFixed(7)}-${lng.toFixed(7)}`,
      name: poi.name,
      address: [
        poi.upperAddrName,
        poi.middleAddrName,
        poi.lowerAddrName,
        poi.detailAddrName,
      ]
        .filter(Boolean)
        .join(" "),
      coordinate,
      source: "tmap",
    };

    if (!places.some((existing) => isSamePlace(existing, place))) {
      places.push(place);
    }

    return places;
  }, []);
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const pilotPlaces = searchPilotPlaces(query);
  const appKey = process.env.TMAP_API_KEY;

  if (!appKey || query.length < 2) {
    const response: SearchResponse = {
      places: pilotPlaces,
      mode: "pilot",
      notice: appKey
        ? undefined
        : "TMAP 키가 없어 파일럿 장소만 검색합니다.",
    };
    return NextResponse.json(response);
  }

  try {
    const url = new URL("https://apis.openapi.sk.com/tmap/pois");
    url.searchParams.set("version", "1");
    url.searchParams.set("format", "json");
    url.searchParams.set("searchKeyword", query);
    url.searchParams.set("resCoordType", "WGS84GEO");
    url.searchParams.set("reqCoordType", "WGS84GEO");
    url.searchParams.set("count", "12");

    const result = await fetch(url, {
      headers: { appKey },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });

    if (!result.ok) {
      throw new Error(`TMAP search returned ${result.status}`);
    }

    const tmapPlaces = parseTmapPlaces(
      (await result.json()) as TmapSearchPayload,
    );
    const places = [
      ...pilotPlaces,
      ...tmapPlaces.filter(
        (place) => !pilotPlaces.some((pilot) => isSamePlace(pilot, place)),
      ),
    ].slice(0, 8);

    const response: SearchResponse = { places, mode: "tmap" };
    return NextResponse.json(response);
  } catch {
    const response: SearchResponse = {
      places: pilotPlaces,
      mode: "pilot",
      notice: "TMAP 검색에 연결하지 못해 파일럿 장소를 표시합니다.",
    };
    return NextResponse.json(response);
  }
}
