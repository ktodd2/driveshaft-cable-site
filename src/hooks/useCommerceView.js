import { useEffect, useRef } from 'react'
import { createCommerceVisit } from '../lib/commerceAnalytics'

export function useCommerceView(name, key, lines, ready) {
  const visit = useRef(null)
  if (!visit.current) visit.current = createCommerceVisit()
  useEffect(() => {
    if (ready) visit.current(name, key, lines)
  }, [name, key, lines, ready])
}
