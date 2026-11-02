import { test } from 'node:test'
import assert from 'node:assert/strict'

test('concurrent ad slots share one asynchronous script load', async () => {
  const appended = []
  globalThis.document = { createElement: () => ({}), head: { appendChild: node => appended.push(node) } }
  try {
    const { loadAdSense } = await import('../../src/lib/loadAdSense.js?success')
    const first = loadAdSense()
    const second = loadAdSense()
    assert.equal(first, second)
    assert.equal(appended.length, 1)
    assert.equal(appended[0].async, true)
    assert.match(appended[0].src, /^https:\/\/pagead2\.googlesyndication\.com\//)
    appended[0].onload()
    await first
    await loadAdSense()
    assert.equal(appended.length, 1)
  } finally { delete globalThis.document }
})

test('blocked ad script rejects without repeated script injection', async () => {
  const appended = []
  globalThis.document = { createElement: () => ({}), head: { appendChild: node => appended.push(node) } }
  try {
    const { loadAdSense } = await import('../../src/lib/loadAdSense.js?failure')
    const pending = loadAdSense()
    appended[0].onerror(new Error('blocked'))
    await assert.rejects(pending, /blocked/)
    await assert.rejects(loadAdSense(), /blocked/)
    assert.equal(appended.length, 1)
  } finally { delete globalThis.document }
})
