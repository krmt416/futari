// 電波がない場所でもアプリを起動できるように、画面ファイルを端末に保存します。
// オンラインのときは常に最新を取りに行き、3秒以内に取れなければ保存済みを使います。
const V = "futari-v2";
const FILES = ["./", "index.html", "manifest.json", "icon-180.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;   // GASなど外部への通信には触らない
  e.respondWith((async () => {
    const cache = await caches.open(V);
    const fresh = fetch(req, { cache: "no-cache" }).then(r => { if (r.ok) e.waitUntil(cache.put(req, r.clone())); return r; });
    const timeout = new Promise((_, rej) => setTimeout(rej, 3000));
    try {
      const res = await Promise.race([fresh, timeout]);
      if (res.ok) return res;
      const hit = await cache.match(req, { ignoreSearch: true });   // サーバーがエラーを返したら、保存済みの画面を使う
      return hit || res;
    } catch {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      try { return await fresh; } catch { return new Response("オフラインです", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }); }
    }
  })());
});
