/* =========================================================
   sw.js — Service Worker (PWA用オフラインキャッシュ)
   2026/07/26 追加

   方針:
   - 自分のドメインのファイル(HTML/CSS/JS/アイコン)は「インストール時に
     まとめてキャッシュ」しておき、次回以降はオフラインでも起動できるようにする。
   - three.js本体などの外部CDNは「まず取りに行って、失敗したらキャッシュを使う」
     (network-first)方式にして、更新があれば追従できるようにしている。
   - CACHE_NAMEの末尾のバージョン番号を上げると、古いキャッシュが破棄されて
     新しいファイルに総入れ替えされる。ゲームの中身を更新したときはここを上げること。
========================================================= */

const CACHE_VERSION = 'v2';
const CACHE_NAME = `capture-rpg-${CACHE_VERSION}`;

// 自分のドメイン内で、起動に必要な最低限のファイル
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/config.js',
  './js/audio.js',
  './js/story.js',
  './js/models.js',
  './js/maze.js',
  './js/party.js',
  './js/island.js',
  './js/save.js',
  './js/battle.js',
  './js/main.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names
        .filter((name) => name.startsWith('capture-rpg-') && name !== CACHE_NAME)
        .map((name) => caches.delete(name))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (isSameOrigin) {
    // 自ドメイン: キャッシュ優先(オフラインでも即起動できるように)、
    // 裏で最新版を取りに行ってキャッシュを更新する(stale-while-revalidate)
    event.respondWith(
      caches.match(req).then((cached) => {
        const networkFetch = fetch(req).then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        }).catch(() => cached);
        return cached || networkFetch;
      })
    );
  } else {
    // 外部CDN(three.js本体・フォントなど): ネットワーク優先、
    // 失敗したらキャッシュにフォールバック
    event.respondWith(
      fetch(req).then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      }).catch(() => caches.match(req))
    );
  }
});
