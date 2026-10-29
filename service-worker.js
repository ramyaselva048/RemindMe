
const CACHE_NAME = "remindme-notification-only-v5";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./css/calendar.css",
  "./css/reminders.css",
  "./css/responsive.css",
  "./js/app.js",
  "./js/firebase.js",
  "./js/auth.js",
  "./js/calendar.js",
  "./js/reminders.js",
  "./js/storage.js",
  "./js/notifications.js",
  "./assets/icons/favicon.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/images/logo.png"
];

// Install: cache the main website files
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch((error) => {
        console.error("RemindMe cache installation failed:", error);
      })
  );
});

// Activate: remove old versions of the app cache
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              (cacheName) =>
                cacheName.startsWith("remindme-cache-") &&
                cacheName !== CACHE_NAME
            )
            .map((cacheName) => caches.delete(cacheName))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: cache-first for local static assets,
// network-first for HTML navigation
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Handle only GET requests from this website.
  // Firebase CDN requests remain network-controlled.
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  // HTML navigation: try network, then cached page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put("./index.html", copy);
            });
          }
          return response;
        })
        .catch(async () => {
          return (
            await caches.match(request) ||
            await caches.match("./index.html") ||
            Response.error()
          );
        })
    );
    return;
  }

  // Static assets: try cache first, then network.
  event.respondWith(
    caches.match(request).then(async (cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      try {
        const response = await fetch(request);

        if (response.ok && response.type === "basic") {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, response.clone());
        }

        return response;
      } catch (error) {
        console.error("Resource unavailable offline:", request.url);
        return new Response("You are offline. Please reconnect to access this resource.", {
          status: 503,
          statusText: "Service Unavailable",
          headers: {
            "Content-Type": "text/plain; charset=utf-8"
          }
        });
      }
    })
  );
});

// Notification click: focus an existing tab or open the website.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = new URL("./index.html", self.registration.scope).href;

  event.waitUntil(
    self.clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then(async (clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.registration.scope)) {
          await client.focus();

          if ("navigate" in client && client.url !== targetUrl) {
            return client.navigate(targetUrl);
          }

          return;
        }
      }

      return self.clients.openWindow(targetUrl);
    })
  );
});
