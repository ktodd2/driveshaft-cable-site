# Storefront performance — November 1, 2026

Six exact-match WebP derivatives preserve the actual catalog photos and transparent logos. The picture element retains each original URL as a fallback; unknown or newly changed catalog URLs use their original source automatically. Product metadata and original sharing images remain intact. Main product images and the compact storefront's first card load eagerly with high priority; footer and gallery thumbnails defer offscreen loading.

| Asset | Original bytes | WebP bytes |
| --- | ---: | ---: |
| Header logo | 1,936,965 | 29,324 |
| Footer badge | 1,143,227 | 19,174 |
| Standard cable | 257,024 | 121,216 |
| Bolt main photo | 1,884,356 | 72,516 |
| XL cable | 155,742 | 6,004 |
| Cutter main photo | 1,992,711 | 150,144 |
| Total | 7,370,025 | 398,378 |

Images were EXIF-transposed, resized with Lanczos (640px logo, 480px badge, 960px product maximum width; no upscaling), and encoded as WebP quality 85. Original photos remain unchanged.

Checkout is a lazy route with an accessible loading status. Stripe initializes only when checkout code loads. The payment-return sanitizer still precedes third-party scripts. AdSense loads once when an actual blog ad slot approaches the viewport, with cleanup on unmount and graceful failure when blocked. GA behavior is unchanged.

Initial JavaScript: 737,698 → 703,345 bytes raw; 207,706 → 197,858 bytes with Python gzip. These are build asset measurements, not Lighthouse scores or measured user load times. A PageSpeed baseline was unavailable; no Core Web Vitals or ranking improvement is claimed.

Validation: 235 unit tests pass, route inventory matches, production build verifies 125 complete public pages and canonical sitemap URLs. Existing image-layout guard now recognizes the picture-backed image component. Ad script tests cover concurrent slots and blocked scripts.
