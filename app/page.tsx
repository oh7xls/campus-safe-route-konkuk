import { SafeRoutePlanner } from "@/components/safe-route-planner";
import { PILOT_AREA_LABEL, PILOT_RADIUS_METERS } from "@/lib/places";

export default function Home() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="캠퍼스 안심길 홈">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" role="img">
              <path d="M16 3 27 8v7c0 7.2-4.5 11.8-11 14-6.5-2.2-11-6.8-11-14V8l11-5Z" />
              <path d="m11.2 16 3.1 3.1 6.8-7" />
            </svg>
          </span>
          <span>
            <strong>캠퍼스 안심길</strong>
            <small>공공시설 기반 보행 경로 MVP</small>
          </span>
        </a>
        <div className="pilot-badge">
          <span aria-hidden="true" />
          {PILOT_AREA_LABEL} 반경 {(PILOT_RADIUS_METERS / 1000).toFixed(1)}km 파일럿
        </div>
      </header>

      <SafeRoutePlanner />

      <footer className="footer-note">
        <p>
          이 서비스는 현재 확인 가능한 정보를 바탕으로 경로 선택을 돕는 MVP이며,
          절대적인 안전을 보장하지 않습니다.
        </p>
        <span>2주 차 · 공공시설 레이어 및 참고지수</span>
      </footer>
    </main>
  );
}
