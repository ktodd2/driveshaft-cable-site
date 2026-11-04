// Match route segments, not prefixes such as /cartography or /administrator.
export function isUtilityPath(pathname) {
  return /^\/(cart|checkout|admin|referral)(\/|$)/.test(pathname) ||
    /^\/(order-tracking|suggestions|testimonial)\/?$/.test(pathname)
}
