// ApeXNOS Service Worker for Offline Support
const CACHE_NAME = 'apexnos-v1.0.0';
const STATIC_CACHE_NAME = 'apexnos-static-v1.0.0';
const DYNAMIC_CACHE_NAME = 'apexnos-dynamic-v1.0.0';

// Files to cache for offline use
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/script.js',
    '/logo.png',
    '/favicon.ico',
    'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@300;400;600;700&display=swap'
];

// Install event - cache static assets
self.addEventListener('install', event => {
    console.log('ApeXNOS Service Worker: Installing...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME)
            .then(cache => {
                console.log('ApeXNOS Service Worker: Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('ApeXNOS Service Worker: Installation complete');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('ApeXNOS Service Worker: Installation failed', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('ApeXNOS Service Worker: Activating...');
    
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== STATIC_CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
                            console.log('ApeXNOS Service Worker: Deleting old cache', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('ApeXNOS Service Worker: Activation complete');
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Skip chrome-extension and other non-http requests
    if (!event.request.url.startsWith('http')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                // Return cached version if available
                if (cachedResponse) {
                    console.log('ApeXNOS Service Worker: Serving from cache', event.request.url);
                    return cachedResponse;
                }

                // Otherwise fetch from network
                return fetch(event.request)
                    .then(response => {
                        // Don't cache non-successful responses
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // Clone the response
                        const responseToCache = response.clone();

                        // Cache dynamic content
                        caches.open(DYNAMIC_CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });

                        console.log('ApeXNOS Service Worker: Caching new resource', event.request.url);
                        return response;
                    })
                    .catch(error => {
                        console.log('ApeXNOS Service Worker: Network request failed', event.request.url);
                        
                        // Return offline page for navigation requests
                        if (event.request.destination === 'document') {
                            return caches.match('/index.html');
                        }
                        
                        // Return a custom offline response for other requests
                        return new Response(
                            JSON.stringify({
                                error: 'Offline',
                                message: 'ApeXNOS is currently offline. Please check your connection.',
                                timestamp: new Date().toISOString()
                            }),
                            {
                                status: 503,
                                statusText: 'Service Unavailable',
                                headers: {
                                    'Content-Type': 'application/json'
                                }
                            }
                        );
                    });
            })
    );
});

// Background sync for when connection is restored
self.addEventListener('sync', event => {
    if (event.tag === 'background-sync') {
        console.log('ApeXNOS Service Worker: Background sync triggered');
        event.waitUntil(
            // Perform any background tasks here
            Promise.resolve()
        );
    }
});

// Push notification support (for future features)
self.addEventListener('push', event => {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body || 'ApeXNOS has a new update!',
            icon: '/logo.png',
            badge: '/favicon.ico',
            vibrate: [100, 50, 100],
            data: {
                dateOfArrival: Date.now(),
                primaryKey: 1
            },
            actions: [
                {
                    action: 'explore',
                    title: 'Visit ApeXNOS',
                    icon: '/logo.png'
                },
                {
                    action: 'close',
                    title: 'Close',
                    icon: '/favicon.ico'
                }
            ]
        };

        event.waitUntil(
            self.registration.showNotification('ApeXNOS Gaming Clan', options)
        );
    }
});

// Notification click handler
self.addEventListener('notificationclick', event => {
    event.notification.close();

    if (event.action === 'explore') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Message handler for communication with main thread
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({
            version: CACHE_NAME
        });
    }
});

console.log('ApeXNOS Service Worker: Loaded successfully');
