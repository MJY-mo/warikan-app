const CACHE_NAME = 'warikan-cache-v4'; // 念のためバージョンを更新
const urlsToCache = [
    './index.html', // (修正) warikan-app.html から index.html に変更
    './manifest.json',
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    // アイコンもキャッシュ対象に追加（GitHubにアップロードするファイル）
    './icon-192x192.png',
    './icon-512x512.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                // ネットワークリクエストが失敗してもインストールを続行する
                const cachePromises = urlsToCache.map(urlToCache => {
                    return cache.add(urlToCache).catch(err => {
                        console.warn(`Failed to cache ${urlToCache}: ${err}`);
                    });
                });
                return Promise.all(cachePromises);
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
                // ネットワークリクエストのPromise
                const fetchPromise = fetch(event.request).then(networkResponse => {
                    // ネットワークから取得成功
                    // 有効なレスポンスのみキャッシュ
                    if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(err => {
                    // ネットワークから取得失敗（オフライン）
                    console.warn('Fetch failed; returning stale response from cache.', event.request.url);
                    // ネットワークがダメならキャッシュ済みのものを返す (キャッシュがなければundefined)
                    return response; 
                });

                // キャッシュがあればそれを先に返す (Stale)
                if (response) {
                    return response;
                }
                
                // キャッシュがなければ、ネットワークの結果を待つ (While-Revalidate)
                return fetchPromise;
            });
        })
    );
});

