import type { Metadata } from "next";
import "./globals.css";
import Script from "next/script"; // 1. 카카오 스크립트 불러오기 추가

export const metadata: Metadata = {
  title: "Campus Safe Route",
  description: "광진구 안전 경로 안내 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        {children}
        
        {/* 2. body 태그 안쪽 맨 아래에 카카오 지도 SDK 스크립트 추가 */}
        <Script
  src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_API_KEY}&autoload=false&libraries=services`}
  strategy="beforeInteractive"
/>
      </body>
    </html>
  );
}