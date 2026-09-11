import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware' // 아래 함수 파일을 거쳐도 되고 직접 구현해도 됩니다.

export async function middleware(request: NextRequest) {
  // 세션 갱신 로직 처리
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}