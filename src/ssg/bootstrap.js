// Only hydrate the page whose public HTML was generated. Utility and unknown
// routes can receive the homepage via the hosting SPA fallback.
export function readPublicSnapshot(document, pathname) {
  try {
    const payload = document.getElementById('__PUBLIC_DATA__')
    const data = payload ? JSON.parse(payload.textContent) : null
    const path = pathname.replace(/\/$/, '') || '/'
    return data?.path === path ? data : null
  } catch { return null }
}
