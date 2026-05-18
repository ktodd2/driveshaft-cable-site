# Logo assets

Drop the four new logo images here. The site references them by exact filename:

| Filename             | Source image            | Used in                                                |
|----------------------|-------------------------|--------------------------------------------------------|
| `logo-horizontal.png`| Horizontal driveshaft + DRIVESHAFT CABLE wordmark on dark background | Header (`src/components/layout/Header.jsx`) and the admin login page |
| `logo-badge.png`     | Vertical hexagonal badge on dark background | Footer (`src/components/layout/Footer.jsx`) |
| `icon.png`           | Icon-only rounded-square badge (no wordmark) | Favicon (`index.html`) + every admin page's sidebar logo tile |
| `og-image.png`       | Wide banner with sparks | Social-share card (Open Graph + Twitter) in `index.html` and `SEOHead.jsx` |

Recommended sizing (not enforced):
- `logo-horizontal.png` — about 800×200 px, transparent or dark background
- `logo-badge.png` — about 600×600 px
- `icon.png` — at least 512×512 px (square)
- `og-image.png` — 1200×630 px (Open Graph standard)

If any file is missing, the affected logo will render as a broken image until it's added. Other images in `public/` (the IMG_*.jpeg product photos, `inuse.jpeg`, etc.) are untouched.

This README can be deleted at any time — the rebrand only depends on the four PNGs.
