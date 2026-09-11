import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('클라이언트에서 받은 원본 데이터:', body);

    const originX = body.start?.lng ?? body.origin?.x ?? body.startX;
    const originY = body.start?.lat ?? body.origin?.y ?? body.startY;
    const destX = body.end?.lng ?? body.destination?.x ?? body.endX;
    const destY = body.end?.lat ?? body.destination?.y ?? body.endY;

    if (!originX || !originY || !destX || !destY) {
      return NextResponse.json(
        { error: '좌표 추출 실패: start/end 또는 lng/lat 값이 누락되었습니다.', receivedBody: body },
        { status: 400 }
      );
    }

    // 💡 1. 쿼리 파라미터 생성 (GET 요청용)
    const queryParams = new URLSearchParams({
      origin: `${originX},${originY}`,
      destination: `${destX},${destY}`,
      priority: 'RECOMMEND'
    });

    const url = `https://apis-navi.kakaomobility.com/v1/directions?${queryParams.toString()}`;

    // 💡 2. POST 대신 GET으로 요청 & body 삭제
    const response = await fetch(url, {
      method: 'GET', 
      headers: {
        'Authorization': `KakaoAK ${process.env.KAKAO_REST_API_KEY}`,
        'Content-Type': 'application/json',
        // REST API 키를 정확히 입력했다면 아래 헤더들은 굳이 넣지 않아도 됩니다.
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('카카오 모빌리티 API 오류 응답:', data);
      return NextResponse.json({ error: '카카오 길찾기 API 호출 실패', details: data }, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('서버 내부 에러:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}