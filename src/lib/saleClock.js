// Re-evaluate every pricing consumer at starts/ends, including cart/checkout.
// Cap long timeouts to avoid browser overflow; focus handles sleeping tabs.
export function nextSaleBoundaryDelay(sales, now = Date.now()) {
  const times = (sales || []).filter(s => s?.is_active).flatMap(s => [Date.parse(s.starts_at), Date.parse(s.ends_at)])
    .filter(time => Number.isFinite(time) && time > now)
  return times.length ? Math.min(2147483647, Math.max(1, Math.min(...times) - now)) : null
}
export function startSaleClock({ readSales, refresh, subscribe, target = window, now = Date.now, schedule = setTimeout, cancel = clearTimeout }) {
  let timer
  const arm = () => {
    cancel(timer)
    const delay = nextSaleBoundaryDelay(readSales(), now())
    if (delay !== null) timer = schedule(() => { refresh(); arm() }, delay)
  }
  const resume = () => { refresh(); arm() }
  const unsubscribe = subscribe(arm)
  target.addEventListener('focus', resume)
  target.addEventListener('pageshow', resume)
  arm()
  return () => { cancel(timer); unsubscribe(); target.removeEventListener('focus', resume); target.removeEventListener('pageshow', resume) }
}
