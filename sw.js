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
    event.respondWith(
        caches.match(event.request, { ignoreVary: true }).then(function(response) {
            if (response) {
                // If the request is found in the cache, return it
                return response;
            }
            // If the request is not found in the cache, fetch it from the network
            return fetch(event.request).then(function(networkResponse) {
                // Check if we received a valid response
                if (networkResponse && networkResponse.status === 200) {
                    // Clone the response before putting it in the cache
                    const responseClone = networkResponse.clone();
                    caches.open(cacheName).then(function(cache) {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            }).catch(function(error) {
                // If the network fetch fails, handle it here (optional)
                console.error(`Failed to fetch resource: ${event.request.url}`, error);
                return new Response('Resource not found and no network access.', {
                    status: 503,
                    statusText: 'Service Unavailable'
                });
            });
        })
    );
});

self.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'PRELOAD_TILES') {

        const bounds = event.data.bounds;
        const maxZoom = event.data.maxZoom;
        const tileSize = event.data.tileSize;
        const key = '4jp4WyVHK48PO10ZTVY3';  // Make sure the key is accessible in the SW

        let tilesLoaded = 0;
        let totalTiles = 0;

        // Function to convert lat/lng to tile coordinates
        function latLngToTile(latlng, zoom, tileSize) {
            const latRad = latlng.lat * Math.PI / 180;  // Use latlng.lat instead of latlng[0]
            const n = Math.pow(2, zoom);
            const x = Math.floor((latlng.lng + 180) / 360 * n);  // Use latlng.lng instead of latlng[1]
            const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
            return { x: x, y: y };
        }

        for (let zoom = 1; zoom < maxZoom; zoom++) {
            const nwTile = latLngToTile(bounds.northWest, zoom, tileSize);
            const seTile = latLngToTile(bounds.southEast, zoom, tileSize);

            if (isNaN(nwTile.x) || isNaN(nwTile.y) || isNaN(seTile.x) || isNaN(seTile.y)) {
                console.error('Invalid tile coordinates:', nwTile, seTile);
                continue;  // Пропустить итерацию, если координаты тайла недействительны
            }

            totalTiles += (seTile.x - nwTile.x + 1) * (seTile.y - nwTile.y + 1);

            for (let y = nwTile.y; y <= seTile.y; y++) {
                for (let x = nwTile.x; x <= seTile.x; x++) {
                    const url = `https://api.maptiler.com/maps/hybrid/${zoom}/${x}/${y}.jpg?key=${key}`;

                    caches.open('maptiler-raster-cache-v3').then(function(cache) {
                        fetch(url).then(function(response) {
                            if (response.ok) {
                                cache.put(url, response.clone());
                                tilesLoaded++;
                                console.log(`Tile at ${zoom}/${x}/${y} cached.`);
                                console.log(`Loaded ${tilesLoaded}/${totalTiles} tiles.`);
                            } else {
                                console.warn(`Failed to fetch tile at ${zoom}/${x}/${y}: Status ${response.status}`);
                            }
                        }).catch(function(error) {
                            console.error(`Error fetching tile at ${zoom}/${x}/${y}:`, error);
                        });
                    });
                }
            }
        }
    }
});

// Update the Service Worker (sw.js) to cache marker data
self.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'CACHE_MARKERS') {
        const markerData = event.data.data;
        caches.open(cacheName).then(function(cache) {
            const markersUrl = 'https://www.mapreact.com/map/maps.php?id=test';
            cache.put(markersUrl, new Response(JSON.stringify(markerData)));
            console.log('Markers cached successfully.');
        });
    }
});
