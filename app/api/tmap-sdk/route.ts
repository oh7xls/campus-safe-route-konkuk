const JAVASCRIPT_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/javascript; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

function scriptResponse(source: string) {
  return new Response(source, { status: 200, headers: JAVASCRIPT_HEADERS });
}

function failedLoader(reason: string) {
  return scriptResponse(`window.dispatchEvent(new CustomEvent("tmap-sdk-failed", {
  detail: { reason: ${JSON.stringify(reason)} }
}));`);
}

export const dynamic = "force-dynamic";

export async function GET() {
  const appKey = process.env.TMAP_API_KEY;

  if (!appKey) {
    return failedLoader("missing-key");
  }

  try {
    const response = await fetch(
      `https://apis.openapi.sk.com/tmap/vectorjs?version=1&appKey=${encodeURIComponent(appKey)}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!response.ok) {
      return failedLoader(`upstream-${response.status}`);
    }

    const upstreamLoader = await response.text();
    const sdkFile = upstreamLoader.match(
      /["'](tmapjs3\.min\.js\?version=\d+)["']/,
    )?.[1];
    const styleFile = upstreamLoader.match(/["'](vsm\.css)["']/)?.[1];

    if (!sdkFile || !styleFile) {
      return failedLoader("unexpected-loader-format");
    }

    const loader = `(() => {
  const dispatchFailed = (reason) => {
    window.dispatchEvent(new CustomEvent("tmap-sdk-failed", { detail: { reason } }));
  };

  if (window.Tmapv3) {
    window.dispatchEvent(new Event("tmap-sdk-ready"));
    return;
  }

  const shard = Math.floor(Math.random() * 3) + 1;
  const base = "https://toptmaptile" + shard + ".tmap.co.kr/scriptSDKV3/";
  window.Tmapvector = {
    _getScriptLocation: () => base,
    VERSION_NUMBER: Math.random(),
  };

  if (!document.getElementById("tmap-vector-style")) {
    const style = document.createElement("link");
    style.id = "tmap-vector-style";
    style.rel = "stylesheet";
    style.href = base + ${JSON.stringify(styleFile)};
    document.head.appendChild(style);
  }

  const existingRuntime = document.getElementById("tmap-vector-runtime");
  if (existingRuntime) return;

  const script = document.createElement("script");
  script.id = "tmap-vector-runtime";
  script.src = base + ${JSON.stringify(sdkFile)};
  script.async = true;
  script.addEventListener("load", () => {
    window.dispatchEvent(new Event("tmap-sdk-ready"));
  }, { once: true });
  script.addEventListener("error", () => dispatchFailed("runtime-load-failed"), {
    once: true,
  });
  document.head.appendChild(script);
})();`;

    return scriptResponse(loader);
  } catch {
    return failedLoader("server-connection-failed");
  }
}
