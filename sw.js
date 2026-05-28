/* ===== Service Worker — 現地調査 Pro ===== */
const CACHE     = 'survey-app-v65';
const TILE_CACHE = 'survey-tiles-v1';
const TILE_MAX   = 2000; // 最大キャッシュタイル数

/* アプリシェル：インストール時に先読みするリソース */
const PRECACHE = [
    './',
    './index.html',
    './manifest.json',
    './icon.png',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://unpkg.com/dexie@3.2.4/dist/dexie.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    'https://cdn.jsdelivr.net/npm/exifr/dist/lite.umd.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
];

/* ===== インストール：アプリシェルを先読みキャッシュ ===== */
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(cache =>
            Promise.allSettled(
                PRECACHE.map(url =>
                    cache.add(url).catch(() => {/* 個別失敗は無視 */})
                )
            )
        ).then(() => self.skipWaiting())
    );
});

/* ===== アクティベート：古いキャッシュを削除 ===== */
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(k => k !== CACHE && k !== TILE_CACHE)
                    .map(k => caches.delete(k))
            )
        ).then(() => self.clients.claim())
    );
});

/* ===== フェッチ：リクエスト種別ごとに戦略を分ける ===== */
self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    const url = new URL(e.request.url);

    /* 地図タイル → キャッシュ優先（変更されないので） */
    if (isTile(url)) {
        e.respondWith(tileFirst(e.request));
        return;
    }

    /* CDN など外部リソース → キャッシュ優先（URLでバージョン管理済み） */
    if (url.origin !== self.location.origin) {
        e.respondWith(cacheFirst(e.request));
        return;
    }

    /* 同一オリジン（index.html等） → ネットワーク優先・失敗時キャッシュ */
    e.respondWith(networkFirst(e.request));
});

/* タイルURLかどうか判定 */
function isTile(url) {
    return /\/(png|jpg|jpeg)(\?.*)?$/.test(url.pathname) &&
           /\d+\/\d+\/\d+/.test(url.pathname);
}

/* キャッシュ優先（外部リソース・タイル以外） */
async function cacheFirst(req) {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
        const res = await fetch(req);
        if (res.ok) {
            const c = await caches.open(CACHE);
            c.put(req, res.clone());
        }
        return res;
    } catch {
        return new Response('offline', { status: 503 });
    }
}

/* ネットワーク優先（アプリ本体） */
async function networkFirst(req) {
    try {
        const res = await fetch(req);
        if (res.ok) {
            const c = await caches.open(CACHE);
            c.put(req, res.clone());
        }
        return res;
    } catch {
        const cached = await caches.match(req);
        return cached || new Response('offline', { status: 503 });
    }
}

/* タイル専用：キャッシュ優先 + 上限管理 */
async function tileFirst(req) {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
        const res = await fetch(req);
        if (res.ok) {
            const c = await caches.open(TILE_CACHE);
            c.put(req, res.clone());
            /* 上限超えたら古いタイルを削除 */
            c.keys().then(keys => {
                if (keys.length > TILE_MAX) {
                    keys.slice(0, keys.length - TILE_MAX).forEach(k => c.delete(k));
                }
            });
        }
        return res;
    } catch {
        return new Response('', { status: 503 });
    }
}
