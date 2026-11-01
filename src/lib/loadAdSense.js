let pending

// Called only for blog ad slots near the viewport, never by the shop shell.
export function loadAdSense() {
  if (pending) return pending
  pending = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.async = true
    script.crossOrigin = 'anonymous'
    script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3653983384826324'
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })
  return pending
}
