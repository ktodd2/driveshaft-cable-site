import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reviewShippingRows, parseShippingMoney, groupShippingSelections, saveShippingGroup, shippingSourceKey } from '../../src/lib/shippingImport.js'
import { parsePirateShipFile, validateShippingGrid } from '../../src/lib/csvParser.js'
const orders = [
  { id: 'a', name: 'Alex', email: 'a@example.invalid', actual_shipping_cost_cents: null, tracking_number: 'OLD' },
  { id: 'b', name: 'Alex', email: 'b@example.invalid', actual_shipping_cost_cents: 0, tracking_number: null },
]
const label = (overrides = {}) => ({ Name: 'Alex', Cost: '5.25', 'Tracking Number': 'NEW', ...overrides })
test('ambiguous names produce multiple suggestions, never an automatic selection', () => {
  const rows = reviewShippingRows([label()], orders)
  assert.equal(rows[0].candidates.length, 2)
  assert.deepEqual(groupShippingSelections(rows, {}, orders), [])
  assert.match(rows[0].reason, /Multiple/)
  assert.equal(groupShippingSelections(rows, { 2: 'b' }, orders)[0].order.id, 'b')
})
test('tracking has highest suggestion priority but still needs confirmation', () => {
  const rows = reviewShippingRows([label({ 'Tracking Number': 'OLD' })], orders)
  assert.equal(rows[0].candidates[0].id, 'a')
  assert.equal(rows[0].candidates[0].reason, 'Exact tracking')
  assert.equal(groupShippingSelections(rows, {}, orders).length, 0)
})
test('unknown recipient can be explicitly mapped; same-order labels total once', () => {
  const rows = reviewShippingRows([label({ Name: 'Unknown' }), label({ 'Tracking Number': 'SECOND', Cost: '0' })], orders)
  assert.equal(rows[0].candidates.length, 0)
  const groups = groupShippingSelections(rows, { 2: 'a', 3: 'a' }, orders)
  assert.equal(groups.length, 1)
  assert.equal(groups[0].rows.length, 2)
  assert.equal(groups[0].total, 525)
  const huge = reviewShippingRows([label({ Cost: '21474836.47' }), label({ Cost: '1', 'Tracking Number': 'SECOND' })], orders)
  assert.throws(() => groupShippingSelections(huge, { 2: 'a', 3: 'a' }, orders), /too large/)
})
test('zero is valid, null is unknown, malformed and negative generic costs excluded', () => {
  assert.equal(parseShippingMoney(0), 0)
  for (const value of [null, '', ' ', '1.234', '3junk', '-4', 'NaN', '1e2', 'Infinity', '1,2', '$1,00']) assert.equal(parseShippingMoney(value), null)
  assert.equal(parseShippingMoney('-12.35', { ledger: true }), 1235)
  assert.equal(parseShippingMoney('$1,200.50'), 120050)
  assert.ok(reviewShippingRows([label({ Cost: '-2' })], orders)[0].blocked)
})
test('duplicate source labels and identical fingerprint rows cannot both be selected', () => {
  const rows = reviewShippingRows([label(), label()], orders)
  assert.match(rows[1].blocked, /Duplicate/)
  assert.equal(groupShippingSelections(rows, { 2: 'a', 3: 'b' }, orders).length, 1)
  const ledger = { Type: 'Label', Description: 'Alex: 2 Label Batch', Total: '-10' }
  const batch = reviewShippingRows([ledger, ledger], orders)
  assert.equal(batch[0].cost, 1000)
  assert.equal(batch[0].name, 'Alex')
  assert.match(batch[1].blocked, /Duplicate/)
})
test('refund and void rows stop both reversal and original label independent of order', () => {
  for (const type of ['Refund', 'Voided', 'Cancelled']) {
    const rows = reviewShippingRows([label(), label({ Status: type })], orders)
    assert.ok(rows.every(r => r.blocked))
  }
  const ledger = reviewShippingRows([{ Type: 'Refund', Description: 'Alex: 1 Label Batch', Total: '5' }, { Type: 'Label', Description: 'Alex: 1 Label Batch', Total: '-5' }], orders)
  assert.ok(ledger.every(r => r.blocked))
})
test('ledger payments and numeric XLSX tracking are excluded', () => {
  assert.ok(reviewShippingRows([{ Type: 'Payment', Description: 'Card', Total: '-10' }], orders)[0].blocked)
  assert.match(reviewShippingRows([label({ 'Tracking Number': 123456 })], orders)[0].blocked, /stored as text/)
})
test('source key stays stable across row order, column order, file renaming, cost changes with tracking', async () => {
  const a = reviewShippingRows([label()], orders)[0]
  const b = reviewShippingRows([{ Cost: '6', Name: 'Alex', 'Tracking Number': 'NEW' }], orders)[0]
  assert.equal(await shippingSourceKey(a.identity), await shippingSourceKey(b.identity))
  const x = reviewShippingRows([{ Type: 'Label', Total: '-5', Description: 'Alex' }], orders)[0]
  const y = reviewShippingRows([{ Description: 'Alex', Total: '-5', Type: 'Label' }], orders)[0]
  assert.equal(await shippingSourceKey(x.identity), await shippingSourceKey(y.identity))
})
test('CSV and spreadsheet validation reject malformed inputs and preserve zero', async () => {
  assert.throws(() => validateShippingGrid([['Name', 'Name'], ['A', 'B']]), /unique/)
  assert.throws(() => validateShippingGrid([['Name'], ['A', 'B']]), /more cells/)
  assert.throws(() => validateShippingGrid([]), /empty/)
  assert.equal(validateShippingGrid([['Name', 'Cost'], ['A', 0]])[0].Cost, 0)
  const file = (name, text) => ({ name, size: text.length, text: async () => text })
  await assert.rejects(parsePirateShipFile(file('bad.csv', 'Name,Cost\n"unclosed,2'), orders), /Malformed/)
  await assert.rejects(parsePirateShipFile(file('old.xls', ''), orders), /legacy XLS/)
  await assert.rejects(parsePirateShipFile(new File(['garbage'], 'bad.xlsx'), orders))
  const parsed = await parsePirateShipFile(file('valid.csv', 'Name,Cost\nAlex,0'), orders)
  assert.equal(parsed[0].cost, 0)
})
test('save preserves null/zero and explicit tracking choice, uses only atomic RPC', async () => {
  const group = groupShippingSelections(reviewShippingRows([label()], orders), { 2: 'b' }, orders)[0]
  let calls = 0
  const client = { rpc: async (name, payload) => {
    calls++
    assert.equal(name, 'apply_shipping_import')
    assert.equal(payload.p_expected_cost, 0)
    assert.equal(payload.p_tracking, null)
    assert.equal(payload.p_expected_tracking, null)
    assert.equal(payload.p_labels[0].cost_cents, 525)
    return { data: { status: calls === 1 ? 'saved' : 'already_applied' } }
  } }
  assert.equal((await saveShippingGroup(client, group, null, 'file.csv')).status, 'saved')
  assert.equal((await saveShippingGroup(client, group, null, 'file.csv')).status, 'already_applied')
  await assert.rejects(saveShippingGroup({ rpc: async () => ({ error: { message: 'Changed order' } }) }, group, null, 'file.csv'), /Changed order/)
  await assert.rejects(saveShippingGroup({ rpc: async () => ({ data: null }) }, group, null, 'file.csv'), /unknown/)
})

test('untrusted CSV formulas and markup never become shipping costs or tracking', () => {
  for (const value of ['=HYPERLINK("https://example.invalid")', '+CMD', '@SUM(1)', '<img src=x onerror=alert(1)>', 'A'.repeat(101)]) {
    assert.ok(reviewShippingRows([label({ 'Tracking Number': value })], orders)[0].blocked)
  }
  assert.ok(reviewShippingRows([label({ Cost: '=1+1' })], orders)[0].blocked)
  const row = reviewShippingRows([label({ Name: '<script>alert(1)</script>' })], orders)[0]
  assert.equal(row.name, '<script>alert(1)</script>') // React renders as text, no HTML parsing.
  assert.equal(row.candidates.length, 0)
})
