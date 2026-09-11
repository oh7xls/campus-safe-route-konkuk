import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim();

  if (!query) {
    return NextResponse.json(
      { error: '검색어가 필요합니다.' },
      { status: 400 }
    );
  }

  const clientId = process.env.NAVER_SEARCH_CLIENT_ID;
  const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      {
        error:
          'NAVER API HUB Search 키가 설정되지 않았습니다. .env.local을 확인하세요.',
      },
      { status: 503 }
    );
  }

  try {
    const apiUrl = new URL(
      'https://naverapihub.apigw.ntruss.com/search/v1/local'
    );

    apiUrl.searchParams.set('query', query);
    apiUrl.searchParams.set('display', '5');
    apiUrl.searchParams.set('start', '1');
    apiUrl.searchParams.set('sort', 'random');
    apiUrl.searchParams.set('format', 'json');

    const naverResponse = await fetch(apiUrl, {
      headers: {
        'X-NCP-APIGW-API-KEY-ID': clientId,
        'X-NCP-APIGW-API-KEY': clientSecret,
      },
      cache: 'no-store',
    });

    const result = await naverResponse.json();

    if (!naverResponse.ok) {
      console.error('NAVER API HUB Search 오류:', {
        status: naverResponse.status,
        result,
      });

      return NextResponse.json(
        {
          error:
            result.message ??
            result.errorMessage ??
            `NAVER API HUB Search 요청에 실패했습니다. 상태 코드: ${naverResponse.status}`,
        },
        { status: naverResponse.status }
      );
    }

    return NextResponse.json({
      items: (result.items ?? []).map((item: any) => ({
        name: item.title.replace(/<[^>]*>/g, ''),
        address: item.roadAddress || item.address || '주소 정보 없음',
        mapx: item.mapx,
        mapy: item.mapy,
      })),
    });
  } catch (error) {
    console.error('NAVER API HUB 장소 검색 서버 오류:', error);

    return NextResponse.json(
      {
        error:
          'NAVER API HUB Search 서버 연결에 실패했습니다. 네트워크 또는 API 설정을 확인하세요.',
      },
      { status: 500 }
    );
  }
}
