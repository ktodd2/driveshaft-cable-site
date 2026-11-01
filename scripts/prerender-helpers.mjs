// JSON in HTML must not let public product/post text close a script element.
export const serializePublicData = data => JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
export function routeFile(path) {
  if (path === '/') return 'index.html'
  const parts = path.slice(1).split('/')
  if (!parts.every(part => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(part))) throw new Error(`Unsafe public path: ${path}`)
  return `${parts.join('/')}/index.html`
}
export function pageDocument(shell, { html, head }, data) {
  const clean = shell.replace(/<title>[\s\S]*?<\/title>/gi, '').replace(/<meta\b[^>]*data-rh="true"[^>]*>/gi, '')
  return clean.replace('</head>', () => `${head}\n</head>`)
    .replace('<div id="root"></div>', () => `<div id="root">${html}</div><script id="__PUBLIC_DATA__" type="application/json">${serializePublicData(data)}</script>`)
}
