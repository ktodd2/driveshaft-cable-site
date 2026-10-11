// Guards for the design refresh brief, checked against source.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const ROOT = new URL('../../', import.meta.url).pathname
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (['.js', '.jsx', '.css', '.html'].includes(extname(p))) out.push(p)
  }
  return out
}
const files = [...walk(join(ROOT, 'src')), join(ROOT, 'index.html')]

test('no rejected branding or taglines anywhere in shipped source', () => {
  for (const f of files) {
    const s = readFileSync(f, 'utf8')
    assert.ok(!/\bdispatch\b/i.test(s), `"Dispatch" found in ${f}`)
    assert.ok(!/(drivetrain|driveshaft) stays whole/i.test(s), `rejected tagline found in ${f}`)
  }
})

test('existing logo assets are still the ones rendered in header and footer', () => {
  assert.match(readFileSync(join(ROOT, 'src/components/layout/Header.jsx'), 'utf8'), /src="\/logos\/main-logo\.png"/)
  assert.match(readFileSync(join(ROOT, 'src/components/layout/Footer.jsx'), 'utf8'), /src="\/logos\/logo-badge\.png"/)
})

test('hero spec values are static literals (no counters/animated numbers)', () => {
  const hero = readFileSync(join(ROOT, 'src/components/landing/Hero.jsx'), 'utf8')
  assert.ok(!/setInterval|requestAnimationFrame|useState/.test(hero), 'Hero must not animate values')
  for (const v of ['5/32"', '39"', '3000 lbs', 'Class 7-8']) assert.ok(hero.includes(v), v)
})

test('refreshed layer avoids `transition: all` in the global stylesheet', () => {
  const css = readFileSync(join(ROOT, 'src/index.css'), 'utf8')
  assert.ok(!/transition:\s*all/.test(css))
  assert.match(css, /prefers-reduced-motion:\s*reduce/)
})
