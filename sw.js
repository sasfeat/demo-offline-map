const cacheName = 'maptiler-raster-cache-v3';

const isGithubPages = self.location.hostname.includes('github.io');
const isSkyFire = self.location.hostname.includes('skyfirestudio.com');
const basePath = isGithubPages ? '/demo-offline-map/' : (isSkyFire ? '/maps/' : '/');

function updateCacheAssets() {
    cacheAssets = [
        basePath,
        `${basePath}index.html`,
        `${basePath}libs/leaflet.css`,
        `${basePath}libs/leaflet.js`,
        `${basePath}images/marker-icon.png`,
        `${basePath}images/marker-shadow.png`,
        `${basePath}images/marker-icon-2x.png`
    ];
}

let cacheAssets = [
    '/',  // Default assets, will be updated once basePath is set
    '/index.html',
    '/libs/leaflet.css',
    '/libs/leaflet.js',
    '/images/marker-icon.png',
    '/images/marker-shadow.png',
    '/images/marker-icon-2x.png'
];

updateCacheAssets();

self.addEventListener('install', function(event) {
    event.waitUntil(
        self.skipWaiting(), // Skip waiting to activate the service worker immediately
        caches.open(cacheName).then(function(cache) {
            return cache.addAll(cacheAssets);
        })
    );
});

self.addEventListener('activate', function(event) {
    event.waitUntil(
        clients.claim(), // Claim clients to start controlling them immediately
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(existingCacheName) {
                    if (existingCacheName !== cacheName) {
                        console.log('Deleting old cache:', existingCacheName);
                        return caches.delete(existingCacheName);
                    }
                })
            );
        })
    );
});
self.addEventListener('fetch', function(event) {
    if (event.request.url.includes('https://api.maptiler.com/maps/streets-v2/')) {
        // Перехватываем запросы к тайлам
        event.respondWith(
            caches.match(event.request, { ignoreVary: true }).then(function(response) {
                if (response) {
                    // Если ресурс найден в кэше, вернуть его
                    // console.log(`Serving from cache: ${event.request.url}`);
                    return response;
                }

                // Если тайл не найден в кэше, запросить его из сети и добавить в кэш
                return fetch(event.request).then(function(networkResponse) {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(cacheName).then(function(cache) {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return networkResponse;
                }).catch(function(error) {
                    // Если нет сети, вернуть "заглушку" или уведомить пользователя
                    console.error(`Failed to fetch tile, no network: ${event.request.url}`, error);
                    return new Response('Tile not found and no network access.', {
                        status: 503,
                        statusText: 'Service Unavailable'
                    });
                });
            })
        );
    } else {
        // Обычная обработка для других запросов
        event.respondWith(
            caches.match(event.request, { ignoreVary: true }).then(function(response) {
                return response || fetch(event.request);
            })
        );
    }
});



