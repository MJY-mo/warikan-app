const CACHE_NAME = 'warikan-cache-v6'; // (修正) キャッシュバージョンをv6に更新
const urlsToCache = [
    './index.html', 
    './manifest.json',
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    './icon-192x192.png',
    './icon-512x512.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                const cachePromises = urlsToCache.map(urlToCache => {
                    // ネットワークから最新を取得してキャッシュする (reload)
                    const request = new Request(urlToCache, {cache: 'reload'});
                    return cache.add(request).catch(err => {
                        console.warn(`Failed to cache ${urlToCache}: ${err}`);
                    });
                });
                return Promise.all(cachePromises);
            })
            .then(() => self.skipWaiting()) // インストール後すぐに有効化
    );
});

self.addEventListener('activate', event => {
     // 古いキャッシュ(v5以前)を削除
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
        }).then(() => self.clients.claim()) // ページを即座にコントロール
    );
});

self.addEventListener('fetch', event => {
    // HTMLファイル(index.html)は Network First
    // オンライン時は常に最新版を見に行き、オフライン時だけキャッシュを使う
    if (event.request.mode === 'navigate' || (event.request.destination === 'document')) {
        event.respondWith(
            fetch(event.request).then(response => {
                // ネットワークから取得成功したら、キャッシュにも保存
                return caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, response.clone());
                    return response;
                });
            }).catch(() => {
                // ネットワーク失敗（オフライン）時はキャッシュから返す
                return caches.match(event.request);
            })
        );
        return;
    }

    // その他のアセット (CSS, Font, Iconなど) は Stale-While-Revalidate
    // （キャッシュを返しつつ、裏でネットワークに更新を確認しに行く）
    event.respondWith(
        caches.open(CACHE_NAME).then(cache => {
            return cache.match(event.request).then(response => {
                const fetchPromise = fetch(event.request).then(networkResponse => {
                    if (networkResponse && networkResponse.status === 200) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(err => {
                    console.warn('Fetch failed; returning stale response from cache.', event.request.url);
                    return response; 
                });

                // キャッシュがあれば先に返す
                return response || fetchPromise;
            });
        })
    );
});

