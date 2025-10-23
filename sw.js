const CACHE_NAME = 'warikan-cache-v2';
const urlsToCache = [
    './warikan-app.html', // ファイル名と一致
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
            .then(() => self.skipWaiting()) // 古いSWをすぐに置き換える
    );
});

self.addEventListener('activate', event => {
     // 古いキャッシュを削除
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.filter(cacheName => {
                    return cacheName.startsWith('warikan-cache-') &&
                           cacheName !== CACHE_NAME;
                }).map(cacheName => {
                    return caches.delete(cacheName);
                })
            );
        }).then(() => self.clients.claim()) // クライアントを即座に制御
    );
});

self.addEventListener('fetch', event => {
    // Stale-While-Revalidate 戦略
    event.respondWith(
        caches.open(CACHE_NAME).then(cache => {
            return cache.match(event.request).then(response => {
                // 1. キャッシュがあれば、キャッシュを返しつつネットワークにリクエスト
                const fetchPromise = fetch(event.request).then(networkResponse => {
                    // ネットワークから取得成功
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                }).catch(err => {
                    // ネットワークから取得失敗（オフライン）
                    console.log('Fetch failed; returning stale response from cache.', err);
                    return response; // ネットワークがダメならキャッシュ済みのものを返す
                });

                // キャッシュがあればそれを先に返す (Stale)
                if (response) {
                    // console.log('Returning response from cache');
                    return response;
                }
                
                // キャッシュがなければ、ネットワークの結果を待つ (While-Revalidate)
                return fetchPromise;
            });
        })
    );
});
