// Match route segments, not prefixes such as /cartography or /administrator.
export function isUtilityPath(pathname) {
  return /^\/(cart|checkout|admin)(\/|$)/.test(pathname) ||
    /^\/(order-tracking|suggestions|testimonial)\/?$/.test(pathname)
}
