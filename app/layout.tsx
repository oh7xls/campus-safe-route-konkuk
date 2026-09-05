import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "캠퍼스 안심길 | 시설 기반 보행 경로 MVP",
  description:
    "건국대학교와 건대입구역 주변 보행 경로 및 경로에 가까운 공공 CCTV·보안등 위치를 확인하는 MVP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
