'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    naver?: any;
  }
}

type PickPoint = {
  lng: number;
  lat: number;
};

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

export default function SafeMap({
  line,
  facilities,
  onPick,
}: {
  line: number[][];
  facilities: Facility[];
  onPick: (point: PickPoint) => void;
}) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  const routeOverlayRef = useRef<any>(null);
  const facilityMarkersRef = useRef<any[]>([]);

  const [mapReady, setMapReady] = useState(false);

  /*
    네이버 지도 SDK를 불러오고, 건대입구역을 중심으로 지도를 생성합니다.
  */
  useEffect(() => {
    const initializeMap = () => {
      if (
        !mapElementRef.current ||
        mapRef.current ||
        !window.naver?.maps?.Map
      ) {
        return;
      }

      mapRef.current = new window.naver.maps.Map(mapElementRef.current, {
        center: new window.naver.maps.LatLng(37.54037, 127.06935),
        zoom: 15,
      });

      window.naver.maps.Event.addListener(
        mapRef.current,
        'click',
        (event: any) => {
          onPick({
            lat: event.coord.lat(),
            lng: event.coord.lng(),
          });
        }
      );

      setMapReady(true);
    };

    if (window.naver?.maps?.Map) {
      initializeMap();
      return;
    }

    const existingScript = document.getElementById('naver-map-sdk');

    if (existingScript) {
      existingScript.addEventListener('load', initializeMap);

      return () => {
        existingScript.removeEventListener('load', initializeMap);
      };
    }

    const script = document.createElement('script');

    script.id = 'naver-map-sdk';
    script.async = true;

    /*
      최신 네이버 지도 인증 방식:
      ncpKeyId 사용

      .env.local:
      NEXT_PUBLIC_NAVER_MAP_CLIENT_ID=네이버_지도_Key_ID
    */
    script.src =
      'https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=' +
      process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;

    script.addEventListener('load', initializeMap);

    script.addEventListener('error', () => {
      console.error('네이버 지도 SDK를 불러오지 못했습니다.');
    });

    document.head.appendChild(script);

    return () => {
      script.removeEventListener('load', initializeMap);
    };
  }, [onPick]);

  /*
    TMAP 실제 보행 경로를 파란 선으로 표시합니다.
  */
  useEffect(() => {
    if (
      !mapReady ||
      !mapRef.current ||
      !window.naver?.maps?.Polyline ||
      !window.naver?.maps?.LatLng
    ) {
      return;
    }

    if (routeOverlayRef.current) {
      routeOverlayRef.current.setMap(null);
      routeOverlayRef.current = null;
    }

    if (line.length < 2) {
      return;
    }

    const path = line
      .filter(
        (coordinate) =>
          Array.isArray(coordinate) &&
          coordinate.length >= 2 &&
          Number.isFinite(coordinate[0]) &&
          Number.isFinite(coordinate[1])
      )
      .map(([lng, lat]) => new window.naver.maps.LatLng(lat, lng));

    if (path.length < 2) {
      return;
    }

    const polyline = new window.naver.maps.Polyline({
      map: mapRef.current,
      path,
      strokeColor: '#1d4ed8',
      strokeWeight: 6,
      strokeOpacity: 0.85,
    });

    routeOverlayRef.current = polyline;

    if (polyline.getBounds) {
      mapRef.current.fitBounds(polyline.getBounds());
    }
  }, [line, mapReady]);

  /*
    경로 45m 이내 보행등 위치를 지도에 표시합니다.
  */
  useEffect(() => {
    if (
      !mapReady ||
      !mapRef.current ||
      !window.naver?.maps?.Marker ||
      !window.naver?.maps?.LatLng
    ) {
      return;
    }

    facilityMarkersRef.current.forEach((marker) => {
      marker.setMap(null);
    });

    facilityMarkersRef.current = [];

    const markers = facilities.map((facility) => {
      const marker = new window.naver.maps.Marker({
        map: mapRef.current,
        position: new window.naver.maps.LatLng(facility.lat, facility.lng),
        title: `보행등: ${facility.name}`,
      });

      const infoWindow = new window.naver.maps.InfoWindow({
        content: `
          <div style="
            width: 230px;
            padding: 12px;
            font-family: Arial, 'Nanum Gothic', sans-serif;
            font-size: 13px;
            line-height: 1.55;
          ">
            <strong style="color:#8a5a00;">보행등 위치</strong><br />
            ${facility.name}<br />
            <span style="color:#66758a;">
              출처: 서울특별시 보행등 위치정보 현황<br />
              원천 파일 기준일: ${facility.source_updated_at}
            </span>
          </div>
        `,
      });

      window.naver.maps.Event.addListener(marker, 'click', () => {
        infoWindow.open(mapRef.current, marker);
      });

      return marker;
    });

    facilityMarkersRef.current = markers;

    return () => {
      markers.forEach((marker) => {
        marker.setMap(null);
      });
    };
  }, [facilities, mapReady]);

  return (
    <div
      ref={mapElementRef}
      className="map"
      aria-label="건대입구역 주변 네이버 지도. 클릭하여 제보 위치를 선택할 수 있습니다."
    />
  );
}
