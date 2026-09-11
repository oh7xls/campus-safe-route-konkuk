'use client';

import { useEffect, useRef } from 'react';

export default function KakaoMap() {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    kakao.maps.load(() => {
      if (mapRef.current) {
        const options = {
          center: new kakao.maps.LatLng(37.5407, 127.0706), // 예: 세종대/광진구 중심 좌표
          level: 3,
        };
        new kakao.maps.Map(mapRef.current, options);
      }
    });
  }, []);

  return <div ref={mapRef} className="w-full h-[500px] rounded-lg shadow-md" />;
}