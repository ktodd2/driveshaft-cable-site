import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('regular cable marketing and FAQ structured data use 40 inches without metric length', () => {
  for (const file of ['src/components/landing/Hero.jsx', 'src/components/landing/Specs.jsx', 'src/pages/FAQPage.jsx']) {
    const content = readFileSync(file, 'utf8')
    assert.doesNotMatch(content, /39(?:\s*(?:inches?|in\b)|["″])|1,?000\s*mm/i, file)
    assert.match(content, /40(?: inches|")/, file)
  }
})
