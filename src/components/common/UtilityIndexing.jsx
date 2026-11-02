import React from 'react'
import { Helmet } from 'react-helmet-async'
import { useLocation } from 'react-router-dom'
import { isUtilityPath } from '../../lib/indexingPolicy'

// Mounted after route content so every utility state, including empty carts,
// recovery links and admin redirects, gets the same indexing instruction.
export default function UtilityIndexing() {
  const { pathname } = useLocation()
  return isUtilityPath(pathname) ? <Helmet><meta name="robots" content="noindex, nofollow" /></Helmet> : null
}
