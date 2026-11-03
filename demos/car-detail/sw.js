const CACHE_PREFIX = "cardetail-shell-";
const CACHE_NAME = `${CACHE_PREFIX}demo-v1`;
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/styles.css",
  "./assets/app.js",
  "./assets/install.js",
  "./assets/privacy.js",
  "./assets/legal.js",
  "./legal/privacy.html",
  "./legal/consent.html",
  "./legal/cookies.html",
  "./legal/terms.html",
  "./legal/details.html",
  "./assets/form-logic.mjs",
  "./assets/booking-logic.mjs",
  "./assets/booking.js",
  "./assets/single-flight.mjs",
  "./assets/studio-store.mjs",
  "./assets/studio-domain.mjs",
  "./assets/supabase-client.mjs",
  "./assets/company.json",
  "./assets/company.mjs",
  "./assets/company-page.mjs",
  "./icons/arrow-up-right.svg",
  "./assets/content.json",
  "./images/hero-bmw-m8.jpg",
  "./icons/app-icon.svg",
  "./icons/app-icon-192.png",
  "./icons/app-icon-512.png",
  "./icons/apple-touch-icon.png",
  "./images/exterior-cleaning.webp",
  "./images/gallery-audi-q7.webp",
  "./images/gallery-audi-rs7.webp",
  "./images/gallery-bmw-m5-g90.webp",
  "./images/hero-detailing.webp",
  "./images/interior-detailing.webp",
  "./images/paint-polishing.webp",
  "./images/paint-reflection.webp",
  "./images/process-light.webp",
  "./images/protective-coating.webp",
  "./images/sale-prep.webp",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)));
  // Let the browser activate updates after existing tabs close. Open cabinet
  // drafts must keep their current worker and application shell together.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys
      .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    event.respondWith(fetch(request));
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.destination === "image") {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
      return response;
    })));
    return;
  }

  event.respondWith(fetch(request).then((response) => {
    if (response.ok && response.type === "basic") {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
    }
    return response;
  }).catch(async () => (await caches.match(request, {
    // Versioned stylesheet/module URLs share the precached shell asset offline.
    ignoreSearch: request.destination === "style" || request.destination === "script",
  })) || (request.mode === "navigate" ? caches.match("./index.html") : Response.error())));
});
