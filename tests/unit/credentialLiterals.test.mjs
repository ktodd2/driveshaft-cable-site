import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { credentialLiteralFindings } from '../../scripts/credential-literals.mjs'

test('credential scanner catches opaque literals, properties, fallbacks and SQL bearer values without exposing matches', () => {
  const synthetic = 'a'.repeat(64)
  for (const source of [
    `const WALL_TOKEN = '${synthetic}'`,
    `const WALL_TOKEN: string =\n'${synthetic}'`,
    `const config = { 'api_key': '${synthetic}' }`,
    `const password = env.PASSWORD || '${synthetic}'`,
    `select jsonb_build_object('Authorization', 'Bearer ${synthetic}')`,
    `const AUTH_TOKEN_URL = 'https://example.test/?token=${synthetic}'`,
  ]) {
    const findings = credentialLiteralFindings(source, 'synthetic-fixture.js')
    assert.ok(findings.length > 0)
    assert.ok(!JSON.stringify(findings).includes(synthetic))
  }
  assert.deepEqual(credentialLiteralFindings("const TOKEN_URL = 'https://example.test/oauth/token'", 'fixture.js'), [])
})

test('shipped Edge functions contain no credential literals', () => {
  const root = new URL('../../supabase/functions/', import.meta.url)
  const findings = readdirSync(root, { recursive: true }).filter(p => /\.(?:ts|js)$/.test(p))
    .flatMap(p => credentialLiteralFindings(readFileSync(new URL(p, root), 'utf8'), p))
  assert.deepEqual(findings, [])
})
