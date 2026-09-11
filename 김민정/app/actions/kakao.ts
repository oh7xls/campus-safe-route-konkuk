'use server';

// 1. 키워드 장소 검색 함수
export async function searchPlaces(keyword: string) {
  if (!keyword.trim()) return [];

  const response = await fetch(
    `hhttps://dapi.kakao.com/v2/local/search/keyword.json`,
    {
      headers: {
        Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}`,
      },
    }
  );

  const data = await response.json();
  return data.documents || [];
}

// 2. 카카오 모빌리티 도보 경로(Directions) API 호출 함수
export async function getWalkingDirections(
  origin: { x: number; y: number }, 
  destination: { x: number; y: number }
) {
  const response = await fetch(
    `https://apis-navi.kakaomobility.com/v1/directions?origin=${origin.x},${origin.y}&destination=${destination.x},${destination.y}&priority=RECOMMEND`,
    {
      headers: {
        Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const data = await response.json();
  return data;
}