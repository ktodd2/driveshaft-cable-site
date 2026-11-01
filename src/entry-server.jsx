import React from 'react'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import App from './App'
import { seedStorefrontPricing } from './stores/cartStore'

export function renderPage(path, initialData) {
  const helmetContext = {}
  seedStorefrontPricing(initialData.products, initialData.sales)
  const html = renderToString(<App router={StaticRouter} routerProps={{ location: path }} helmetContext={helmetContext} initialData={initialData} />)
  const helmet = helmetContext.helmet
  if (!helmet) throw new Error(`Missing SEO head for ${path}`)
  const head = [helmet.title, helmet.meta, helmet.link, helmet.script].map(tag => tag.toString()).join('\n')
  return { html, head }
}
