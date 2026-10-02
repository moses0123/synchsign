/* SyncSign service worker — app-shell caching + offline fallback */
const VERSION = "syncsign-v2";
const SHELL = ["/offline", "/icons/icon-192.png", "/icons/icon-512.png", "/pdf.worker.min.mjs"];
const DEV_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Never interfere with local development, API calls or Next.js dev/HMR traffic
  if (DEV_HOSTS.includes(url.hostname)) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/webpack-hmr")) return;

  // Hashed build assets: cache-first (safe, they never change)
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.endsWith(".mjs")) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {}); }
        return res;
      }))
    );
    return;
  }

  // Pages: always go to the network; show the offline page only when the network is truly unreachable
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).catch(async () => (await caches.match("/offline")) || new Response("You are offline", { status: 503, headers: { "Content-Type": "text/plain" } }))
    );
  }
});

self.addEventListener("message", (e) => { if (e.data === "skip-waiting") self.skipWaiting(); });
